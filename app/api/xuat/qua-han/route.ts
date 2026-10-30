import ExcelJS from "exceljs";
import { apiUser } from "@/lib/auth";
import { queryTasks } from "@/lib/taskQuery";
import { styleHeader, toResponse, borderAll } from "@/lib/excel";
import { fmtDue, fmtDate, workingDaysUntil } from "@/lib/time";
import { getHolidays } from "@/lib/settings";

export async function GET() {
  const user = await apiUser("bc.xuat");
  if (user instanceof Response) return user;
  const tasks = await queryTasks(user, { tab: "qua_han", con: "1" }, 5000);
  const hol = await getHolidays();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Qua han theo don vi");
  ws.columns = [
    { header: "STT", key: "stt", width: 6 },
    { header: "Nhiệm vụ", key: "ten", width: 55 },
    { header: "Người chủ trì", key: "ct", width: 24 },
    { header: "Người giao", key: "ng", width: 22 },
    { header: "Hạn", key: "han", width: 16 },
    { header: "Số ngày làm việc quá hạn", key: "n", width: 14 },
    { header: "Tiến độ", key: "pt", width: 10 },
  ];
  styleHeader(ws);
  const byUnit = new Map<string, typeof tasks>();
  for (const t of tasks) {
    const k = t.ten_don_vi || "Không thuộc đơn vị";
    byUnit.set(k, [...(byUnit.get(k) || []), t]);
  }
  for (const [unit, list] of byUnit) {
    const r = ws.addRow({ ten: `${unit} (${list.length} việc)` });
    r.font = { bold: true };
    r.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEE2E2" } };
    list.sort((a, b) => +new Date(a.han) - +new Date(b.han)).forEach((t, i) =>
      ws.addRow({ stt: i + 1, ten: t.ten, ct: t.ten_chu_tri, ng: t.ten_nguoi_giao, han: fmtDue(t.han, t.han_co_gio), n: Math.max(1, -workingDaysUntil(t.han, hol)), pt: `${t.phan_tram}%` }),
    );
  }
  borderAll(ws, 1);
  return toResponse(wb, `Nhiem_vu_qua_han_${fmtDate(new Date()).replace(/\//g, "-")}.xlsx`);
}
