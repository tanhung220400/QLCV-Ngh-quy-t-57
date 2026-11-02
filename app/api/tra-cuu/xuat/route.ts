import ExcelJS from "exceljs";
import { apiUser } from "@/lib/auth";
import { traCuu, type KetQuaTraCuu } from "@/lib/tracuuRun";
import { toResponse } from "@/lib/excel";
import { fmtDue, fmtDate, fmtDateTime, vnDate } from "@/lib/time";
import { fmtNum } from "@/lib/kpi";
import { getSettings } from "@/lib/settings";
import { taskStatusText } from "@/lib/reports";

export const maxDuration = 60;

type O = string | number | null | undefined;
type Cot = { h: string; w: number; giua?: boolean };
type Nhom = { ten: string; dong: O[][] };

const FONT = "Times New Roman";
const vien = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } } as const;
const LA_MA = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX"];

function tenTrang(wb: ExcelJS.Workbook, s: string) {
  const goc = s.replace(/[\\/?*[\]:]/g, " ").slice(0, 28).trim() || "Danh sach";
  let t = goc;
  let i = 2;
  while (wb.getWorksheet(t)) t = `${goc.slice(0, 26)} ${i++}`;
  return t;
}

/**
 * Một trang danh sách theo thể thức văn bản: tên cơ quan, tiêu đề “DANH SÁCH …”, dòng yêu cầu,
 * bảng có STT và các cột phù hợp với nội dung; nếu tổng hợp theo nhóm thì có dòng nhóm I, II, III…
 */
