import ExcelJS from "exceljs";
import { apiUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { kpiPeople, kpiUnits, tongHop, xepLoai, type KpiRow } from "@/lib/kpiDanhGia";
import { kpiViewScope } from "@/lib/kpiScope";
import { styleHeader, toResponse, borderAll } from "@/lib/excel";
import { vnDate } from "@/lib/time";

export async function GET(req: Request) {
  const user = await apiUser();
  if (user instanceof Response) return user;
  const scope = await kpiViewScope(user);
  if (scope === false) return new Response("Tài khoản chưa được phân quyền xem đánh giá KPI", { status: 403 });
  const sp = new URL(req.url).searchParams;
  const nam = Number(sp.get("nam")) || Number(vnDate().slice(0, 4));
  const thang = Number(sp.get("thang")) || 0;
  const quy = thang ? 0 : Number(sp.get("quy")) || 0;
  const dv = Number(sp.get("dv")) || 0;
  const ky = { nam, quy, thang };
  const sql = await db();
  const [units, people] = await Promise.all([kpiUnits(sql, ky, scope), kpiPeople(sql, ky, scope, dv && (scope === null || scope.includes(dv)) ? dv : undefined)]);
  const wb = new ExcelJS.Workbook();
  const cols = (first: string, extra: { header: string; key: string; width: number }[] = []) => [
    { header: "STT", key: "stt", width: 6 },
    { header: first, key: "ten", width: 34 },
    ...extra,
    { header: "Tổng việc", key: "tong", width: 10 },
    { header: "Vượt tiến độ", key: "som", width: 11 },
    { header: "Đúng hạn", key: "dung", width: 10 },
    { header: "Trễ hạn", key: "tre", width: 10 },
    { header: "Đang quá hạn", key: "qua_han", width: 11 },
    { header: "Tồn việc", key: "ton", width: 10 },
    { header: "Đang làm nhanh", key: "nhanh", width: 11 },
    { header: "Đang làm chậm", key: "cham", width: 11 },
    { header: "Số lần gia hạn", key: "gia_han", width: 11 },
    { header: "Tỷ lệ đúng hạn (%)", key: "ty_le", width: 12 },
    { header: "Điểm KPI", key: "diem", width: 10 },
    { header: "Xếp loại", key: "xep_loai", width: 22 },
  ];
  const put = (ws: ExcelJS.Worksheet, rows: KpiRow[], extra: (r: KpiRow) => Record<string, unknown> = () => ({})) => {
    styleHeader(ws);
    rows.forEach((r, i) => ws.addRow({ stt: i + 1, ...r, ...extra(r), ty_le: r.ty_le ?? "", diem: r.diem ?? "", xep_loai: xepLoai(r.diem)?.[1] ?? "Chưa đủ dữ liệu" }));
    const t = tongHop(rows);
    if (rows.length > 1) ws.addRow({ stt: "", ...t, ten: "Tổng cộng", ty_le: t.ty_le ?? "", diem: t.diem ?? "", xep_loai: xepLoai(t.diem)?.[1] ?? "" }).font = { bold: true };
    borderAll(ws, 1);
  };
  const w1 = wb.addWorksheet("Don vi");
  w1.columns = cols("Đơn vị");
  put(w1, units);
  const w2 = wb.addWorksheet("Can bo");
  w2.columns = cols("Cán bộ", [
    { header: "Chức vụ", key: "chuc_vu", width: 22 },
    { header: "Đơn vị", key: "don_vi", width: 26 },
  ]);
  put(w2, people);
  return toResponse(wb, `Danh_gia_KPI_${nam}${quy ? `_Q${quy}` : ""}${thang ? `_T${thang}` : ""}.xlsx`);
}
