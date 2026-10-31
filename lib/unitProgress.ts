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
    WHERE (${scope}) AND cv.trang_thai <> 'huy' AND cv.id_cha IS NULL
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

export type SubTask = {
  id: number;
  ten: string;
  id_goc: number;
  ten_goc: string;
  chu_tri: string;
  trang_thai: string;
  tien_do: number;
  /** dung_han / tre_han / qua_han / dang_lam */
  nhom: "dung_han" | "tre_han" | "qua_han" | "dang_lam";
  han: string;
};

/**
 * Việc con (mọi cấp) của các việc lớn do một đơn vị chủ trì, cùng kỳ với biểu đồ chính.
 * Chỉ dùng cho cán bộ thuộc chính đơn vị đó.
 */
export async function subtaskProgress(sql: postgres.Sql, unitId: number, o: { nam: number; quy?: number; thang?: number; linh_vuc?: string }): Promise<SubTask[]> {
  const ky = o.thang
    ? sql`AND extract(month FROM cv.tao_luc AT TIME ZONE 'Asia/Ho_Chi_Minh') = ${o.thang}`
    : o.quy
      ? sql`AND extract(quarter FROM cv.tao_luc AT TIME ZONE 'Asia/Ho_Chi_Minh') = ${o.quy}`
      : sql``;
  const rows = await sql`
    WITH RECURSIVE goc AS (
      SELECT cv.id, cv.ten FROM cong_viec cv
      WHERE cv.id_cha IS NULL AND cv.trang_thai <> 'huy' AND cv.id_don_vi_chu_tri = ${unitId}
        AND ${sql.unsafe(NAM_GIAO)} = ${o.nam} ${ky}
        ${o.linh_vuc ? sql`AND cv.linh_vuc = ${o.linh_vuc}` : sql``}
    ), con AS (
      SELECT c.id, g.id AS id_goc, g.ten AS ten_goc, 1 AS cap FROM cong_viec c JOIN goc g ON c.id_cha = g.id
      UNION ALL
      SELECT c.id, con.id_goc, con.ten_goc, con.cap + 1 FROM cong_viec c JOIN con ON c.id_cha = con.id WHERE con.cap < 5
    )
    SELECT c.id, c.ten, con.id_goc, con.ten_goc, n.ho_ten AS chu_tri, c.trang_thai, to_char(c.han AT TIME ZONE 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY') AS han,
      CASE WHEN c.trang_thai = 'hoan_thanh' THEN 100 ELSE c.phan_tram END AS tien_do,
      CASE WHEN c.trang_thai = 'hoan_thanh' AND c.ngay_hoan_thanh <= c.han THEN 'dung_han'
           WHEN c.trang_thai = 'hoan_thanh' THEN 'tre_han'
           WHEN c.han < now() THEN 'qua_han' ELSE 'dang_lam' END AS nhom
    FROM con JOIN cong_viec c ON c.id = con.id JOIN nguoi_dung n ON n.id = c.id_chu_tri
    WHERE c.trang_thai <> 'huy'
    ORDER BY con.id_goc, c.han, c.id`;
  return rows as unknown as SubTask[];
}
