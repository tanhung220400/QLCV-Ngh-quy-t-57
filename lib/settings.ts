import type postgres from "postgres";
import { db } from "./db";
import { CAI_DAT_MAC_DINH, type CaiDat, DANH_MUC_MAC_DINH } from "./const";

export async function getSettings(): Promise<CaiDat> {
  const sql = await db();
  const r = await sql`SELECT gia_tri FROM cai_dat WHERE khoa = 'chung'`;
  return { ...CAI_DAT_MAC_DINH, ...((r[0]?.gia_tri as Partial<CaiDat>) || {}) };
}

export async function saveSettings(s: Partial<CaiDat>) {
  const sql = await db();
  const cur = await getSettings();
  const v = { ...cur, ...s };
  await sql`INSERT INTO cai_dat (khoa, gia_tri) VALUES ('chung', ${sql.json(v as never)})
            ON CONFLICT (khoa) DO UPDATE SET gia_tri = EXCLUDED.gia_tri`;
}

export async function getHolidays(): Promise<Set<string>> {
  const sql = await db();
  const r = await sql`SELECT to_char(ngay, 'YYYY-MM-DD') AS d FROM ngay_nghi`;
  return new Set(r.map((x) => x.d as string));
}

export async function getCatalog(loai: string): Promise<string[]> {
  const sql = await db();
  const r = await sql`SELECT ten FROM danh_muc WHERE loai = ${loai} ORDER BY thu_tu, id`;
  return r.length ? r.map((x) => x.ten as string) : DANH_MUC_MAC_DINH[loai] || [];
}

export async function seedCatalogs(sql: postgres.Sql | postgres.TransactionSql) {
  for (const [loai, list] of Object.entries(DANH_MUC_MAC_DINH)) {
    let i = 0;
    for (const ten of list) {
      await sql`INSERT INTO danh_muc (loai, ten, thu_tu) VALUES (${loai}, ${ten}, ${i++}) ON CONFLICT DO NOTHING`;
    }
  }
}

/** Ngày lễ, Tết cố định và Tết Nguyên đán 2026-2027 (quản trị có thể sửa) */
export const NGAY_NGHI_MAC_DINH: [string, string][] = [
  ["2026-01-01", "Tết Dương lịch"],
  ["2026-02-16", "Tết Nguyên đán"],
  ["2026-02-17", "Tết Nguyên đán"],
  ["2026-02-18", "Tết Nguyên đán"],
  ["2026-02-19", "Tết Nguyên đán"],
  ["2026-02-20", "Tết Nguyên đán"],
  ["2026-04-27", "Giỗ Tổ Hùng Vương (nghỉ bù)"],
  ["2026-04-30", "Ngày Giải phóng miền Nam"],
  ["2026-05-01", "Quốc tế Lao động"],
  ["2026-09-01", "Quốc khánh"],
  ["2026-09-02", "Quốc khánh"],
  ["2027-01-01", "Tết Dương lịch"],
  ["2027-02-05", "Tết Nguyên đán"],
  ["2027-02-08", "Tết Nguyên đán"],
  ["2027-02-09", "Tết Nguyên đán"],
  ["2027-02-10", "Tết Nguyên đán"],
  ["2027-02-11", "Tết Nguyên đán"],
  ["2027-04-16", "Giỗ Tổ Hùng Vương"],
  ["2027-04-30", "Ngày Giải phóng miền Nam"],
  ["2027-05-03", "Quốc tế Lao động (nghỉ bù)"],
  ["2027-09-02", "Quốc khánh"],
  ["2027-09-03", "Quốc khánh"],
];
