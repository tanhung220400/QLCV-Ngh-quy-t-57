import ExcelJS from "exceljs";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { taskScope, kpiScope } from "@/lib/perm";
import { personStats } from "@/lib/stats";
import { loadKpis } from "@/lib/kpi";
import { getSettings } from "@/lib/settings";
import { styleHeader, toResponse, borderAll } from "@/lib/excel";
import { fromVN, vnDate } from "@/lib/time";

export async function GET(req: Request) {
  const user = await getUser();
  if (!user) return new Response("Chưa đăng nhập", { status: 401 });
  const u = new URL(req.url);
  const tu = u.searchParams.get("tu") || `${vnDate().slice(0, 4)}-01-01`;
  const den = u.searchParams.get("den") || vnDate();
  const sql = await db();
  const rows = await personStats(sql, (await taskScope(sql, user)).q, fromVN(tu, "00:00"), fromVN(den, "23:59"));
  const cfg = await getSettings();
  const kpis = await loadKpis(sql, (await kpiScope(sql, user)).q, cfg.nguong_nguy_co, Number(den.slice(0, 4)));
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Ket qua ca nhan");
  ws.addRow([`SỐ LIỆU KẾT QUẢ CÔNG VIỆC CÁ NHÂN (việc có hạn từ ${tu.split("-").reverse().join("/")} đến ${den.split("-").reverse().join("/")})`]).font = { bold: true, size: 13 };
  ws.addRow(["Phần mềm chỉ cung cấp số liệu; việc đánh giá, xếp loại do cấp có thẩm quyền quyết định."]).font = { italic: true };
  ws.addRow([]);
  const head = ["STT", "Họ tên", "Chức vụ", "Đơn vị", "Số việc được giao", "Đã hoàn thành", "Hoàn thành đúng hạn", "Tỷ lệ đúng hạn (%)", "Số lần xin gia hạn", "Số lần bị yêu cầu làm lại", "Số ngày quá hạn trung bình", "Đang quá hạn", "Số chỉ tiêu phụ trách", "% hoàn thành chỉ tiêu (bình quân)"];
  ws.addRow(head);
  styleHeader(ws, 4);
  rows.forEach((r, i) => {
    const mine = kpis.filter((k) => k.id_phu_trach === r.id && k.pct != null);
    const avg = mine.length ? mine.reduce((s, k) => s + Math.min(100, k.pct!), 0) / mine.length : null;
    ws.addRow([i + 1, r.ho_ten, r.chuc_vu, r.don_vi, r.duoc_giao, r.hoan_thanh, r.dung_han, r.duoc_giao ? Math.round((r.dung_han * 1000) / r.duoc_giao) / 10 : 0, r.gia_han, r.lam_lai, Math.round(r.tb_ngay_qua_han * 10) / 10, r.dang_qua_han, mine.length, avg == null ? "" : Math.round(avg * 10) / 10]);
  });
  [6, 22, 24, 26, 10, 10, 10, 10, 10, 10, 10, 10, 10, 12].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  borderAll(ws, 4);
  return toResponse(wb, `So_lieu_danh_gia_ca_nhan_${tu}_${den}.xlsx`);
}
