import type postgres from "postgres";
import { NAM_GIAO } from "./taskQuery";

export type UnitProgress = {
  id: number | null;
  ten: string;
  tong: number;
  dung_han: number;
  tre_han: number;
  qua_han: number;
  dang_lam: number;
  /** tiến độ bình quân (%), việc đã xong tính 100% */
  tien_do: number;
  /** % việc đã hoàn thành */
  hoan_thanh: number;
  /** % việc xong đúng hạn trên số việc đã xong */
  dung_han_pct: number | null;
};

/** Tiến độ thực hiện công việc theo đơn vị chủ trì, trong phạm vi người xem được xem */
export async function unitProgress(
  sql: postgres.Sql,
  scope: postgres.PendingQuery<postgres.Row[]>,
  o: { nam: number; quy?: number; thang?: number; linh_vuc?: string },
): Promise<UnitProgress[]> {
  const ky = o.thang
    ? sql`AND extract(month FROM cv.tao_luc AT TIME ZONE 'Asia/Ho_Chi_Minh') = ${o.thang}`
    : o.quy
      ? sql`AND extract(quarter FROM cv.tao_luc AT TIME ZONE 'Asia/Ho_Chi_Minh') = ${o.quy}`
      : sql``;
  const rows = await sql`
    SELECT dv.id, COALESCE(dv.ten, 'Cá nhân, không thuộc đơn vị') AS ten,
      count(*)::int AS tong,
      count(*) FILTER (WHERE cv.trang_thai = 'hoan_thanh' AND cv.ngay_hoan_thanh <= cv.han)::int AS dung_han,
      count(*) FILTER (WHERE cv.trang_thai = 'hoan_thanh' AND (cv.ngay_hoan_thanh IS NULL OR cv.ngay_hoan_thanh > cv.han))::int AS tre_han,
      count(*) FILTER (WHERE cv.trang_thai <> 'hoan_thanh' AND cv.han < now())::int AS qua_han,
      count(*) FILTER (WHERE cv.trang_thai <> 'hoan_thanh' AND cv.han >= now())::int AS dang_lam,
      round(avg(CASE WHEN cv.trang_thai = 'hoan_thanh' THEN 100 ELSE cv.phan_tram END))::int AS tien_do
    FROM cong_viec cv LEFT JOIN don_vi dv ON dv.id = cv.id_don_vi_chu_tri
    WHERE (${scope}) AND cv.trang_thai <> 'huy'
      AND ${sql.unsafe(NAM_GIAO)} = ${o.nam} ${ky}
      ${o.linh_vuc ? sql`AND cv.linh_vuc = ${o.linh_vuc}` : sql``}
    GROUP BY dv.id, dv.ten, dv.thu_tu
    ORDER BY dv.thu_tu NULLS LAST, dv.ten`;
  return rows.map((r) => {
    const xong = r.dung_han + r.tre_han;
    return {
      ...(r as unknown as UnitProgress),
      hoan_thanh: r.tong ? Math.round((xong / r.tong) * 100) : 0,
      dung_han_pct: xong ? Math.round((r.dung_han / xong) * 100) : null,
    };
  });
}
