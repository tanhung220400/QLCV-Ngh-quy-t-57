import ExcelJS from "exceljs";
import { apiUser } from "@/lib/auth";
import { traCuu } from "@/lib/tracuuRun";
import { styleHeader, toResponse, borderAll } from "@/lib/excel";
import { TRANG_THAI, LOAI_CHI_TIEU } from "@/lib/const";
import { fmtDue, fmtDate, fmtDateTime } from "@/lib/time";
import { taskStatusText } from "@/lib/reports";
import { fmtNum } from "@/lib/kpi";

export const maxDuration = 60;

/** Tên trang tính hợp lệ (≤ 31 ký tự, không trùng) */
function tenTrang(wb: ExcelJS.Workbook, s: string) {
  const goc = s.replace(/[\\/?*[\]:]/g, " ").slice(0, 28).trim() || "Trang";
  let t = goc;
  let i = 2;
  while (wb.getWorksheet(t)) t = `${goc.slice(0, 26)} ${i++}`;
  return t;
}

/** Thêm một bảng có tiêu đề, kẻ khung, cố định dòng tiêu đề */
function bang(wb: ExcelJS.Workbook, ten: string, tieuDe: string, cot: { h: string; w: number }[], dong: (string | number | null | undefined)[][]) {
  const ws = wb.addWorksheet(tenTrang(wb, ten), { views: [{ state: "frozen", ySplit: 3 }] });
  ws.addRow([tieuDe]).font = { bold: true, size: 13 };
  ws.addRow([`${dong.length} dòng, xếp theo mức độ phù hợp`]).font = { italic: true, color: { argb: "FF64748B" } };
  ws.addRow(cot.map((c) => c.h));
  styleHeader(ws, 3);
  for (const d of dong) ws.addRow(d.map((x) => (x == null ? "" : x)));
  borderAll(ws, 3);
  cot.forEach((c, i) => (ws.getColumn(i + 1).width = c.w));
  ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: cot.length } };
  return ws;
}

