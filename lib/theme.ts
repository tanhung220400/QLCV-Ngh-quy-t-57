import type postgres from "postgres";

type Q = postgres.Sql | postgres.TransactionSql;

export const LOAI_ANH: Record<string, string> = { menu: "Ảnh nền cột menu", chao: "Ảnh màn hình chào mừng" };

export type GiaoDien = {
  /** phiên bản ảnh (thời điểm tải lên), 0 = chưa có ảnh, dùng nền mặc định */
  menu_v: number;
  chao_v: number;
  /** bật màn hình chào mừng mỗi lần mở phần mềm */
  chao_bat: boolean;
  /** độ đậm lớp phủ màu trên ảnh menu (0.55–0.95) để chữ luôn dễ đọc */
  phu_menu: number;
};

export const GIAO_DIEN_MAC_DINH: GiaoDien = { menu_v: 0, chao_v: 0, chao_bat: true, phu_menu: 0.82 };

export async function getTheme(sql: Q): Promise<GiaoDien> {
  const r = (await sql`SELECT gia_tri FROM cai_dat WHERE khoa = 'giao_dien'`)[0];
  return { ...GIAO_DIEN_MAC_DINH, ...((r?.gia_tri as Partial<GiaoDien>) || {}) };
}

export async function saveTheme(sql: Q, patch: Partial<GiaoDien>) {
  const cur = await getTheme(sql);
  const v = { ...cur, ...patch };
  await sql`INSERT INTO cai_dat (khoa, gia_tri) VALUES ('giao_dien', ${sql.json(v as never)}) ON CONFLICT (khoa) DO UPDATE SET gia_tri = EXCLUDED.gia_tri`;
  return v;
}

export const themeImageUrl = (loai: "menu" | "chao", v: number) => (v ? `/api/giao-dien/${loai}?v=${v}` : null);
