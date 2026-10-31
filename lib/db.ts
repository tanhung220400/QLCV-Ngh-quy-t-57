import postgres from "postgres";
import { SCHEMA_SQL, SCHEMA_VERSION } from "./schema";
import { seedModules } from "./modules";

declare global {
  // eslint-disable-next-line no-var
  var __sql: postgres.Sql | undefined;
  // eslint-disable-next-line no-var
  var __schemaReady: Promise<void> | undefined;
}

function connString() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    ""
  );
}

export function hasDatabase() {
  return connString() !== "";
}

/**
 * Schema riêng cho phần mềm. Mặc định dùng "qlcv" khi chạy trên Supabase để:
 * - không lộ bảng qua Data API của Supabase (chỉ mở schema public),
 * - không đụng tên bảng với ứng dụng khác dùng chung cơ sở dữ liệu.
 */
export function dbSchema(): string | null {
  const s = process.env.DB_SCHEMA || (/supabase\.(co|com)/.test(connString()) ? "qlcv" : "");
  return /^[a-z_][a-z0-9_]{0,40}$/.test(s) ? s : null;
}

function makeClient() {
  const url = connString();
  if (!url) throw new Error("CHUA_CO_CSDL");
  const local = /localhost|127\.0\.0\.1|host=\//.test(url);
  const schema = dbSchema();
  return postgres(url, {
    // Supabase Session pooler giới hạn 15 kết nối cho cả dự án: mỗi phiên bản hàm chỉ giữ ít kết nối và trả lại nhanh
    max: Number(process.env.DB_POOL_MAX) || 2,
    max_lifetime: 120,
    // Tự hủy giao dịch bỏ dở (hàm serverless bị dừng giữa chừng) để không giữ khóa mãi
    connection: { ...(schema ? { search_path: schema } : {}), idle_in_transaction_session_timeout: 20000 } as never,
    idle_timeout: 5,
    connect_timeout: 15,
    prepare: false, // tương thích PgBouncer/Neon pooler
    ssl: local ? false : "require",
    onnotice: () => {},
    types: {
      // NUMERIC -> number
      numeric: { to: 1700, from: [1700], serialize: (x: unknown) => String(x), parse: (x: string) => Number(x) },
    } as never,
  });
}

export function rawSql(): postgres.Sql {
  if (!global.__sql) global.__sql = makeClient();
  return global.__sql;
}

async function migrate() {
  const s = rawSql();
  // Kiểm tra nhanh, không khóa: đã đúng phiên bản thì bỏ qua
  try {
    const q = await s`SELECT gia_tri FROM cai_dat WHERE khoa = 'schema_version'`;
    if (q.length && Number(q[0].gia_tri) >= SCHEMA_VERSION) return;
  } catch {
    /* chưa có bảng: tiếp tục tạo */
  }
  await s.begin(async (tx) => {
    await tx`SET LOCAL lock_timeout = '25s'`;
    await tx`SET LOCAL idle_in_transaction_session_timeout = '20s'`;
    await tx`SELECT pg_advisory_xact_lock(570057)`;
    const schema = dbSchema();
    if (schema) {
      await tx.unsafe(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
      await tx.unsafe(`SET LOCAL search_path TO "${schema}"`);
    }
    await tx.unsafe(`CREATE TABLE IF NOT EXISTS cai_dat (khoa TEXT PRIMARY KEY, gia_tri JSONB NOT NULL)`);
    const r = await tx`SELECT gia_tri FROM cai_dat WHERE khoa = 'schema_version'`;
    const v = r.length ? Number(r[0].gia_tri) : 0;
    if (v >= SCHEMA_VERSION) return;
    await tx.unsafe(SCHEMA_SQL);
    await seedModules(tx);
    await tx`INSERT INTO cai_dat (khoa, gia_tri) VALUES ('schema_version', ${tx.json(SCHEMA_VERSION)})
             ON CONFLICT (khoa) DO UPDATE SET gia_tri = EXCLUDED.gia_tri`;
  });
}

async function checkSearchPath() {
  const schema = dbSchema();
  if (!schema) return;
  const r = await rawSql()`SELECT current_schema() AS s`;
  if (r[0].s !== schema)
    throw new Error(
      `Kết nối không giữ được schema "${schema}" (đang là "${r[0].s}"). Kiểm tra lại chuỗi kết nối cơ sở dữ liệu (Supabase: dùng Session pooler cổng 5432; Transaction pooler cổng 6543 có thể treo với thư viện postgres.js).`,
    );
}

export async function ensureSchema() {
  if (!global.__schemaReady) {
    global.__schemaReady = migrate().then(checkSearchPath).catch((e) => {
      global.__schemaReady = undefined;
      throw e;
    });
  }
  return global.__schemaReady;
}

/** Trả về client SQL đã bảo đảm có bảng. */
export async function db() {
  await ensureSchema();
  return rawSql();
}
