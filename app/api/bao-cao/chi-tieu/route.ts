import { apiUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { kpiReportData, kpiRowText } from "@/lib/reports";
import { header, signature, p, table, docResponse, tieuDe } from "@/lib/word";
import { vnDate } from "@/lib/time";

const KY: Record<string, string> = { thang: "tháng", quy: "quý", "6thang": "6 tháng", nam: "năm" };

export async function GET(req: Request) {
  const user = await apiUser("bc.xuat");
  if (user instanceof Response) return user;
  const u = new URL(req.url);
  const nam = Number(u.searchParams.get("nam")) || Number(vnDate().slice(0, 4));
  const ky = u.searchParams.get("ky") || "thang";
  const cfg = await getSettings();
  const kpis = await kpiReportData(user, nam);
  const groups = [...new Set(kpis.map((k) => k.nhom))];
  const m = Number(vnDate().slice(5, 7));
  const kyText = ky === "thang" ? `tháng ${m}` : ky === "quy" ? `quý ${Math.ceil(m / 3)}` : ky === "6thang" ? "6 tháng đầu năm" : "năm";
  const dat = kpis.filter((k) => k.pct != null && k.pct >= 100).length;
  const ngc = kpis.filter((k) => k.nguy_co).length;
  const rows: (string | number)[][] = [];
  let i = 0;
  for (const g of groups) {
    rows.push(["", g.toUpperCase(), "", "", "", "", ""]);
    for (const k of kpis.filter((x) => x.nhom === g)) {
      const r = kpiRowText(k);
      rows.push([++i, r.ten, r.dvt, r.kh, r.th, r.pct, r.danh_gia]);
    }
  }
  const body = [
    ...header(cfg, { ngang: true }),
    ...tieuDe("Báo cáo", `Kết quả thực hiện các chỉ tiêu ${kyText} năm ${nam}`, true),
    p(`Tổng số ${kpis.length} chỉ tiêu; đã đạt và vượt: ${dat}; có nguy cơ không đạt: ${ngc}. Số liệu đã được trưởng đơn vị xác nhận tính đến ngày ${vnDate().split("-").reverse().join("/")}.`, { indent: true }),
    table(["STT", "Chỉ tiêu", "ĐVT", "Kế hoạch năm", "Thực hiện", "% KH", "Đánh giá"], rows, [6, 40, 9, 12, 12, 9, 12]),
    p("", { after: 240 }),
    signature(cfg, new URL(req.url).searchParams.get("nguoi_ky") === "thay"),
  ];
  void KY;
  return docResponse(body, `Bao_cao_chi_tieu_${kyText.replace(/\s/g, "_")}_${nam}.docx`, true);
}
