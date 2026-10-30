import { apiUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { meetingData, taskStatusText } from "@/lib/reports";
import { header, signature, p, table, docResponse } from "@/lib/word";
import { fmtDue } from "@/lib/time";

export async function GET(req: Request) {
  const user = await apiUser("bc.xuat");
  if (user instanceof Response) return user;
  const ten = new URL(req.url).searchParams.get("ten") || "";
  const cfg = await getSettings();
  const rows = await meetingData(user, ten);
  const xong = rows.filter((r) => r.trang_thai === "hoan_thanh").length;
  const body = [
    ...header(cfg),
    p("BÁO CÁO", { bold: true, align: "center", size: 14, before: 240, after: 0 }),
    p(`Kết quả thực hiện kết luận tại ${ten}`, { bold: true, align: "center", size: 14, after: 240 }),
    p(`Tổng số nhiệm vụ: ${rows.length}; đã hoàn thành: ${xong}; đang thực hiện: ${rows.length - xong}.`, { indent: true }),
    table(["STT", "Nội dung kết luận", "Chủ trì", "Hạn", "Kết quả"], rows.map((r, i) => [i + 1, r.ten, [r.chu_tri, r.don_vi].filter(Boolean).join(" - "), fmtDue(r.han, r.han_co_gio), taskStatusText(r) + (r.ket_qua ? `. ${r.ket_qua}` : "")]), [7, 38, 20, 12, 23]),
    p("", { after: 240 }),
    signature(cfg),
  ];
  return docResponse(body, `Ket_luan_hop.docx`);
}
