"use client";
import { useEffect, useRef, useState } from "react";
import type { UnitProgress, SubTask } from "@/lib/unitProgress";

// Màu trạng thái cố định (giống các biểu đồ khác của phần mềm), luôn kèm chú thích chữ
const SEG = [
  { k: "dung_han", label: "Xong đúng hạn", color: "#0ca30c" },
  { k: "tre_han", label: "Xong trễ hạn", color: "#ec835a" },
  { k: "dang_lam", label: "Đang làm, còn hạn", color: "#b9b8ad" },
  { k: "qua_han", label: "Chưa xong, đã quá hạn", color: "#d03b3b" },
] as const;
const CHI_SO = {
  tien_do: { label: "Tiến độ bình quân", note: "Trung bình % tiến độ của các việc; việc đã xong tính 100%" },
  hoan_thanh: { label: "Tỷ lệ đã hoàn thành", note: "Số việc đã xong trên tổng số việc được giao" },
  dung_han_pct: { label: "Tỷ lệ xong đúng hạn", note: "Số việc xong đúng hạn trên số việc đã xong" },
} as const;
type ChiSo = keyof typeof CHI_SO;
const BLUE = "#2563eb";
const INK = "#334155";
const MUTED = "#64748b";
const GRID = "#e2e8f0";

/** Chia tên đơn vị thành tối đa 3 dòng vừa bề rộng cột */
function wrap(text: string, maxChars: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (!cur) cur = w;
    else if ((cur + " " + w).length <= maxChars) cur += " " + w;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length > 3) return [...lines.slice(0, 2), lines.slice(2).join(" ").slice(0, Math.max(3, maxChars - 1)) + "…"];
  return lines;
}

const niceMax = (v: number) => {
  if (v <= 5) return 5;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
};

function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 800, h: 480 });
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

type Tip = { x: number; y: number; r: UnitProgress } | null;

function Tooltip({ tip, mode, chiSo }: { tip: Tip; mode: "trang_thai" | "chi_so"; chiSo: ChiSo }) {
  if (!tip) return null;
  const r = tip.r;
  return (
    <div className="pointer-events-none absolute z-10 w-64 -translate-x-1/2 -translate-y-full rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-lift" style={{ left: tip.x, top: tip.y - 10 }}>
      <div className="font-semibold text-slate-900">{r.ten}</div>
      <div className="mt-1 text-slate-500">{r.tong} việc được giao</div>
      <ul className="mt-1.5 space-y-0.5">
        {SEG.map((s) => (
          <li key={s.k} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
            <span className="flex-1 text-slate-600">{s.label}</span>
            <b className="tabular-nums text-slate-900">{r[s.k]}</b>
          </li>
        ))}
      </ul>
      <div className={`mt-2 border-t border-slate-100 pt-1.5 ${mode === "chi_so" ? "font-semibold text-slate-900" : "text-slate-600"}`}>
        {CHI_SO[chiSo].label}: {r[chiSo] == null ? "chưa có việc xong" : `${r[chiSo]}%`}
      </div>
      <div className="text-xs text-slate-400">Bấm vào cột để xem danh sách việc</div>
    </div>
  );
}

