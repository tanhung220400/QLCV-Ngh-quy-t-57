import Link from "next/link";
import { TRANG_THAI, UU_TIEN } from "@/lib/const";
import { dueColor, MAU_CLASS, MAU_VIEN, onTime, type TaskListItem } from "@/lib/tasks";
import { fmtDue, fmtDate } from "@/lib/time";

export function StatusChip({ s }: { s: string }) {
  const cls: Record<string, string> = {
    moi_giao: "border-sky-300 bg-sky-50 text-sky-800",
    da_nhan: "border-indigo-300 bg-indigo-50 text-indigo-800",
    dang_thuc_hien: "border-blue-300 bg-blue-50 text-blue-800",
    cho_duyet: "border-violet-300 bg-violet-50 text-violet-800",
    hoan_thanh: "border-slate-300 bg-slate-100 text-slate-700",
    tra_lai: "border-orange-300 bg-orange-50 text-orange-800",
    tam_dung: "border-slate-300 bg-white text-slate-600",
    huy: "border-slate-300 bg-white text-slate-500 line-through",
  };
  return <span className={`chip ${cls[s] || ""}`}>{TRANG_THAI[s] || s}</span>;
}

export function PriorityChip({ p }: { p: string }) {
  if (p === "thuong") return null;
  return <span className={`chip ${p === "hoa_toc" ? "border-red-600 bg-red-600 text-white" : "border-orange-400 bg-orange-100 text-orange-800"}`}>{UU_TIEN[p]}</span>;
}

export function DueChip({ t, holidays, nguong }: { t: { trang_thai: string; han: Date; ngay_hoan_thanh: Date | null }; holidays: Set<string>; nguong: number }) {
  const c = dueColor(t, holidays, nguong);
  let label = c.nhan;
  if (t.trang_thai === "hoan_thanh") {
    const ok = onTime(t);
    label = ok ? "Đúng hạn" : "Trễ hạn";
  }
  return <span className={`chip ${MAU_CLASS[c.mau]}`}>{label}</span>;
}

export function ProgressBar({ value, className = "" }: { value: number; className?: string }) {
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full bg-slate-200 ${className}`} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-brand-600" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function TaskCard({ t, holidays, nguong }: { t: TaskListItem; holidays: Set<string>; nguong: number }) {
  const c = dueColor(t, holidays, nguong);
  return (
    <Link href={`/viec/${t.id}`} className={`card block border-l-4 ${MAU_VIEN[c.mau]} transition hover:shadow-md`}>
      <div className="flex flex-wrap items-center gap-1.5">
        <PriorityChip p={t.uu_tien} />
        <StatusChip s={t.trang_thai} />
        <DueChip t={t} holidays={holidays} nguong={nguong} />
        {t.cho_gia_han && <span className="chip border-amber-400 bg-amber-50 text-amber-900">Xin gia hạn</span>}
      </div>
      <h3 className="mt-2 text-lg leading-snug font-semibold">{t.ten}</h3>
      <div className="mt-1 grid gap-x-4 gap-y-0.5 text-[15px] text-slate-600 sm:grid-cols-2">
        <div>
          Chủ trì: <b className="text-slate-800">{t.ten_chu_tri}</b>
          {t.ten_don_vi ? ` · ${t.ten_don_vi}` : ""}
        </div>
        <div>
          Hạn: <b className="text-slate-800">{fmtDue(t.han, t.han_co_gio)}</b>
          {t.ngay_hoan_thanh ? ` · xong ${fmtDate(t.ngay_hoan_thanh)}` : ""}
        </div>
        {t.ten_thuc_hien && <div>Thực hiện: {t.ten_thuc_hien}</div>}
        <div>Giao: {t.ten_nguoi_giao}</div>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <ProgressBar value={t.phan_tram} />
        <span className="w-12 text-right text-sm font-semibold text-slate-700">{t.phan_tram}%</span>
      </div>
      {t.so_viec_con > 0 && <div className="mt-1 text-sm text-slate-500">{t.so_viec_con} việc con</div>}
    </Link>
  );
}
