import type postgres from "postgres";
import { fromVN } from "./time";

/**
 * ĐÁNH GIÁ KPI THỰC HIỆN CÔNG VIỆC
 *
 * Tập việc của một kỳ = việc có hạn trong kỳ + việc chưa xong có hạn trước kỳ (tồn từ kỳ trước). Không tính việc đã hủy.
 * Mỗi việc được phân loại:
 *   - som      : xong VƯỢT TIẾN ĐỘ, trước hạn từ 1 ngày trở lên
 *   - dung     : xong ĐÚNG HẠN
 *   - tre      : xong TRỄ HẠN
 *   - qua_han  : chưa xong, ĐÃ QUÁ HẠN
 *   - dang_lam : chưa xong, còn hạn (việc tồn chưa đến hạn) — chưa tính điểm,
 *                nhưng so % tiến độ với thời gian đã trôi qua để biết đang NHANH hay CHẬM so với kế hoạch.
 * Điểm KPI (0–100) = trung bình điểm các việc đã đến hạn hoặc đã xong:
 *   xong sớm 100 · đúng hạn 90 · trễ hạn 50 · quá hạn chưa xong 0.
 * Xếp loại: ≥ 90 Hoàn thành xuất sắc · ≥ 75 Hoàn thành tốt · ≥ 50 Hoàn thành · < 50 Chưa hoàn thành.
 *
 * Người chịu trách nhiệm một việc = công chức thực hiện (nếu đã giao lại), nếu không là người chủ trì.
 * Đơn vị: tính theo đơn vị chủ trì; việc con cùng đơn vị với việc cha không tính lặp.
 */
export const DIEM = { som: 100, dung: 90, tre: 50, qua_han: 0 } as const;
export const XEP_LOAI: [number, string, string][] = [
  [90, "Hoàn thành xuất sắc", "xs"],
  [75, "Hoàn thành tốt", "tot"],
  [50, "Hoàn thành", "ht"],
  [0, "Chưa hoàn thành", "kht"],
];
export const xepLoai = (d: number | null) => (d == null ? null : XEP_LOAI.find(([m]) => d >= m)!);

export type KpiRow = {
  id: number | null;
  ten: string;
  don_vi?: string | null;
  id_don_vi?: number | null;
  chuc_vu?: string | null;
  tong: number;
  som: number;
  dung: number;
  tre: number;
  qua_han: number;
  dang_lam: number;
  nhanh: number;
  cham: number;
  ton: number;
  gia_han: number;
  /** % xong đúng hạn hoặc sớm trên số việc đã đến hạn / đã xong */
  ty_le: number | null;
  diem: number | null;
};

export type Ky = { nam: number; quy?: number; thang?: number };

export function kyRange(k: Ky): { from: Date; to: Date; label: string } {
  const p = (n: number) => String(n).padStart(2, "0");
  let m1 = 1;
  let m2 = 12;
  let label = `năm ${k.nam}`;
  if (k.thang) {
    m1 = m2 = k.thang;
    label = `tháng ${k.thang}/${k.nam}`;
  } else if (k.quy) {
    m1 = (k.quy - 1) * 3 + 1;
    m2 = m1 + 2;
    label = `quý ${["", "I", "II", "III", "IV"][k.quy]}/${k.nam}`;
  }
  const last = new Date(Date.UTC(k.nam, m2, 0)).getUTCDate();
  return { from: fromVN(`${k.nam}-${p(m1)}-01`, "00:00"), to: fromVN(`${k.nam}-${p(m2)}-${p(last)}`, "23:59"), label };
}

const finish = (r: Omit<KpiRow, "ty_le" | "diem" | "ton">): KpiRow => {
  const den = r.som + r.dung + r.tre + r.qua_han;
  return {
    ...r,
    ton: r.qua_han + r.dang_lam,
    ty_le: den ? Math.round(((r.som + r.dung) / den) * 100) : null,
    diem: den ? Math.round((r.som * DIEM.som + r.dung * DIEM.dung + r.tre * DIEM.tre) / den) : null,
  };
};

