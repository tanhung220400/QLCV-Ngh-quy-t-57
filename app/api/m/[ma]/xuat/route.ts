import ExcelJS from "exceljs";
import { apiUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { loadModule, lookups, recordRights, recordScope, showValue, type BanGhi } from "@/lib/records";
import { KIEU_TRUONG, slugify } from "@/lib/modules";
import { styleHeader, toResponse, borderAll } from "@/lib/excel";
import { fmtDate, vnDate } from "@/lib/time";

export async function GET(req: Request, { params }: { params: Promise<{ ma: string }> }) {
  const user = await apiUser();
  if (user instanceof Response) return user;
  const { ma } = await params;
  const sql = await db();
  const mod = await loadModule(sql, decodeURIComponent(ma));
  if (!mod || mod.m.loai !== "du_lieu") return new Response("Không tìm thấy module", { status: 404 });
  const { m, fields } = mod;
  if (!recordRights(user, m).xem) return new Response("Không có quyền", { status: 403 });
  const sp = new URL(req.url).searchParams;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(m.ten.slice(0, 31).replace(/[\\/?*[\]:]/g, " "));
  const lk = await lookups(sql);

  if (sp.get("mau")) {
    ws.columns = fields.map((f) => ({ header: f.ten + (f.bat_buoc ? " *" : ""), key: f.khoa, width: Math.max(14, Math.min(40, f.ten.length + 4)) }));
    styleHeader(ws);
    // dòng hướng dẫn kiểu dữ liệu ở trang tính thứ hai
    const g = wb.addWorksheet("Huong dan");
    g.columns = [
      { header: "Cột", key: "c", width: 34 },
      { header: "Kiểu", key: "k", width: 26 },
      { header: "Giá trị hợp lệ", key: "v", width: 70 },
    ];
    styleHeader(g);
    for (const f of fields)
      g.addRow({
        c: f.ten + (f.bat_buoc ? " (bắt buộc)" : ""),
        k: KIEU_TRUONG[f.kieu] || f.kieu,
        v:
          f.kieu === "lua_chon" || f.kieu === "nhieu_lua_chon"
            ? f.tuy_chon.join("; ") + (f.kieu === "nhieu_lua_chon" ? " (nhiều giá trị cách nhau bằng dấu phẩy)" : "")
            : f.kieu === "don_vi"
              ? lk.units.map((u) => u.ten).join("; ")
              : f.kieu === "linh_vuc"
                ? lk.linhVuc.join("; ")
                : f.kieu === "ngay"
                  ? "dd/mm/yyyy"
                  : f.kieu === "co_khong"
                    ? "Có / Không"
                    : f.kieu === "nguoi"
                      ? "Họ tên cán bộ đúng như trong phần mềm"
                      : "",
      });
    borderAll(g, 1);
    return toResponse(wb, `Mau_nhap_${slugify(m.ten)}.xlsx`);
  }

  const scope = (await recordScope(sql, user, m)).q;
  const q = (sp.get("q") || "").trim();
  const loc = sp.get("loc") || "";
  const pick = fields.find((f) => f.kieu === "lua_chon");
  const rows = (await sql`SELECT bg.*, n.ho_ten AS nguoi_tao FROM mo_dun_ban_ghi bg LEFT JOIN nguoi_dung n ON n.id = bg.id_nguoi_tao
    WHERE bg.id_mo_dun = ${m.id} AND (${scope})
    ${q ? sql`AND bo_dau(bg.du_lieu::text) ILIKE ${"%" + q.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase() + "%"}` : sql``}
    ${loc && pick ? sql`AND coalesce(bg.du_lieu->>${pick.khoa}, 'Chưa nhập') = ${loc}` : sql``}
    ORDER BY bg.id`) as unknown as BanGhi[];
  ws.columns = [
    { header: "STT", key: "_stt", width: 6 },
    ...fields.map((f) => ({ header: f.ten, key: f.khoa, width: Math.max(12, Math.min(45, f.ten.length + 4)) })),
    { header: "Người nhập", key: "_nguoi", width: 22 },
    { header: "Cập nhật", key: "_ngay", width: 12 },
  ];
  styleHeader(ws);
  rows.forEach((r, i) => {
    const o: Record<string, unknown> = { _stt: i + 1, _nguoi: r.nguoi_tao || "", _ngay: fmtDate(r.cap_nhat_luc) };
    for (const f of fields) o[f.khoa] = f.kieu === "so" && typeof r.du_lieu[f.khoa] === "number" ? r.du_lieu[f.khoa] : showValue(f, r.du_lieu[f.khoa], lk);
    ws.addRow(o);
  });
  const sums = fields.filter((f) => f.kieu === "so");
  if (rows.length && sums.length) {
    const o: Record<string, unknown> = { _stt: "", [fields[0].khoa]: "Tổng cộng" };
    for (const f of sums) o[f.khoa] = rows.reduce((a, r) => a + (Number(r.du_lieu[f.khoa]) || 0), 0);
    ws.addRow(o).font = { bold: true };
  }
  borderAll(ws, 1);
  return toResponse(wb, `${slugify(m.ten)}_${vnDate()}.xlsx`);
}
