import { getUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { weeklyData, weekRange } from "@/lib/reports";
import { header, signature, p, table, docResponse } from "@/lib/word";
import { fmtDate, fmtDue } from "@/lib/time";

export async function GET(req: Request) {
  const user = await getUser();
  if (!user) return new Response("Chưa đăng nhập", { status: 401 });
  const u = new URL(req.url);
  const { tu, den } = weekRange(u.searchParams.get("tu") || "", u.searchParams.get("den") || "");
  const cfg = await getSettings();
  const d = await weeklyData(user, tu, den);
  const pct = d.done.length ? Math.round((d.onTime * 100) / d.done.length) : 0;
  const body = [
    ...header(cfg),
    p("BÁO CÁO", { bold: true, align: "center", size: 14, before: 240, after: 0 }),
    p(`Tình hình thực hiện nhiệm vụ tuần từ ${fmtDate(tu + "T12:00:00+07:00")} đến ${fmtDate(den + "T12:00:00+07:00")}`, { bold: true, align: "center", size: 14, after: 240 }),
    p("I. KẾT QUẢ THỰC HIỆN", { bold: true }),
    p(`Trong tuần, lãnh đạo xã giao mới ${d.giaoMoi} nhiệm vụ. Các đơn vị hoàn thành ${d.done.length} nhiệm vụ, trong đó ${d.onTime} nhiệm vụ đúng hạn (đạt ${pct}%). Hiện có ${d.dangLam} nhiệm vụ đang thực hiện, ${d.overdue.length} nhiệm vụ quá hạn chưa hoàn thành.`, { indent: true }),
    p("1. Nhiệm vụ đã hoàn thành trong tuần", { bold: true, italics: true }),
    d.done.length
      ? table(["STT", "Nhiệm vụ", "Chủ trì", "Hạn", "Hoàn thành"], d.done.map((x, i) => [i + 1, x.ten, [x.chu_tri, x.don_vi].filter(Boolean).join(" - "), fmtDue(x.han, x.han_co_gio), `${fmtDate(x.ngay_hoan_thanh)}${x.dung_han ? "" : " (trễ)"}`]), [7, 45, 22, 13, 13])
      : p("Không có.", { italics: true, indent: true }),
    p("2. Nhiệm vụ quá hạn chưa hoàn thành", { bold: true, italics: true, before: 160 }),
    d.overdue.length
      ? table(["STT", "Nhiệm vụ", "Chủ trì", "Hạn", "Số ngày quá hạn", "Tiến độ"], d.overdue.map((x, i) => [i + 1, x.ten, [x.chu_tri, x.don_vi].filter(Boolean).join(" - "), fmtDue(x.han, x.han_co_gio), x.so_ngay, `${x.phan_tram}%`]), [7, 40, 22, 11, 10, 10])
      : p("Không có.", { italics: true, indent: true }),
    p("II. NHIỆM VỤ ĐẾN HẠN TUẦN TỚI", { bold: true, before: 160 }),
    d.upcoming.length
      ? table(["STT", "Nhiệm vụ", "Chủ trì", "Hạn"], d.upcoming.map((x, i) => [i + 1, x.ten, [x.chu_tri, x.don_vi].filter(Boolean).join(" - "), fmtDue(x.han, x.han_co_gio)]), [7, 53, 25, 15])
      : p("Không có.", { italics: true, indent: true }),
    p("III. KIẾN NGHỊ, ĐỀ XUẤT", { bold: true, before: 160 }),
    p("Đề nghị các đơn vị có nhiệm vụ quá hạn khẩn trương hoàn thành, báo cáo kết quả trên phần mềm.", { indent: true, after: 240 }),
    signature(cfg),
  ];
  return docResponse(body, `Bao_cao_tuan_${tu}_${den}.docx`);
}