/** CTE phân loại từng việc trong kỳ */
function classified(sql: postgres.Sql, from: Date, to: Date) {
  return sql`
    WITH v AS (
      SELECT cv.id, cv.id_cha, cv.id_don_vi_chu_tri, COALESCE(cv.id_nguoi_thuc_hien, cv.id_chu_tri) AS id_nguoi, cv.so_lan_gia_han,
        CASE
          WHEN cv.trang_thai = 'hoan_thanh' AND cv.ngay_hoan_thanh <= cv.han - interval '1 day' THEN 'som'
          WHEN cv.trang_thai = 'hoan_thanh' AND cv.ngay_hoan_thanh <= cv.han THEN 'dung'
          WHEN cv.trang_thai = 'hoan_thanh' THEN 'tre'
          WHEN cv.han < now() THEN 'qua_han'
          ELSE 'dang_lam'
        END AS loai,
        -- % lẽ ra phải đạt theo thời gian đã trôi qua (chỉ với việc đang làm, còn hạn)
        CASE WHEN cv.trang_thai <> 'hoan_thanh' AND cv.han >= now() THEN
          LEAST(100, GREATEST(0, 100 * EXTRACT(EPOCH FROM now() - COALESCE(cv.ngay_nhan, cv.tao_luc)) / NULLIF(EXTRACT(EPOCH FROM cv.han - COALESCE(cv.ngay_nhan, cv.tao_luc)), 0)))
        END AS le_ra,
        cv.phan_tram
      FROM cong_viec cv
      WHERE cv.trang_thai <> 'huy'
        AND ((cv.han >= ${from} AND cv.han <= ${to}) OR (cv.trang_thai <> 'hoan_thanh' AND cv.han < ${from}))
        AND cv.tao_luc <= ${to}
    )`;
}

const AGG = (sql: postgres.Sql) => sql`
  count(*)::int AS tong,
  count(*) FILTER (WHERE v.loai = 'som')::int AS som,
  count(*) FILTER (WHERE v.loai = 'dung')::int AS dung,
  count(*) FILTER (WHERE v.loai = 'tre')::int AS tre,
  count(*) FILTER (WHERE v.loai = 'qua_han')::int AS qua_han,
  count(*) FILTER (WHERE v.loai = 'dang_lam')::int AS dang_lam,
  count(*) FILTER (WHERE v.loai = 'dang_lam' AND v.phan_tram >= v.le_ra + 10)::int AS nhanh,
  count(*) FILTER (WHERE v.loai = 'dang_lam' AND v.phan_tram < v.le_ra - 15)::int AS cham,
  COALESCE(sum(v.so_lan_gia_han), 0)::int AS gia_han`;

/** KPI theo đơn vị. units = null: toàn phường */
export async function kpiUnits(sql: postgres.Sql, k: Ky, units: number[] | null): Promise<KpiRow[]> {
  const { from, to } = kyRange(k);
  const rows = await sql`
    ${classified(sql, from, to)}
    SELECT d.id, d.ten, ${AGG(sql)}
    FROM v JOIN don_vi d ON d.id = v.id_don_vi_chu_tri
    LEFT JOIN cong_viec cha ON cha.id = v.id_cha
    WHERE (v.id_cha IS NULL OR cha.id_don_vi_chu_tri IS DISTINCT FROM v.id_don_vi_chu_tri)
      ${units ? sql`AND d.id IN ${sql(units.length ? units : [-1])}` : sql``}
    GROUP BY d.id, d.ten, d.thu_tu
    ORDER BY d.thu_tu, d.ten`;
  return rows.map((r) => finish(r as never));
}

/** KPI theo cán bộ (người chịu trách nhiệm việc). units = null: toàn phường */
export async function kpiPeople(sql: postgres.Sql, k: Ky, units: number[] | null, unitFilter?: number): Promise<KpiRow[]> {
  const { from, to } = kyRange(k);
  const rows = await sql`
    ${classified(sql, from, to)}
    SELECT n.id, n.ho_ten AS ten, n.chuc_vu, d.ten AS don_vi, d.id AS id_don_vi, ${AGG(sql)}
    FROM v JOIN nguoi_dung n ON n.id = v.id_nguoi
    LEFT JOIN don_vi d ON d.id = n.id_don_vi
    WHERE TRUE
      ${units ? sql`AND n.id_don_vi IN ${sql(units.length ? units : [-1])}` : sql``}
      ${unitFilter ? sql`AND n.id_don_vi = ${unitFilter}` : sql``}
    GROUP BY n.id, n.ho_ten, n.chuc_vu, d.id, d.ten, d.thu_tu
    ORDER BY d.thu_tu NULLS LAST, n.ho_ten`;
  return rows.map((r) => finish(r as never));
}

export function tongHop(rows: KpiRow[]): KpiRow {
  const z = { id: null, ten: "Tổng cộng", tong: 0, som: 0, dung: 0, tre: 0, qua_han: 0, dang_lam: 0, nhanh: 0, cham: 0, gia_han: 0 };
  for (const r of rows) for (const k of ["tong", "som", "dung", "tre", "qua_han", "dang_lam", "nhanh", "cham", "gia_han"] as const) z[k] += r[k];
  return finish(z);
}
