import { requirePerm } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { meetingData, taskStatusText } from "@/lib/reports";
import { PrintDoc, PTable } from "@/components/PrintDoc";
import { fmtDue } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function PrintMeeting({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const user = await requirePerm("bc.xuat");
  const cfg = await getSettings();
  const rows = await meetingData(user, sp.ten || "");
  const xong = rows.filter((r) => r.trang_thai === "hoan_thanh").length;
  return (
    <PrintDoc cfg={cfg} kyThay={sp.nguoi_ky === "thay"} title="Kết luận họp" sub={`Kết quả thực hiện kết luận tại ${sp.ten || ""}`}>
      <p className="indent-8">
        Tổng số nhiệm vụ: {rows.length}; đã hoàn thành: {xong}; đang thực hiện: {rows.length - xong}.
      </p>
      <PTable head={["STT", "Nội dung kết luận", "Chủ trì", "Hạn", "Kết quả"]} rows={rows.map((r, i) => [i + 1, r.ten, [r.chu_tri, r.don_vi].filter(Boolean).join(" - "), fmtDue(r.han, r.han_co_gio), taskStatusText(r) + (r.ket_qua ? `. ${r.ket_qua}` : "")])} />
    </PrintDoc>
  );
}
