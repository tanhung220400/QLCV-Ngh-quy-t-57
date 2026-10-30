import ExcelJS from "exceljs";
import { apiUser } from "@/lib/auth";
import { traCuu } from "@/lib/tracuuRun";
import { styleHeader, toResponse, borderAll } from "@/lib/excel";
import { TRANG_THAI } from "@/lib/const";
import { fmtDue } from "@/lib/time";
import { taskStatusText } from "@/lib/reports";
import { fmtNum } from "@/lib/kpi";

export async function GET(req: Request) {
  const user = await apiUser("bc.tra_cuu");
  if (user instanceof Response) return user;
  if (!user.quyen.includes("bc.xuat")) return new Response("Tài khoản chưa được phân quyền xuất báo cáo", { status: 403 });
  const q = (new URL(req.url).searchParams.get("q") || "").slice(0, 300);
  const kq = await traCuu(user, q);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Ket qua tra cuu");
  ws.addRow([`Kết quả tra cứu: “${q}”`]).font = { bold: true, size: 13 };
  ws.addRow([`Điều kiện: ${kq.bo_loc.hieu.join("; ")}`]).font = { italic: true };
  ws.addRow([]);
  if (kq.loai === "cong_viec") {
    if (kq.nhom.length) {
      ws.addRow(["Nhóm", "Tổng", "Quá hạn", "Đang làm", "Hoàn thành", "Đúng hạn"]);
      styleHeader(ws, ws.rowCount);
      for (const g of kq.nhom) ws.addRow([g.ten, g.tong, g.qua_han, g.dang_lam, g.hoan_thanh, g.dung_han]);
      ws.addRow([]);
    }
    const start = ws.rowCount + 1;
    ws.addRow(["STT", "Công việc", "Chủ trì", "Đơn vị", "Lĩnh vực", "Hạn", "Trạng thái", "Tình hình"]);
    styleHeader(ws, start);
    kq.ds.forEach((t, i) => ws.addRow([i + 1, t.ten, t.ten_thuc_hien || t.ten_chu_tri, t.ten_don_vi || "", t.linh_vuc, fmtDue(t.han, t.han_co_gio), TRANG_THAI[t.trang_thai], taskStatusText(t)]));
    borderAll(ws, start);
  } else {
    const start = ws.rowCount + 1;
    ws.addRow(["STT", "Chỉ tiêu", "Lĩnh vực", "ĐVT", "Kế hoạch năm", "Thực hiện", "% kế hoạch", "Lẽ ra phải đạt", "Phụ trách"]);
    styleHeader(ws, start);
    kq.ds.forEach((k, i) => ws.addRow([i + 1, k.ten, k.linh_vuc || "", k.don_vi_tinh, Number(k.ke_hoach_nam), k.thuc_hien ?? "", k.pct == null ? "" : `${fmtNum(k.pct, 1)}%`, `${fmtNum(k.pct_le_ra, 0)}%`, k.ten_don_vi || k.ten_phu_trach || ""]));
    borderAll(ws, start);
  }
  [6, 50, 22, 22, 22, 16, 16, 30, 26].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  return toResponse(wb, "Ket_qua_tra_cuu.xlsx");
}