function Columns({ rows, mode, chiSo, height, link }: { rows: UnitProgress[]; mode: "trang_thai" | "chi_so"; chiSo: ChiSo; height: number; link: (r: UnitProgress) => string }) {
  const [box, size] = useSize<HTMLDivElement>();
  const [tip, setTip] = useState<Tip>(null);
  const minBand = 64;
  const W = Math.max(size.w, rows.length * minBand + 56);
  const H = Math.max(320, height);
  const left = 48;
  const right = 12;
  const top = 28;
  const band = (W - left - right) / Math.max(1, rows.length);
  const maxChars = Math.max(6, Math.floor((band - 6) / 7));
  const labels = rows.map((r) => wrap(r.ten, maxChars));
  const labelLines = Math.max(1, ...labels.map((l) => l.length));
  const bottom = 14 + labelLines * 16;
  const ph = H - top - bottom;
  const max = mode === "chi_so" ? 100 : niceMax(Math.max(1, ...rows.map((r) => r.tong)));
  const ticks = Array.from({ length: 6 }, (_, i) => (max / 5) * i);
  const y = (v: number) => top + ph - (v / max) * ph;
  const barW = Math.min(mode === "chi_so" ? 56 : 64, Math.max(14, band * 0.56));
  const GAP = 2;

  return (
    <div ref={box} className="relative w-full overflow-x-auto" onMouseLeave={() => setTip(null)}>
      <svg width={W} height={H} role="img" aria-label={mode === "chi_so" ? `${CHI_SO[chiSo].label} theo đơn vị` : "Số việc theo trạng thái của từng đơn vị"} className="block">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={left} x2={W - right} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
            <text x={left - 8} y={y(t) + 4} textAnchor="end" fontSize={12} fill={MUTED} className="tabular-nums">
              {mode === "chi_so" ? `${t}%` : Number.isInteger(t) ? t : t.toFixed(1)}
            </text>
          </g>
        ))}
        {rows.map((r, i) => {
          const cx = left + band * i + band / 2;
          const x = cx - barW / 2;
          const onEnter = () => setTip({ x: Math.min(W - 136, Math.max(136, cx)), y: Math.max(200, mode === "chi_so" ? y(r[chiSo] ?? 0) : y(r.tong)), r });
          let acc = 0;
          return (
            <g key={r.id ?? `x${i}`}>
              <a href={link(r)}>
                {/* vùng bấm rộng hơn cột */}
                <rect x={left + band * i} y={top} width={band} height={ph} fill="transparent" onMouseEnter={onEnter} onFocus={onEnter} tabIndex={0} aria-label={`${r.ten}: ${r.tong} việc`} />
                {mode === "chi_so" ? (
                  r[chiSo] != null && r[chiSo]! > 0 ? (
                    <path d={colPath(x, y(r[chiSo]!), barW, top + ph - y(r[chiSo]!), 4)} fill={BLUE} pointerEvents="none" />
                  ) : null
                ) : (
                  SEG.map((s, j) => {
                    const v = r[s.k];
                    if (!v) return null;
                    const y0 = y(acc);
                    acc += v;
                    const y1 = y(acc);
                    const isTop = SEG.slice(j + 1).every((t) => !r[t.k]);
                    const h = Math.max(1, y0 - y1 - (isTop ? 0 : GAP));
                    return isTop ? (
                      <path key={s.k} d={colPath(x, y1, barW, h, 4)} fill={s.color} pointerEvents="none" />
                    ) : (
                      <rect key={s.k} x={x} y={y1 + GAP} width={barW} height={h} fill={s.color} pointerEvents="none" />
                    );
                  })
                )}
                <text x={cx} y={(mode === "chi_so" ? y(r[chiSo] ?? 0) : y(r.tong)) - 8} textAnchor="middle" fontSize={13} fontWeight={600} fill={INK} pointerEvents="none" className="tabular-nums">
                  {mode === "chi_so" ? (r[chiSo] == null ? "–" : `${r[chiSo]}%`) : r.tong}
                </text>
              </a>
              {labels[i].map((ln, k) => (
                <text key={k} x={cx} y={top + ph + 18 + k * 16} textAnchor="middle" fontSize={13} fill={INK}>
                  {ln}
                </text>
              ))}
            </g>
          );
        })}
        <line x1={left} x2={W - right} y1={top + ph} y2={top + ph} stroke="#cbd5e1" strokeWidth={1} />
      </svg>
      <Tooltip tip={tip} mode={mode} chiSo={chiSo} />
    </div>
  );
}

/** Cột bo tròn 4px ở đầu số liệu, vuông ở đường đáy */
function colPath(x: number, yTop: number, w: number, h: number, r: number) {
  const rr = Math.min(r, h, w / 2);
  return `M${x},${yTop + h}V${yTop + rr}Q${x},${yTop} ${x + rr},${yTop}H${x + w - rr}Q${x + w},${yTop} ${x + w},${yTop + rr}V${yTop + h}Z`;
}