function danhSach(wb: ExcelJS.Workbook, o: { trang: string; coQuan: string; tieuDe: string; yeuCau: string; cot: Cot[]; nhom: Nhom[] }) {
  const ws = wb.addWorksheet(tenTrang(wb, o.trang), {
    pageSetup: { paperSize: 9, orientation: o.cot.length > 6 ? "landscape" : "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.6, right: 0.4, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 } },
    views: [{ state: "frozen", ySplit: 6 }],
  });
  const n = o.cot.length;
  const dong = (v: string, cao: number, f: Partial<ExcelJS.Font>, canh: "center" | "left" = "center") => {
    const r = ws.addRow([v]);
    ws.mergeCells(r.number, 1, r.number, n);
    r.getCell(1).font = { name: FONT, size: 12, ...f };
    r.getCell(1).alignment = { horizontal: canh, vertical: "middle", wrapText: true };
    r.height = cao;
    return r;
  };
  dong(o.coQuan.toUpperCase(), 18, { bold: true });
  dong(o.tieuDe.toUpperCase(), 24, { bold: true, size: 14 });
  dong(o.yeuCau, 32, { italic: true, size: 11 });
  dong(`(Tổng số: ${o.nhom.reduce((s, g) => s + g.dong.length, 0)} · lập lúc ${fmtDateTime(new Date())})`, 16, { italic: true, size: 10, color: { argb: "FF475569" } });
  ws.addRow([]);
  const h = ws.addRow(o.cot.map((c) => c.h));
  h.height = 32;
  h.eachCell((c) => {
    c.font = { name: FONT, size: 12, bold: true };
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
    c.border = vien;
  });
  const coNhom = o.nhom.length > 1 || (o.nhom.length === 1 && o.nhom[0].ten);
  let stt = 0;
  o.nhom.forEach((g, gi) => {
    if (coNhom) {
      const r = ws.addRow([`${LA_MA[gi] || gi + 1}. ${g.ten} (${g.dong.length})`]);
      ws.mergeCells(r.number, 1, r.number, n);
      r.getCell(1).font = { name: FONT, size: 12, bold: true };
      r.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
      for (let i = 1; i <= n; i++) r.getCell(i).border = vien;
    }
    for (const d of g.dong) {
      const r = ws.addRow([++stt, ...d.map((x) => (x == null ? "" : x))]);
      r.eachCell({ includeEmpty: true }, (c, i) => {
        c.font = { name: FONT, size: 12 };
        c.alignment = { vertical: "top", wrapText: true, horizontal: i === 1 || o.cot[i - 1]?.giua ? "center" : "left" };
        c.border = vien;
      });
    }
  });
  o.cot.forEach((c, i) => (ws.getColumn(i + 1).width = c.w));
  ws.headerFooter.oddFooter = "&C&\"Times New Roman\"&10Trang &P/&N";
  return ws;
}

/** Chia danh sách thành nhóm theo yêu cầu “theo từng đơn vị / lĩnh vực / cán bộ…” */
function chiaNhom<T>(ds: T[], khoa: ((x: T) => string) | null, dong: (x: T) => O[]): Nhom[] {
  if (!khoa) return [{ ten: "", dong: ds.map(dong) }];
  const m = new Map<string, T[]>();
  for (const x of ds) {
    const k = khoa(x) || "Khác";
    m.set(k, [...(m.get(k) || []), x]);
  }
  return [...m.entries()].map(([ten, xs]) => ({ ten, dong: xs.map(dong) }));
}

const DANH_GIA: Record<string, string> = { xanh: "Đúng tiến độ", vang: "Chậm tiến độ", do: "Có nguy cơ không đạt", xam: "Chưa có số liệu" };

export async function GET(req: Request) {
  const user = await apiUser("bc.tra_cuu");
  if (user instanceof Response) return user;
  if (!user.quyen.includes("bc.xuat")) return new Response("Tài khoản chưa được phân quyền xuất báo cáo", { status: 403 });
  const q = (new URL(req.url).searchParams.get("q") || "").slice(0, 300);
  const kq: KetQuaTraCuu = await traCuu(user, q);
  const cfg = await getSettings();
  const coQuan = cfg.ten_don_vi || "Ủy ban nhân dân";
  const yeuCau = `Theo yêu cầu: “${q}”${kq.bo_loc.hieu.length ? ` — ${kq.bo_loc.hieu.filter((h) => !h.startsWith("Tìm trong toàn bộ")).slice(0, 6).join("; ")}` : ""}`;
  const nhomTheo = kq.bo_loc.nhom_theo;
  const wb = new ExcelJS.Workbook();
  wb.creator = "QLCV Nghị quyết 57-NQ/TW";

  // ---- Chỉ tiêu ----
  if (kq.chi_tieu?.ds.length) {
    const ds = kq.chi_tieu.ds;
    const khoa = nhomTheo === "don_vi" ? (k: (typeof ds)[number]) => k.ten_don_vi || k.don_vi_con || "Chưa giao đơn vị" : nhomTheo === "nguoi" ? (k: (typeof ds)[number]) => k.ten_phu_trach || "Chưa có người thực hiện" : nhomTheo === "linh_vuc" ? (k: (typeof ds)[number]) => k.linh_vuc || "Chưa phân lĩnh vực" : null;
    danhSach(wb, {
      trang: "Danh sach chi tieu",
      coQuan,
      tieuDe: `Danh sách chỉ tiêu năm ${kq.chi_tieu.nam}`,
      yeuCau,
      cot: [
        { h: "STT", w: 6, giua: true },
        { h: "Tên chỉ tiêu", w: 46 },
        { h: "Đơn vị thực hiện", w: 30 },
        { h: "Người theo dõi", w: 22 },
        { h: "Người thực hiện", w: 22 },
        { h: "Thời gian hoàn thành", w: 14, giua: true },
        { h: "Tiến độ", w: 26 },
        { h: "Ghi chú", w: 30 },
      ],
      nhom: chiaNhom(ds, khoa, (k) => [
        k.ten,
        k.ten_don_vi || k.don_vi_con || "",
        k.ten_lanh_dao,
        k.ten_phu_trach || k.nguoi_con,
        fmtDate(k.han),
        `${fmtNum(k.thuc_hien)}/${Number(k.ke_hoach_nam) ? fmtNum(k.ke_hoach_nam) : "—"} ${k.don_vi_tinh}${k.pct == null ? "" : ` (${fmtNum(k.pct, 1)}%)`} — ${DANH_GIA[k.mau]}`,
        [k.cho_xac_nhan ? `${k.cho_xac_nhan} số liệu chờ xác nhận` : "", k.ghi_chu_so_lieu || ""].filter(Boolean).join("; "),
      ]),
    });
  }

  // ---- Công việc ----
  if (kq.cong_viec?.ds.length) {
    const ds = kq.cong_viec.ds;
    const isQua = (t: (typeof ds)[number]) => ["moi_giao", "da_nhan", "dang_thuc_hien"].includes(t.trang_thai) && new Date(t.han) < new Date();
    const khoa =
      nhomTheo === "don_vi"
        ? (t: (typeof ds)[number]) => t.ten_don_vi || "Không thuộc đơn vị"
        : nhomTheo === "nguoi"
          ? (t: (typeof ds)[number]) => t.ten_thuc_hien || t.ten_chu_tri
          : nhomTheo === "linh_vuc"
            ? (t: (typeof ds)[number]) => t.linh_vuc
            : nhomTheo === "thang"
              ? (t: (typeof ds)[number]) => `Tháng ${Number(vnDate(t.han).slice(5, 7))}/${vnDate(t.han).slice(0, 4)}`
              : nhomTheo === "trang_thai"
                ? (t: (typeof ds)[number]) => (isQua(t) ? "Quá hạn" : taskStatusText(t).split(" ")[0])
                : null;
    danhSach(wb, {
      trang: "Danh sach cong viec",
      coQuan,
      tieuDe: "Danh sách công việc",
      yeuCau,
      cot: [
        { h: "STT", w: 6, giua: true },
        { h: "Tên công việc", w: 46 },
        { h: "Đơn vị thực hiện", w: 28 },
        { h: "Người theo dõi", w: 24 },
        { h: "Người thực hiện", w: 24 },
        { h: "Thời hạn", w: 14, giua: true },
        { h: "Thời gian hoàn thành", w: 14, giua: true },
        { h: "Tiến độ", w: 26 },
        { h: "Ghi chú", w: 36 },
      ],
      nhom: chiaNhom(ds, khoa, (t) => [
        t.ten,
        t.ten_don_vi,
        [t.ten_nguoi_giao, t.nguoi_theo_doi].filter(Boolean).join(", "),
        [t.ten_thuc_hien || t.ten_chu_tri, t.nguoi_phoi_hop && `phối hợp: ${t.nguoi_phoi_hop}`].filter(Boolean).join("; "),
        fmtDue(t.han, t.han_co_gio),
        t.ngay_hoan_thanh ? fmtDate(t.ngay_hoan_thanh) : "",
        taskStatusText(t),
        [t.ket_qua && `Kết quả: ${t.ket_qua}`, t.so_hieu_vb && `Văn bản: ${t.so_hieu_vb}`, t.cuoc_hop && `Họp: ${t.cuoc_hop}`].filter(Boolean).join("; "),
      ]),
    });
  }

  // ---- Dữ liệu các module: cột theo các trường hiển thị của module ----
  for (const b of kq.ban_ghi) {
    const cotMd = b.truong.filter((f) => f.hien_danh_sach).slice(0, 8);
    const cotKhac = b.truong.filter((f) => !cotMd.includes(f));
    danhSach(wb, {
      trang: b.mo_dun.ten,
      coQuan,
      tieuDe: `Danh sách ${b.mo_dun.ten}`,
      yeuCau,
      cot: [{ h: "STT", w: 6, giua: true }, ...cotMd.map((f) => ({ h: f.ten, w: f.kieu === "doan_van" ? 40 : 22 })), { h: "Đơn vị", w: 24 }, { h: "Ghi chú", w: 34 }],
      nhom: chiaNhom(b.ds, nhomTheo === "don_vi" ? (r) => r.don_vi || "Không thuộc đơn vị" : null, (r) => [
        ...cotMd.map((f) => r.gia_tri[f.khoa]),
        r.don_vi,
        cotKhac
          .map((f) => (r.gia_tri[f.khoa] ? `${f.ten}: ${r.gia_tri[f.khoa]}` : ""))
          .filter(Boolean)
          .join("; "),
      ]),
    });
  }

  // ---- Cán bộ ----
  if (kq.can_bo.length)
    danhSach(wb, {
      trang: "Danh sach can bo",
      coQuan,
      tieuDe: "Danh sách cán bộ",
      yeuCau,
      cot: [
        { h: "STT", w: 6, giua: true },
        { h: "Họ và tên", w: 26 },
        { h: "Chức vụ", w: 26 },
        { h: "Đơn vị", w: 32 },
        { h: "Số điện thoại", w: 14, giua: true },
        { h: "Ghi chú", w: 34 },
      ],
      nhom: chiaNhom(kq.can_bo, nhomTheo === "don_vi" ? (p) => p.don_vi || "Chưa có đơn vị" : null, (p) => [
        p.ho_ten,
        [p.chuc_vu, p.chuc_vu_dang].filter(Boolean).join("; "),
        p.don_vi,
        p.sdt,
        p.kiem_nhiem ? `Kiêm nhiệm: ${p.kiem_nhiem}` : "",
      ]),
    });

  // ---- Đơn vị ----
  if (kq.don_vi.length)
    danhSach(wb, {
      trang: "Danh sach don vi",
      coQuan,
      tieuDe: "Danh sách đơn vị",
      yeuCau,
      cot: [
        { h: "STT", w: 6, giua: true },
        { h: "Tên đơn vị", w: 40 },
        { h: "Người đứng đầu", w: 26 },
        { h: "Số cán bộ", w: 10, giua: true },
        { h: "Ghi chú", w: 24 },
      ],
      nhom: chiaNhom(kq.don_vi, null, (d) => [d.ten, d.nguoi_dung_dau, d.so_can_bo, ""]),
    });

  if (!wb.worksheets.length)
    danhSach(wb, { trang: "Danh sach", coQuan, tieuDe: "Danh sách", yeuCau, cot: [{ h: "STT", w: 6 }, { h: "Nội dung", w: 60 }], nhom: [{ ten: "", dong: [["Không có nội dung phù hợp"]] }] });

  const loai = kq.chi_tieu?.ds.length && !kq.cong_viec?.ds.length ? "chi_tieu" : kq.cong_viec?.ds.length && !kq.chi_tieu?.ds.length && !kq.ban_ghi.length ? "cong_viec" : "tra_cuu";
  return toResponse(wb, `Danh_sach_${loai}_${vnDate()}.xlsx`);
}
