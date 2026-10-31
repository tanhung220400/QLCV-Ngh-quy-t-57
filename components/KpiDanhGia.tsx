import Link from "next/link";
import { xepLoai, type KpiRow } from "@/lib/kpiDanhGia";

const LOAI_CLS: Record<string, string> = {
  xs: "border-emerald-300 bg-emerald-50 text-emerald-800",
  tot: "border-sky-300 bg-sky-50 text-sky-800",
  ht: "border-amber-300 bg-amber-50 text-amber-900",
  kht: "border-red-300 bg-red-50 text-red-800",
};
const BAR: Record<string, string> = { xs: "#0ca30c", tot: "#2563eb", ht: "#fab219", kht: "#d03b3b" };

export function XepLoai({ diem }: { diem: number | null }) {
  const x = xepLoai(diem);
  if (!x) return <span className="chip border-slate-200 bg-slate-50 text-slate-500">Chưa đủ dữ liệu</span>;
  return <span className={`chip ${LOAI_CLS[x[2]]}`}>{x[1]}</span>;
}

export function DiemKpi({ diem }: { diem: number | null }) {
  const x = xepLoai(diem);
  return (
    <div className="flex min-w-28 items-center gap-2">
      <div className="h-2 flex-1 rounded-full bg-slate-200">
        <div className="h-full rounded-full" style={{ width: `${diem ?? 0}%`, background: x ? BAR[x[2]] : "transparent" }} />
      </div>
      <b className="w-8 text-right tabular-nums text-slate-900">{diem ?? "–"}</b>
    </div>
  );
}

const n = (v: number, cls = "") => (v ? <span className={`font-semibold ${cls}`}>{v}</span> : <span className="text-slate-300">0</span>);

export function KpiTable({ rows, kind, link, total }: { rows: KpiRow[]; kind: "don_vi" | "can_bo"; link: (r: KpiRow) => string; total?: KpiRow }) {
  if (!rows.length) return <div className="card py-10 text-center text-slate-500">Chưa có công việc nào trong kỳ đã chọn.</div>;
  return (
    <div className="card overflow-x-auto p-0 sm:p-0">
      <table className="tbl min-w-[1080px]">
        <thead>
          <tr>
            <th className="w-10">#</th>
            <th>{kind === "don_vi" ? "Đơn vị" : "Cán bộ"}</th>
            <th className="text-right">Tổng việc</th>
            <th className="text-right" title="Hoàn thành trước hạn từ 1 ngày trở lên">
              Vượt tiến độ
            </th>
            <th className="text-right">Đúng hạn</th>
            <th className="text-right">Trễ hạn</th>
            <th className="text-right">Đang quá hạn</th>
            <th className="text-right" title="Việc chưa xong: đang quá hạn + còn hạn">
              Tồn việc
            </th>
            <th className="text-right" title="Việc đang làm, còn hạn: nhanh hơn / chậm hơn so với thời gian đã trôi qua">
              Đang làm nhanh / chậm
            </th>
            <th className="text-right">Tỷ lệ đúng hạn</th>
            <th>Điểm KPI</th>
            <th>Xếp loại</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {rows.map((r, i) => (
            <tr key={r.id ?? i} className={r.qua_han ? "bg-red-50/30" : ""}>
              <td className="text-slate-400">{i + 1}</td>
              <td>
                <Link href={link(r)} className="font-semibold text-brand-700 hover:underline">
                  {r.ten}
                </Link>
                {kind === "can_bo" && <div className="text-sm text-slate-500">{[r.chuc_vu, r.don_vi].filter(Boolean).join(" · ")}</div>}
              </td>
              <td className="text-right font-semibold">{r.tong}</td>
              <td className="text-right">{n(r.som, "text-emerald-700")}</td>
              <td className="text-right">{n(r.dung, "text-slate-800")}</td>
              <td className="text-right">{n(r.tre, "text-orange-700")}</td>
              <td className="text-right">{n(r.qua_han, "text-red-700")}</td>
              <td className="text-right">{n(r.ton, "text-slate-800")}</td>
              <td className="text-right">
                {n(r.nhanh, "text-emerald-700")} / {n(r.cham, "text-orange-700")}
              </td>
              <td className="text-right">{r.ty_le == null ? "–" : `${r.ty_le}%`}</td>
              <td>
                <DiemKpi diem={r.diem} />
              </td>
              <td>
                <XepLoai diem={r.diem} />
              </td>
            </tr>
          ))}
        </tbody>
        {total && rows.length > 1 && (
          <tfoot className="tabular-nums">
            <tr className="bg-slate-50 font-semibold">
              <td></td>
              <td>Tổng cộng</td>
              <td className="text-right">{total.tong}</td>
              <td className="text-right">{total.som}</td>
              <td className="text-right">{total.dung}</td>
              <td className="text-right">{total.tre}</td>
              <td className="text-right">{total.qua_han}</td>
              <td className="text-right">{total.ton}</td>
              <td className="text-right">
                {total.nhanh} / {total.cham}
              </td>
              <td className="text-right">{total.ty_le == null ? "–" : `${total.ty_le}%`}</td>
              <td>
                <DiemKpi diem={total.diem} />
              </td>
              <td>
                <XepLoai diem={total.diem} />
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
