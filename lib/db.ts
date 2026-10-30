import postgres from "postgres";
import { SCHEMA_SQL, SCHEMA_VERSION } from "./schema";

declare global {
  // eslint-disable-next-line no-var
  var __sql: postgres.Sql | undefined;
  // eslint-disable-next-line no-var
  var __schemaReady: Promise<void> | undefined;
}

function connString() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    ""
  );
}

export function hasDatabase() {
  return connString() !== "";
}

function makeClient() {
  const url = connString();
  if (!url) throw new Error("CHUA_CO_CSDL");
  const local = /localhost|127\.0\.0\.1|host=\//.test(url);
  return postgres(url, {
    max: 5,
    idle_timeout: 20,
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
  await s.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(570057)`;
    await tx.unsafe(`CREATE TABLE IF NOT EXISTS cai_dat (khoa TEXT PRIMARY KEY, gia_tri JSONB NOT NULL)`);
    const r = await tx`SELECT gia_tri FROM cai_dat WHERE khoa = 'schema_version'`;
    const v = r.length ? Number(r[0].gia_tri) : 0;
    if (v >= SCHEMA_VERSION) return;
    await tx.unsafe(SCHEMA_SQL);
    await tx`INSERT INTO cai_dat (khoa, gia_tri) VALUES ('schema_version', ${tx.json(SCHEMA_VERSION)})
             ON CONFLICT (khoa) DO UPDATE SET gia_tri = EXCLUDED.gia_tri`;
  });
}

export async function ensureSchema() {
  if (!global.__schemaReady) {
    global.__schemaReady = migrate().catch((e) => {
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
