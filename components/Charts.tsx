// Biểu đồ vẽ bằng HTML/SVG thuần, không cần thư viện, nhẹ trên điện thoại.
// Màu trạng thái dùng bảng màu trạng thái cố định: tốt / cảnh báo / nghiêm trọng; luôn có chú thích chữ.
export const STATUS = { good: "#0ca30c", warning: "#fab219", serious: "#ec835a", critical: "#d03b3b" };
const BRAND = "#1d4ed8";

type UnitRow = { ten: string; id: number | null; dung_han: number; tre_han: number; qua_han: number; dang_lam: number };

export function UnitBars({ rows }: { rows: UnitRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.dung_han + r.tre_han + r.qua_han + r.dang_lam));
  const seg = [
    { k: "dung_han", label: "Xong đúng hạn", color: STATUS.good },
    { k: "tre_han", label: "Xong trễ hạn", color: STATUS.serious },
    { k: "qua_han", label: "Đang quá hạn", color: STATUS.critical },
    { k: "dang_lam", label: "Đang làm, còn hạn", color: "#c3c2b7" },
  ] as const;
  if (!rows.length) return <p className="muted">Chưa có dữ liệu.</p>;
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-700">
        {seg.map((s) => (
          <span key={s.k} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <div className="space-y-3">
        {rows.map((r) => {
          const total = r.dung_han + r.tre_han + r.qua_han + r.dang_lam;
          return (
            <div key={r.ten}>
              <div className="flex justify-between text-[15px]">
                <a href={r.id ? `/viec?tab=tat_ca&don_vi=${r.id}` : "/viec?tab=tat_ca"} className="font-medium hover:underline">
                  {r.ten}
                </a>
                <span className="text-slate-600">
                  {total} việc{r.qua_han > 0 && <b className="ml-1 text-slate-900">· {r.qua_han} quá hạn</b>}
                </span>
              </div>
              <div className="mt-1 flex h-4 gap-[2px]" style={{ width: `${Math.max(4, (total / max) * 100)}%` }}>
                {seg.map((s) => {
                  const v = r[s.k];
                  if (!v) return null;
                  return (
                    <div
                      key={s.k}
                      title={`${r.ten} — ${s.label}: ${v}`}
                      className="h-full first:rounded-l last:rounded-r"
                      style={{ flexGrow: v, flexBasis: 0, background: s.color, minWidth: 4 }}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TrendLine({ points }: { points: { thang: string; ty_le: number | null; den_han: number; dung_han: number }[] }) {
  const W = 600;
  const H = 200;
  const P = { l: 40, r: 16, t: 16, b: 30 };
  const iw = W - P.l - P.r;
  const ih = H - P.t - P.b;
  const x = (i: number) => P.l + (points.length === 1 ? iw / 2 : (i * iw) / (points.length - 1));
  const y = (v: number) => P.t + ih - (v / 100) * ih;
  const valid = points.map((p, i) => ({ ...p, i })).filter((p) => p.ty_le != null);
  const path = valid.map((p, j) => `${j ? "L" : "M"}${x(p.i).toFixed(1)},${y(p.ty_le!).toFixed(1)}`).join(" ");
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Tỷ lệ hoàn thành đúng hạn theo tháng">
        {[0, 50, 100].map((g) => (
          <g key={g}>
            <line x1={P.l} x2={W - P.r} y1={y(g)} y2={y(g)} stroke={g === 0 ? "#c3c2b7" : "#e1e0d9"} strokeWidth={1} />
            <text x={P.l - 6} y={y(g) + 4} textAnchor="end" fontSize={12} fill="#64748b">
              {g}%
            </text>
          </g>
        ))}
        {path && <path d={path} fill="none" stroke={BRAND} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
        {points.map((p, i) => (
          <g key={p.thang}>
            <text x={x(i)} y={H - 8} textAnchor="middle" fontSize={12} fill="#64748b">
              T{Number(p.thang.slice(5))}
            </text>
            {p.ty_le != null && (
              <g>
                <circle cx={x(i)} cy={y(p.ty_le)} r={14} fill="transparent">
                  <title>{`Tháng ${Number(p.thang.slice(5))}/${p.thang.slice(0, 4)}: ${p.ty_le.toFixed(0)}% (${p.dung_han}/${p.den_han} việc đúng hạn)`}</title>
                </circle>
                <circle cx={x(i)} cy={y(p.ty_le)} r={4.5} fill={BRAND} stroke="#fff" strokeWidth={2} pointerEvents="none" />
              </g>
            )}
          </g>
        ))}
        {valid.length > 0 && (
          <text x={x(valid[valid.length - 1].i)} y={y(valid[valid.length - 1].ty_le!) - 12} textAnchor="middle" fontSize={13} fontWeight={700} fill="#0f172a">
            {valid[valid.length - 1].ty_le!.toFixed(0)}%
          </text>
        )}
      </svg>
      <details className="mt-1 text-sm">
        <summary className="cursor-pointer text-slate-500">Xem bảng số liệu</summary>
        <table className="tbl mt-1">
          <thead>
            <tr>
              <th>Tháng</th>
              <th>Việc đến hạn</th>
              <th>Xong đúng hạn</th>
              <th>Tỷ lệ</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.thang}>
                <td>{`${Number(p.thang.slice(5))}/${p.thang.slice(0, 4)}`}</td>
                <td>{p.den_han}</td>
                <td>{p.dung_han}</td>
                <td>{p.ty_le == null ? "–" : `${p.ty_le.toFixed(0)}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

const KPI_COLOR: Record<string, string> = { xanh: STATUS.good, vang: STATUS.warning, do: STATUS.critical, xam: "#c3c2b7" };
const KPI_LABEL: Record<string, string> = { xanh: "Đúng tiến độ", vang: "Chậm nhẹ", do: "Nguy cơ không đạt", xam: "Chưa có số liệu" };

/** Thanh tiến độ chỉ tiêu: phần đã đạt + vạch "lẽ ra phải đạt" */
export function KpiBar({ pct, leRa, mau }: { pct: number | null; leRa: number; mau: string }) {
  const v = Math.max(0, Math.min(100, pct ?? 0));
  return (
    <div className="relative h-3 w-full rounded-full bg-slate-200" title={`Đạt ${pct == null ? "–" : pct.toFixed(1) + "%"} · lẽ ra ${leRa.toFixed(0)}%`}>
      <div className="h-full rounded-full" style={{ width: `${v}%`, background: KPI_COLOR[mau] }} />
      <div className="absolute -top-1 h-5 w-[3px] rounded bg-slate-800" style={{ left: `calc(${Math.min(100, leRa)}% - 1.5px)` }} aria-hidden />
    </div>
  );
}

export function KpiStatus({ mau }: { mau: string }) {
  const icon: Record<string, string> = { xanh: "✓", vang: "!", do: "▲", xam: "–" };
  return (
    <span className="inline-flex items-center gap-1 text-sm font-semibold text-slate-800 whitespace-nowrap">
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full text-xs text-white" style={{ background: KPI_COLOR[mau], color: mau === "vang" ? "#0b0b0b" : "#fff" }}>
        {icon[mau]}
      </span>
      {KPI_LABEL[mau]}
    </span>
  );
}

export function KpiDot({ mau }: { mau: string }) {
  const icon: Record<string, string> = { xanh: "✓", vang: "!", do: "▲", xam: "–" };
  return (
    <span
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
      style={{ background: KPI_COLOR[mau], color: mau === "vang" ? "#0b0b0b" : "#fff" }}
      title={KPI_LABEL[mau]}
      aria-label={KPI_LABEL[mau]}
    >
      {icon[mau]}
    </span>
  );
}

export function KpiCount({ mau, n }: { mau: string; n: number }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap text-slate-700" title={KPI_LABEL[mau]}>
      <KpiDot mau={mau} />
      {n}
    </span>
  );
}

type UnitRateRow = UnitRow;
type MonthPoint = { thang: string; ty_le: number | null; den_han: number; dung_han: number };

/**
 * Biểu đồ cột ngang theo đơn vị (toàn chiều rộng): cột chia theo trạng thái,
 * số % trong cột là tỷ lệ hoàn thành đúng hạn của đơn vị (trên số việc đã đến hạn).
 * Dải phía trên: tỷ lệ đúng hạn từng tháng của cả phạm vi đang xem.
 */
export function UnitRateBars({ rows, months }: { rows: UnitRateRow[]; months: MonthPoint[] }) {
  const seg = [
    { k: "dung_han", label: "Xong đúng hạn", color: STATUS.good },
    { k: "tre_han", label: "Xong trễ hạn", color: STATUS.serious },
    { k: "qua_han", label: "Đang quá hạn", color: STATUS.critical },
    { k: "dang_lam", label: "Đang làm, còn hạn", color: "#c3c2b7" },
  ] as const;
  const total = (r: UnitRateRow) => r.dung_han + r.tre_han + r.qua_han + r.dang_lam;
  const max = Math.max(1, ...rows.map(total));
  const rate = (r: UnitRateRow) => {
    const due = r.dung_han + r.tre_han + r.qua_han;
    return due ? Math.round((r.dung_han / due) * 100) : null;
  };
  return (
    <div>
      {months.length > 0 && (
        <div className="mb-4 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
          <div className="text-sm font-semibold text-slate-700">Tỷ lệ hoàn thành đúng hạn theo tháng (toàn bộ phạm vi đang xem)</div>
          <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {months.map((m) => {
              const v = m.ty_le == null ? null : Math.round(m.ty_le);
              return (
                <div key={m.thang} className="rounded-lg bg-white px-2.5 py-2 shadow-soft" title={`${m.dung_han}/${m.den_han} việc đến hạn xong đúng hạn`}>
                  <div className="text-xs text-slate-500">Tháng {Number(m.thang.slice(5))}/{m.thang.slice(2, 4)}</div>
                  <div className="text-lg leading-tight font-bold text-slate-900">{v == null ? "–" : `${v}%`}</div>
                  <div className="mt-1 h-1.5 rounded-full bg-slate-200">
                    <div className="h-full rounded-full" style={{ width: `${v ?? 0}%`, background: v == null ? "transparent" : v >= 80 ? STATUS.good : v >= 60 ? STATUS.warning : STATUS.critical }} />
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500">
                    {m.dung_han}/{m.den_han} việc
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-700">
        {seg.map((s) => (
          <span key={s.k} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block rounded-full border border-slate-300 bg-white px-1.5 text-[11px] font-bold text-slate-800">%</span>
          Tỷ lệ xong đúng hạn của đơn vị (trên số việc đã đến hạn)
        </span>
      </div>
      {!rows.length ? (
        <p className="muted">Chưa có dữ liệu.</p>
      ) : (
        <div className="space-y-2.5">
          {rows.map((r) => {
            const t = total(r);
            const share = t / max;
            const p = rate(r);
            const pill = (
              <span
                className="inline-flex items-center gap-1 rounded-full border border-white/70 bg-white px-2 py-0.5 text-[13px] leading-5 font-bold whitespace-nowrap text-slate-900 shadow-soft"
                title={p == null ? "Chưa có việc đến hạn" : `${r.dung_han} việc xong đúng hạn / ${r.dung_han + r.tre_han + r.qua_han} việc đã đến hạn`}
              >
                {p == null ? "–" : `${p}%`}
                <span className="hidden font-medium text-slate-500 sm:inline">đúng hạn</span>
              </span>
            );
            return (
              <div key={r.ten} className="grid items-center gap-x-3 gap-y-1 sm:grid-cols-[minmax(9rem,15rem)_1fr_7.5rem]">
                <a href={r.id ? `/viec?tab=tat_ca&don_vi=${r.id}` : "/viec?tab=tat_ca"} className="truncate font-medium text-slate-800 hover:underline" title={r.ten}>
                  {r.ten}
                </a>
                <div className="flex items-center gap-2">
                  <div className="relative flex h-7 gap-[2px]" style={{ width: `${Math.max(3, share * 100)}%` }}>
                    {seg.map((s, i) => {
                      const v = r[s.k];
                      if (!v) return null;
                      const last = seg.slice(i + 1).every((x) => !r[x.k]);
                      return (
                        <div
                          key={s.k}
                          style={{ flexGrow: v, flexBasis: 0, background: s.color }}
                          className={`h-full min-w-[3px] ${last ? "rounded-r-[4px]" : ""}`}
                          title={`${s.label}: ${v}`}
                        />
                      );
                    })}
                    {share >= 0.3 && <span className="absolute top-1/2 right-1.5 -translate-y-1/2">{pill}</span>}
                  </div>
                  {share < 0.3 && pill}
                </div>
                <div className="text-sm text-slate-600 tabular-nums sm:text-right">
                  {t} việc{r.qua_han > 0 && <b className="ml-1 text-slate-900">· {r.qua_han} quá hạn</b>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