export async function GET(req: Request) {
  const user = await apiUser("bc.tra_cuu");
  if (user instanceof Response) return user;
  if (!user.quyen.includes("bc.xuat")) return new Response("Tài khoản chưa được phân quyền xuất báo cáo", { status: 403 });
  const q = (new URL(req.url).searchParams.get("q") || "").slice(0, 300);
  const kq = await traCuu(user, q);
  const base = new URL(req.url).origin;
  const wb = new ExcelJS.Workbook();
  wb.creator = "QLCV Nghị quyết 57-NQ/TW";

  // ---- Trang tổng hợp ----
  const ws = wb.addWorksheet("Tong hop");
  ws.addRow([`KẾT QUẢ TRA CỨU: “${q}”`]).font = { bold: true, size: 14 };
  ws.addRow([`Người tra cứu: ${user.ho_ten} · Thời điểm: ${fmtDateTime(new Date())}`]).font = { italic: true };
  ws.addRow([]);
  ws.addRow(["Phần mềm hiểu câu hỏi là"]).font = { bold: true };
  for (const h of kq.bo_loc.hieu) ws.addRow([`• ${h}`]);
  if (kq.khai_niem.length) {
    ws.addRow([]);
    ws.addRow(["Khái niệm tìm kiếm", "Các cách gọi cùng nghĩa, nội dung liên quan được tìm cùng"]).font = { bold: true };
    for (const k of kq.khai_niem) ws.addRow([k.ten, k.bien.map((b) => b.dau || b.t).join("; ")]);
  }
  ws.addRow([]);
  const h = ws.addRow(["Loại dữ liệu", "Số kết quả"]);
  h.font = { bold: true };
  const tk: [string, number][] = [];
  if (kq.cong_viec) tk.push(["Công việc", kq.cong_viec.ds.length]);
  if (kq.chi_tieu) tk.push([`Chỉ tiêu năm ${kq.chi_tieu.nam}`, kq.chi_tieu.ds.length]);
  for (const b of kq.ban_ghi) tk.push([`Module: ${b.mo_dun.ten}`, b.ds.length]);
  if (kq.can_bo.length) tk.push(["Cán bộ", kq.can_bo.length]);
  if (kq.don_vi.length) tk.push(["Đơn vị", kq.don_vi.length]);
  for (const r of tk) ws.addRow(r);
  ws.addRow(["Tổng cộng", kq.tong_so]).font = { bold: true };
  if (kq.cong_viec) {
    const c = kq.cong_viec.tong;
    ws.addRow([]);
    ws.addRow(["Tình hình công việc", ""]).font = { bold: true };
    for (const [a, b] of [
      ["Tổng số việc", c.tong],
      ["Đang quá hạn", c.qua_han],
      ["Đang làm", c.dang_lam],
      ["Chờ xác nhận kết quả", c.cho_duyet],
      ["Hoàn thành", c.hoan_thanh],
      ["Hoàn thành đúng hạn", c.dung_han],
      ["Hoàn thành trễ hạn", c.tre_han],
    ] as const)
      ws.addRow([a, b]);
    if (kq.cong_viec.nhom.length) {
      ws.addRow([]);
      const r = ws.addRow(["Nhóm", "Tổng", "Quá hạn", "Đang làm", "Hoàn thành", "Đúng hạn"]);
      r.font = { bold: true };
      for (const g of kq.cong_viec.nhom) ws.addRow([g.ten, g.tong, g.qua_han, g.dang_lam, g.hoan_thanh, g.dung_han]);
    }
  }
  if (kq.chi_tieu) {
    const c = kq.chi_tieu.tong;
    ws.addRow([]);
    ws.addRow([`Tình hình chỉ tiêu năm ${kq.chi_tieu.nam}`, ""]).font = { bold: true };
    for (const [a, b] of [
      ["Số chỉ tiêu", c.tong],
      ["Có nguy cơ không đạt", c.do],
      ["Chậm nhẹ", c.vang],
      ["Đúng tiến độ", c.xanh],
      ["Đã đạt kế hoạch năm", c.dat],
      ["Chưa có số liệu", c.xam],
    ] as const)
      ws.addRow([a, b]);
  }
  ws.getColumn(1).width = 48;
  ws.getColumn(2).width = 90;
  ws.getColumn(2).alignment = { wrapText: true, vertical: "top" };

  // ---- Công việc ----
  if (kq.cong_viec?.ds.length)
    bang(
      wb,
      "Cong viec",
      `CÔNG VIỆC (${kq.cong_viec.ds.length})`,
      [
        { h: "STT", w: 6 },
        { h: "Mức phù hợp (%)", w: 10 },
        { h: "Tên công việc", w: 48 },
        { h: "Nội dung, yêu cầu", w: 50 },
        { h: "Nguồn giao", w: 18 },
        { h: "Số hiệu văn bản", w: 18 },
        { h: "Cuộc họp", w: 24 },
        { h: "Lĩnh vực", w: 22 },
        { h: "Ưu tiên", w: 10 },
        { h: "Người giao", w: 22 },
        { h: "Chủ trì", w: 22 },
        { h: "Người thực hiện", w: 22 },
        { h: "Đơn vị", w: 28 },
        { h: "Ngày giao", w: 12 },
        { h: "Hạn", w: 16 },
        { h: "Trạng thái", w: 16 },
        { h: "Tình hình", w: 28 },
        { h: "Tiến độ (%)", w: 9 },
        { h: "Sản phẩm", w: 18 },
        { h: "Kết quả báo cáo", w: 50 },
        { h: "Ngày báo cáo", w: 12 },
        { h: "Người xác nhận kết quả", w: 22 },
        { h: "Ngày xác nhận", w: 12 },
        { h: "Việc nhỏ (checklist)", w: 40 },
        { h: "Trao đổi", w: 50 },
        { h: "Tệp đính kèm", w: 30 },
        { h: "Đoạn khớp nội dung", w: 50 },
        { h: "Từ khớp", w: 24 },
        { h: "Đường dẫn", w: 30 },
      ],
      kq.cong_viec.ds.map((t, i) => [
        i + 1,
        t.diem ?? "",
        t.ten,
        t.mo_ta,
        t.nguon_giao,
        t.so_hieu_vb,
        t.cuoc_hop,
        t.linh_vuc,
        t.uu_tien === "hoa_toc" ? "Hỏa tốc" : t.uu_tien === "khan" ? "Khẩn" : "Thường",
        t.ten_nguoi_giao,
        t.ten_chu_tri,
        t.ten_thuc_hien,
        t.ten_don_vi,
        fmtDate(t.tao_luc),
        fmtDue(t.han, t.han_co_gio),
        TRANG_THAI[t.trang_thai],
        taskStatusText(t),
        t.phan_tram,
        t.san_pham,
        t.ket_qua,
        t.ngay_bao_cao ? fmtDate(t.ngay_bao_cao) : "",
        t.ten_nguoi_xac_nhan,
        t.xac_nhan_luc ? fmtDate(t.xac_nhan_luc) : "",
        t.viec_nho,
        t.binh_luan,
        t.tep,
        t.trich,
        (t.khop || []).join(", "),
        `${base}/viec/${t.id}`,
      ]),
    );

  // ---- Chỉ tiêu ----
  if (kq.chi_tieu?.ds.length)
    bang(
      wb,
      "Chi tieu",
      `CHỈ TIÊU NĂM ${kq.chi_tieu.nam} (${kq.chi_tieu.ds.length})`,
      [
        { h: "STT", w: 6 },
        { h: "Mức phù hợp (%)", w: 10 },
        { h: "Tên chỉ tiêu", w: 50 },
        { h: "Nhóm", w: 20 },
        { h: "Lĩnh vực", w: 22 },
        { h: "Nguồn", w: 20 },
        { h: "Loại", w: 20 },
        { h: "Đơn vị tính", w: 10 },
        { h: "Kế hoạch năm", w: 12 },
        { h: "Thực hiện", w: 12 },
        { h: "% kế hoạch", w: 10 },
        { h: "Lẽ ra phải đạt", w: 10 },
        { h: "Đánh giá", w: 16 },
        { h: "Số liệu chờ xác nhận", w: 10 },
        { h: "Đơn vị phụ trách", w: 28 },
        { h: "Người phụ trách", w: 22 },
        { h: "Lãnh đạo phụ trách", w: 22 },
        { h: "Hạn", w: 12 },
        { h: "Ghi chú số liệu", w: 40 },
        { h: "Đoạn khớp nội dung", w: 40 },
        { h: "Đường dẫn", w: 30 },
      ],
      kq.chi_tieu.ds.map((k, i) => [
        i + 1,
        k.diem ?? "",
        k.ten,
        k.nhom,
        k.linh_vuc,
        k.nguon,
        LOAI_CHI_TIEU[k.loai] || k.loai,
        k.don_vi_tinh,
        Number(k.ke_hoach_nam),
        k.thuc_hien ?? "",
        k.pct == null ? "" : `${fmtNum(k.pct, 1)}%`,
        `${fmtNum(k.pct_le_ra, 0)}%`,
        { xanh: "Đúng tiến độ", vang: "Chậm nhẹ", do: "Có nguy cơ", xam: "Chưa có số liệu" }[k.mau],
        k.cho_xac_nhan,
        k.ten_don_vi || (k.so_phan_ra ? `${k.so_phan_ra} đơn vị` : ""),
        k.ten_phu_trach,
        k.ten_lanh_dao,
        fmtDate(k.han),
        k.ghi_chu_so_lieu,
        k.trich,
        `${base}/chi-tieu/${k.id}`,
      ]),
    );

  // ---- Dữ liệu các module: mỗi module một trang, đủ các trường ----
  for (const b of kq.ban_ghi)
    bang(
      wb,
      b.mo_dun.ten,
      `${b.mo_dun.ten.toUpperCase()} (${b.ds.length})`,
      [{ h: "STT", w: 6 }, { h: "Mức phù hợp (%)", w: 10 }, ...b.truong.map((f) => ({ h: f.ten, w: f.kieu === "doan_van" ? 50 : 24 })), { h: "Đơn vị", w: 26 }, { h: "Người nhập", w: 22 }, { h: "Ngày nhập", w: 12 }, { h: "Từ khớp", w: 24 }, { h: "Đường dẫn", w: 30 }],
      b.ds.map((r, i) => [i + 1, r.diem, ...b.truong.map((f) => r.gia_tri[f.khoa]), r.don_vi, r.nguoi_tao, fmtDate(r.tao_luc), r.khop.join(", "), `${base}/m/${b.mo_dun.ma}/${r.id}`]),
    );

  // ---- Cán bộ, đơn vị ----
  if (kq.can_bo.length)
    bang(
      wb,
      "Can bo",
      `CÁN BỘ (${kq.can_bo.length})`,
      [
        { h: "STT", w: 6 },
        { h: "Họ và tên", w: 26 },
        { h: "Chức vụ chính quyền", w: 26 },
        { h: "Chức vụ Đảng", w: 22 },
        { h: "Đơn vị", w: 30 },
        { h: "Kiêm nhiệm", w: 30 },
        { h: "Lĩnh vực phụ trách", w: 40 },
        { h: "Số điện thoại", w: 14 },
      ],
      kq.can_bo.map((p, i) => [i + 1, p.ho_ten, p.chuc_vu, p.chuc_vu_dang, p.don_vi, p.kiem_nhiem, p.linh_vuc, p.sdt]),
    );
  if (kq.don_vi.length)
    bang(
      wb,
      "Don vi",
      `ĐƠN VỊ (${kq.don_vi.length})`,
      [
        { h: "STT", w: 6 },
        { h: "Tên đơn vị", w: 40 },
        { h: "Người đứng đầu", w: 26 },
        { h: "Số cán bộ", w: 10 },
      ],
      kq.don_vi.map((d, i) => [i + 1, d.ten, d.nguoi_dung_dau, d.so_can_bo]),
    );

  return toResponse(wb, `Ket_qua_tra_cuu_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
