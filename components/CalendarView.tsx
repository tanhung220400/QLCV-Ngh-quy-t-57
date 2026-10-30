import Link from "next/link";
import { vnDate } from "@/lib/time";

const DOT: Record<string, string> = { xanh: "bg-emerald-500", vang: "bg-amber-500", do: "bg-red-600", xam: "bg-slate-400" };
const BG: Record<string, string> = { xanh: "bg-emerald-50 text-emerald-900", vang: "bg-amber-50 text-amber-900", do: "bg-red-50 text-red-900", xam: "bg-slate-100 text-slate-600" };

export function CalendarView({ month, tasks, baseQuery }: { month: string; tasks: { id: number; ten: string; ngay: string; mau: string }[]; baseQuery: string }) {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7; // tuần bắt đầu thứ Hai
  const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  const today = vnDate();
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)];
  while (cells.length % 7) cells.push(null);
  const link = (mm: string) => `${baseQuery}${baseQuery.includes("?") ? "&" : "?"}thang=${mm}`;
  const byDay = (d: string) => tasks.filter((t) => t.ngay === d);

  return (
    <div className="card p-2 sm:p-4">
      <div className="mb-3 flex items-center justify-between">
        <Link href={link(prev)} className="btn btn-outline btn-sm">
          ‹ Tháng trước
        </Link>
        <div className="text-lg font-bold">
          Tháng {m}/{y}
        </div>
        <Link href={link(next)} className="btn btn-outline btn-sm">
          Tháng sau ›
        </Link>
      </div>
      {/* Lưới tháng cho màn hình rộng */}
      <div className="hidden grid-cols-7 gap-1 md:grid">
        {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((d) => (
          <div key={d} className="py-1 text-center text-sm font-semibold text-slate-500">
            {d}
          </div>
        ))}
        {cells.map((d, i) => (
          <div key={i} className={`min-h-24 rounded-lg border p-1 ${d ? "border-slate-200" : "border-transparent"} ${d === today ? "bg-brand-50 ring-2 ring-brand-600" : ""}`}>
            {d && (
              <>
                <div className="text-right text-sm text-slate-500">{Number(d.slice(8))}</div>
                <div className="space-y-0.5">
                  {byDay(d).slice(0, 4).map((t) => (
                    <Link key={t.id} href={`/viec/${t.id}`} className={`block truncate rounded px-1 text-xs ${BG[t.mau]}`} title={t.ten}>
                      {t.ten}
                    </Link>
                  ))}
                  {byDay(d).length > 4 && <div className="text-xs text-slate-500">+{byDay(d).length - 4} việc</div>}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
      {/* Danh sách theo ngày cho điện thoại */}
      <div className="space-y-2 md:hidden">
        {cells
          .filter((d): d is string => !!d && byDay(d).length > 0)
          .map((d) => (
            <div key={d} className={`rounded-xl border border-slate-200 p-2 ${d === today ? "bg-brand-50" : ""}`}>
              <div className="font-semibold">
                {["CN", "T2", "T3", "T4", "T5", "T6", "T7"][new Date(d + "T00:00:00Z").getUTCDay()]}, {d.slice(8)}/{d.slice(5, 7)}
              </div>
              {byDay(d).map((t) => (
                <Link key={t.id} href={`/viec/${t.id}`} className="mt-1 flex items-start gap-2">
                  <span className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${DOT[t.mau]}`} />
                  <span>{t.ten}</span>
                </Link>
              ))}
            </div>
          ))}
        {tasks.length === 0 && <p className="text-center text-slate-500">Không có việc đến hạn trong tháng.</p>}
      </div>
    </div>
  );
}
