import type postgres from "postgres";
import { vnDate, fromVN, addDays } from "./time";

type Q = postgres.Sql;
type Frag = postgres.PendingQuery<postgres.Row[]>;

export function periodRange(ky: string, now = new Date()): { from: Date; to: Date; label: string } {
  const d = vnDate(now);
  const y = Number(d.slice(0, 4));
  const m = Number(d.slice(5, 7));
  if (ky === "thang") return { from: fromVN(`${d.slice(0, 7)}-01`, "00:00"), to: now, label: `tháng ${m}/${y}` };
  if (ky === "quy") {
    const q = Math.floor((m - 1) / 3);
    return { from: fromVN(`${y}-${String(q * 3 + 1).padStart(2, "0")}-01`, "00:00"), to: now, label: `quý ${q + 1}/${y}` };
  }
  return { from: fromVN(`${y}-01-01`, "00:00"), to: now, label: `năm ${y}` };
}

/** 4 con số đầu trang */
export async function headline(sql: Q, scope: Frag) {
  const r = (
    await sql`
    SELECT
      count(*) FILTER (WHERE cv.trang_thai IN ('moi_giao','da_nhan','dang_thuc_hien','cho_duyet'))::int AS dang_lam,
      count(*) FILTER (WHERE cv.trang_thai IN ('moi_giao','da_nhan','dang_thuc_hien') AND cv.han < now())::int AS qua_han,
      count(*) FILTER (WHERE cv.trang_thai = 'moi_giao')::int AS cho_nhan,
      count(*) FILTER (WHERE cv.trang_thai = 'cho_duyet')::int AS cho_duyet
    FROM cong_viec cv WHERE (${scope})`
  )[0];
  const month = await onTimeRate(sql, scope, fromVN(`${vnDate().slice(0, 7)}-01`, "00:00"), new Date());
  return { ...r, ...month } as { dang_lam: number; qua_han: number; cho_nhan: number; cho_duyet: number; den_han: number; dung_han: number; ty_le: number | null };
}

/** Tỷ lệ đúng hạn: trong các việc có hạn rơi vào khoảng [from, to], bao nhiêu việc xong trước hạn */
export async function onTimeRate(sql: Q, scope: Frag, from: Date, to: Date) {
  const r = (
    await sql`
    SELECT count(*)::int AS den_han,
           count(*) FILTER (WHERE cv.trang_thai = 'hoan_thanh' AND cv.ngay_hoan_thanh <= cv.han)::int AS dung_han
    FROM cong_viec cv
    WHERE (${scope}) AND cv.trang_thai <> 'huy' AND cv.han >= ${from} AND cv.han <= ${to}`
  )[0];
  return { den_han: r.den_han as number, dung_han: r.dung_han as number, ty_le: r.den_han ? (r.dung_han * 100) / r.den_han : null };
}

/** Số việc đúng hạn / trễ hạn / đang quá hạn theo đơn vị */
export async function byUnit(sql: Q, scope: Frag, from: Date) {
  return (await sql`
    SELECT COALESCE(dv.ten, 'Cá nhân, không thuộc đơn vị') AS ten, dv.id,
      count(*) FILTER (WHERE cv.trang_thai = 'hoan_thanh' AND cv.ngay_hoan_thanh <= cv.han)::int AS dung_han,
      count(*) FILTER (WHERE cv.trang_thai = 'hoan_thanh' AND cv.ngay_hoan_thanh > cv.han)::int AS tre_han,
      count(*) FILTER (WHERE cv.trang_thai IN ('moi_giao','da_nhan','dang_thuc_hien') AND cv.han < now())::int AS qua_han,
      count(*) FILTER (WHERE cv.trang_thai IN ('moi_giao','da_nhan','dang_thuc_hien','cho_duyet') AND cv.han >= now())::int AS dang_lam
    FROM cong_viec cv LEFT JOIN don_vi dv ON dv.id = cv.id_don_vi_chu_tri
    WHERE (${scope}) AND cv.trang_thai <> 'huy' AND (cv.han >= ${from} OR cv.trang_thai IN ('moi_giao','da_nhan','dang_thuc_hien','cho_duyet'))
    GROUP BY dv.id, dv.ten, dv.thu_tu
    ORDER BY dv.thu_tu NULLS LAST`) as unknown as { ten: string; id: number | null; dung_han: number; tre_han: number; qua_han: number; dang_lam: number }[];
}

