import ExcelJS from "exceljs";
import { getUser } from "@/lib/auth";
import { kpiReportData, kpiRowText } from "@/lib/reports";
import { styleHeader, toResponse, borderAll } from "@/lib/excel";
import { vnDate } from "@/lib/time";

export async function GET(req: Request) {
  const user = await getUser();
  if (!user) return new Response("Chưa đăng nhập", { status: 401 });
  const nam = Number(new URL(req.url).searchParams.get("nam")) || Number(vnDate().slice(0, 4));
  const kpis = await kpiReportData(user, nam);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(`Chi tieu ${nam}`);
  ws.columns = [
    { header: "STT", key: "stt", width: 6 },
    { header: "Chỉ tiêu", key: "ten", width: 50 },
    { header: "Nhóm", key: "nhom", width: 20 },
    { header: "ĐVT", key: "dvt", width: 10 },
    { header: "Kế hoạch năm", key: "kh", width: 12 },
    { header: "Thực hiện", key: "th", width: 12 },
    { header: "% kế hoạch", key: "pct", width: 10 },
    { header: "Lẽ ra phải đạt", key: "le_ra", width: 10 },
    { header: "Đánh giá", key: "danh_gia", width: 18 },
    { header: "Phụ trách", key: "phu_trach", width: 26 },
  ];
  styleHeader(ws);
  kpis.forEach((k, i) => ws.addRow({ stt: i + 1, nhom: k.nhom, ...kpiRowText(k) }));
  borderAll(ws, 1);
  return toResponse(wb, `Ket_qua_chi_tieu_${nam}.xlsx`);
}
