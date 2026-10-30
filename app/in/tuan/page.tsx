import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { weeklyData, weekRange } from "@/lib/reports";
import { PrintDoc, PTable } from "@/components/PrintDoc";
import { fmtDate, fmtDue } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function PrintWeek({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const cfg = await getSettings();
  const { tu, den } = weekRange(sp.tu, sp.den);
  const d = await weeklyData(user, tu, den);
  const pct = d.done.length ? Math.round((d.onTime * 100) / d.done.length) : 0;
  const f = (s: string) => s.split("-").reverse().join("/");
  return (
    <PrintDoc cfg={cfg} title="Báo cáo tuần" sub={`Tình hình thực hiện nhiệm vụ tuần từ ${f(tu)} đến ${f(den)}`}>
      <p className="font-bold">I. KẾT QUẢ THỰC HIỆN</p>
      <p className="indent-8">
        Trong tuần, lãnh đạo xã giao mới {d.giaoMoi} nhiệm vụ. Các đơn vị hoàn thành {d.done.length} nhiệm vụ, trong đó {d.onTime} nhiệm vụ đúng hạn (đạt {pct}%). Hiện có {d.dangLam} nhiệm vụ đang thực hiện, {d.overdue.length} nhiệm vụ quá hạn chưa hoàn thành.
      </p>
      <p className="font-bold italic">1. Nhiệm vụ đã hoàn thành trong tuần</p>
      {d.done.length ? <PTable head={["STT", "Nhiệm vụ", "Chủ trì", "Hạn", "Hoàn thành"]} rows={d.done.map((x, i) => [i + 1, x.ten, [x.chu_tri, x.don_vi].filter(Boolean).join(" - "), fmtDue(x.han, x.han_co_gio), `${fmtDate(x.ngay_hoan_thanh)}${x.dung_han ? "" : " (trễ)"}`])} /> : <p className="italic">Không có.</p>}
      <p className="font-bold italic">2. Nhiệm vụ quá hạn chưa hoàn thành</p>
      {d.overdue.length ? <PTable head={["STT", "Nhiệm vụ", "Chủ trì", "Hạn", "Số ngày quá hạn", "Tiến độ"]} rows={d.overdue.map((x, i) => [i + 1, x.ten, [x.chu_tri, x.don_vi].filter(Boolean).join(" - "), fmtDue(x.han, x.han_co_gio), x.so_ngay, `${x.phan_tram}%`])} /> : <p className="italic">Không có.</p>}
      <p className="font-bold">II. NHIỆM VỤ ĐẾN HẠN TUẦN TỚI</p>
      {d.upcoming.length ? <PTable head={["STT", "Nhiệm vụ", "Chủ trì", "Hạn"]} rows={d.upcoming.map((x, i) => [i + 1, x.ten, [x.chu_tri, x.don_vi].filter(Boolean).join(" - "), fmtDue(x.han, x.han_co_gio)])} /> : <p className="italic">Không có.</p>}
      <p className="font-bold">III. KIẾN NGHỊ, ĐỀ XUẤT</p>
      <p className="indent-8">Đề nghị các đơn vị có nhiệm vụ quá hạn khẩn trương hoàn thành, báo cáo kết quả trên phần mềm.</p>
    </PrintDoc>
  );
}