/** Tỷ lệ đúng hạn theo từng tháng (đường xu hướng) */
export async function trend(sql: Q, scope: Frag, months = 6) {
  const out: { thang: string; ty_le: number | null; den_han: number; dung_han: number }[] = [];
  const today = vnDate();
  let y = Number(today.slice(0, 4));
  let m = Number(today.slice(5, 7));
  const keys: string[] = [];
  for (let i = 0; i < months; i++) {
    keys.unshift(`${y}-${String(m).padStart(2, "0")}`);
    m--;
    if (m === 0) {
      m = 12;
      y--;
    }
  }
  for (const k of keys) {
    const [yy, mm] = k.split("-").map(Number);
    const last = new Date(Date.UTC(yy, mm, 0)).getUTCDate();
    const from = fromVN(`${k}-01`, "00:00");
    const toEnd = fromVN(`${k}-${String(last).padStart(2, "0")}`, "23:59");
    const to = toEnd.getTime() > Date.now() ? new Date() : toEnd;
    const r = await onTimeRate(sql, scope, from, to);
    out.push({ thang: k, ...r });
  }
  return out;
}

/** Số liệu phục vụ đánh giá theo cá nhân (mục 6.3) */
export async function personStats(sql: Q, scope: Frag, from: Date, to: Date) {
  return (await sql`
    SELECT n.id, n.ho_ten, n.chuc_vu, d.ten AS don_vi,
      count(cv.id)::int AS duoc_giao,
      count(cv.id) FILTER (WHERE cv.trang_thai = 'hoan_thanh')::int AS hoan_thanh,
      count(cv.id) FILTER (WHERE cv.trang_thai = 'hoan_thanh' AND cv.ngay_hoan_thanh <= cv.han)::int AS dung_han,
      COALESCE(sum(cv.so_lan_gia_han), 0)::int AS gia_han,
      COALESCE(sum(cv.so_lan_lam_lai), 0)::int AS lam_lai,
      COALESCE(avg(GREATEST(0, EXTRACT(EPOCH FROM (COALESCE(cv.ngay_hoan_thanh, LEAST(now(), ${to})) - cv.han)) / 86400))
        FILTER (WHERE COALESCE(cv.ngay_hoan_thanh, LEAST(now(), ${to})) > cv.han), 0)::float AS tb_ngay_qua_han,
      count(cv.id) FILTER (WHERE cv.trang_thai IN ('moi_giao','da_nhan','dang_thuc_hien') AND cv.han < now())::int AS dang_qua_han
    FROM nguoi_dung n
    LEFT JOIN don_vi d ON d.id = n.id_don_vi
    JOIN cong_viec cv ON COALESCE(cv.id_nguoi_thuc_hien, cv.id_chu_tri) = n.id AND cv.trang_thai <> 'huy'
      AND cv.han >= ${from} AND cv.han <= ${to} AND (${scope})
    GROUP BY n.id, n.ho_ten, n.chuc_vu, d.ten, d.thu_tu
    ORDER BY d.thu_tu NULLS LAST, n.ho_ten`) as unknown as {
    id: number; ho_ten: string; chuc_vu: string; don_vi: string; duoc_giao: number; hoan_thanh: number; dung_han: number; gia_han: number; lam_lai: number; tb_ngay_qua_han: number; dang_qua_han: number;
  }[];
}

export { addDays };