export function UnitProgressChart({ rows, linkBase }: { rows: UnitProgress[]; linkBase: string }) {
  const card = useRef<HTMLDivElement>(null);
  const [full, setFull] = useState(false);
  const [mode, setMode] = useState<"trang_thai" | "chi_so">("chi_so");
  const [chiSo, setChiSo] = useState<ChiSo>("tien_do");
  const [vh, setVh] = useState(800);
  useEffect(() => {
    const on = () => {
      setFull(!!document.fullscreenElement);
      setVh(window.innerHeight);
    };
    on();
    document.addEventListener("fullscreenchange", on);
    window.addEventListener("resize", on);
    return () => {
      document.removeEventListener("fullscreenchange", on);
      window.removeEventListener("resize", on);
    };
  }, []);
  const height = full ? vh - 150 : Math.max(380, vh - 330);
  const link = (r: UnitProgress) => `${linkBase}${r.id ? `&don_vi=${r.id}` : ""}`;
  const sorted = mode === "chi_so" ? [...rows].sort((a, b) => (b[chiSo] ?? -1) - (a[chiSo] ?? -1)) : rows;

  if (!rows.length) return <div className="card py-12 text-center text-slate-500">Chưa có công việc nào trong kỳ đã chọn.</div>;
  return (
    <div ref={card} className={`card ${full ? "flex h-screen flex-col overflow-auto rounded-none" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex overflow-hidden rounded-xl border border-slate-200">
          <button type="button" onClick={() => setMode("chi_so")} className={`px-3 py-2 text-sm font-semibold ${mode === "chi_so" ? "bg-slate-800 text-white" : "bg-white text-slate-700"}`}>
            Tỷ lệ tiến độ (%)
          </button>
          <button type="button" onClick={() => setMode("trang_thai")} className={`px-3 py-2 text-sm font-semibold ${mode === "trang_thai" ? "bg-slate-800 text-white" : "bg-white text-slate-700"}`}>
            Số việc theo trạng thái
          </button>
        </div>
        {mode === "chi_so" && (
          <select value={chiSo} onChange={(e) => setChiSo(e.target.value as ChiSo)} className="input min-h-10 w-auto py-1.5" aria-label="Chỉ số so sánh">
            {Object.entries(CHI_SO).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          className="btn btn-outline btn-sm ml-auto"
          onClick={() => (document.fullscreenElement ? document.exitFullscreen() : card.current?.requestFullscreen?.())}
        >
          {full ? "Thoát toàn màn hình" : "⛶ Toàn màn hình"}
        </button>
      </div>
      <p className="mt-2 text-sm text-slate-500">
        {mode === "chi_so" ? `${CHI_SO[chiSo].label}: ${CHI_SO[chiSo].note}. Các đơn vị xếp từ cao xuống thấp.` : "Mỗi cột là tổng số việc của đơn vị, chia theo trạng thái; số trên đầu cột là tổng số việc."}
      </p>
      {mode === "trang_thai" && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-700">
          {SEG.map((s) => (
            <span key={s.k} className="inline-flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
      <div className="mt-3 flex-1">
        <Columns rows={sorted} mode={mode} chiSo={chiSo} height={height} link={link} />
      </div>
    </div>
  );
}

const NHOM_TEN: Record<SubTask["nhom"], string> = { dung_han: "Xong đúng hạn", tre_han: "Xong trễ hạn", dang_lam: "Đang làm, còn hạn", qua_han: "Chưa xong, đã quá hạn" };
const NHOM_MAU: Record<SubTask["nhom"], string> = { dung_han: "#0ca30c", tre_han: "#ec835a", dang_lam: "#b9b8ad", qua_han: "#d03b3b" };

/** Biểu đồ con: mỗi cột là một việc con, chiều cao là % tiến độ, màu theo tình trạng hạn */
export function SubtaskChart({ rows }: { rows: SubTask[] }) {
  const parents = [...new Map(rows.map((r) => [r.id_goc, r.ten_goc])).entries()];
  const [goc, setGoc] = useState<number>(0);
  const list = goc ? rows.filter((r) => r.id_goc === goc) : rows;
  const [box, size] = useSize<HTMLDivElement>();
  const [tip, setTip] = useState<{ x: number; y: number; r: SubTask } | null>(null);
  const [vh, setVh] = useState(800);
  useEffect(() => {
    const on = () => setVh(window.innerHeight);
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  const left = 48;
  const right = 12;
  const top = 28;
  const minBand = 70;
  const W = Math.max(size.w, list.length * minBand + left + right);
  const H = Math.max(340, Math.min(620, vh - 360));
  const band = (W - left - right) / Math.max(1, list.length);
  const maxChars = Math.max(6, Math.floor((band - 6) / 7));
  const labels = list.map((r) => wrap(r.ten, maxChars));
  const bottom = 14 + Math.max(1, ...labels.map((l) => l.length)) * 16;
  const ph = H - top - bottom;
  const y = (v: number) => top + ph - (v / 100) * ph;
  const barW = Math.min(48, Math.max(14, band * 0.5));
  // dải nền nhạt phân biệt các việc lớn khi xem tất cả
  const bands: { from: number; to: number; ten: string }[] = [];
  list.forEach((r, i) => {
    const last = bands[bands.length - 1];
    if (last && list[i - 1]?.id_goc === r.id_goc) last.to = i;
    else bands.push({ from: i, to: i, ten: r.ten_goc });
  });

  return (
    <div className="card">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          Việc lớn
          <select value={goc} onChange={(e) => setGoc(Number(e.target.value))} className="input min-h-10 w-auto max-w-[70vw] py-1.5" aria-label="Chọn việc lớn">
            <option value={0}>Tất cả ({rows.length} việc con)</option>
            {parents.map(([id, ten]) => (
              <option key={id} value={id}>
                {ten.length > 70 ? ten.slice(0, 68) + "…" : ten}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-700">
        {(Object.keys(NHOM_TEN) as SubTask["nhom"][]).map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ background: NHOM_MAU[k] }} />
            {NHOM_TEN[k]}
          </span>
        ))}
      </div>
      <div ref={box} className="relative mt-3 w-full overflow-x-auto" onMouseLeave={() => setTip(null)}>
        <svg width={W} height={H} role="img" aria-label="Tiến độ các việc con" className="block" data-bieu-do-con>
          {!goc &&
            bands.length > 1 &&
            bands.map((b, i) =>
              i % 2 === 1 ? <rect key={i} x={left + band * b.from} y={top} width={band * (b.to - b.from + 1)} height={ph} fill="#f1f5f9" /> : null,
            )}
          {[0, 20, 40, 60, 80, 100].map((t) => (
            <g key={t}>
              <line x1={left} x2={W - right} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
              <text x={left - 8} y={y(t) + 4} textAnchor="end" fontSize={12} fill={MUTED}>
                {t}%
              </text>
            </g>
          ))}
          {list.map((r, i) => {
            const cx = left + band * i + band / 2;
            const enter = () => setTip({ x: Math.min(W - 136, Math.max(136, cx)), y: Math.max(190, y(r.tien_do)), r });
            return (
              <g key={r.id}>
                <a href={`/viec/${r.id}`}>
                  <rect x={left + band * i} y={top} width={band} height={ph} fill="transparent" onMouseEnter={enter} onFocus={enter} tabIndex={0} aria-label={`${r.ten}: ${r.tien_do}%`} />
                  {r.tien_do > 0 && <path d={colPath(cx - barW / 2, y(r.tien_do), barW, top + ph - y(r.tien_do), 4)} fill={NHOM_MAU[r.nhom]} pointerEvents="none" />}
                  <text x={cx} y={y(r.tien_do) - 8} textAnchor="middle" fontSize={13} fontWeight={600} fill={INK} pointerEvents="none">
                    {r.tien_do}%
                  </text>
                </a>
                {labels[i].map((ln, k) => (
                  <text key={k} x={cx} y={top + ph + 18 + k * 16} textAnchor="middle" fontSize={13} fill={INK}>
                    {ln}
                  </text>
                ))}
              </g>
            );
          })}
          <line x1={left} x2={W - right} y1={top + ph} y2={top + ph} stroke="#cbd5e1" strokeWidth={1} />
        </svg>
        {tip && (
          <div className="pointer-events-none absolute z-10 w-64 -translate-x-1/2 -translate-y-full rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-lift" style={{ left: tip.x, top: tip.y - 10 }}>
            <div className="font-semibold text-slate-900">{tip.r.ten}</div>
            <div className="mt-0.5 text-slate-500">Thuộc: {tip.r.ten_goc}</div>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: NHOM_MAU[tip.r.nhom] }} />
              {NHOM_TEN[tip.r.nhom]}
            </div>
            <div className="mt-1 text-slate-700">
              Chủ trì: {tip.r.chu_tri} · Hạn {tip.r.han}
            </div>
            <div className="mt-1 font-semibold text-slate-900">Tiến độ: {tip.r.tien_do}%</div>
            <div className="text-xs text-slate-400">Bấm vào cột để mở việc con</div>
          </div>
        )}
      </div>
    </div>
  );
}
