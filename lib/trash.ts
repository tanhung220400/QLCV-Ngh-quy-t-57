import type postgres from "postgres";
import { writeLog } from "./log";

type Tx = postgres.TransactionSql;
type Bang = { t: string; rows: Record<string, unknown>[] };

/** Đóng gói dòng dữ liệu để lưu JSON (tệp nhị phân → base64) */
function pack(rows: postgres.Row[]): Record<string, unknown>[] {
  return rows.map((r) => {
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r)) o[k] = Buffer.isBuffer(v) ? { __b64: v.toString("base64") } : v;
    return o;
  });
}

function unpack(tx: Tx, rows: Record<string, unknown>[]) {
  return rows.map((r) => {
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r)) {
      if (v && typeof v === "object" && !Array.isArray(v) && "__b64" in (v as object)) o[k] = Buffer.from((v as { __b64: string }).__b64, "base64");
      else if (v && typeof v === "object" && !Array.isArray(v)) o[k] = tx.json(v as never);
      else o[k] = v;
    }
    return o;
  });
}

async function put(tx: Tx, loai: string, id: number, tieu_de: string, bang: Bang[], uid: number, ly_do: string | null) {
  const [r] = await tx`INSERT INTO thung_rac (loai, id_goc, tieu_de, du_lieu, id_nguoi_xoa, ly_do) VALUES (${loai}, ${id}, ${tieu_de}, ${tx.json(bang as never)}, ${uid}, ${ly_do}) RETURNING id`;
  await writeLog(tx, uid, "xoa", loai, id, { tieu_de, thung_rac: r.id }, { ly_do });
  return r.id as number;
}

async function delRows(tx: Tx, bang: Bang[]) {
  // xóa theo thứ tự ngược với thứ tự khôi phục
  for (const b of [...bang].reverse()) {
    const ids = b.rows.map((r) => r.id).filter((x) => x != null) as number[];
    if (b.t === "cong_viec_thanh_vien" || b.t === "cong_viec_chi_tieu" || b.t === "chi_tieu_ke_hoach_ky") continue; // đã xóa theo khóa ngoài bên dưới
    if (ids.length) await tx`DELETE FROM ${tx(b.t)} WHERE id IN ${tx(ids)}`;
  }
}

// ---------- Công việc (kèm việc con) ----------
export async function trashTask(tx: Tx, id: number, uid: number, ly_do: string | null) {
  const all = await tx`WITH RECURSIVE t AS (SELECT id FROM cong_viec WHERE id = ${id} UNION SELECT c.id FROM cong_viec c JOIN t ON c.id_cha = t.id) SELECT id FROM t`;
  const ids = all.map((r) => r.id as number);
  if (!ids.length) return null;
  const tasks = await tx`SELECT * FROM cong_viec WHERE id IN ${tx(ids)} ORDER BY id`;
  // cha trước con
  const ordered: postgres.Row[] = [];
  const left = [...tasks];
  while (left.length) {
    const i = left.findIndex((t) => !t.id_cha || !ids.includes(t.id_cha) || ordered.some((o) => o.id === t.id_cha));
    ordered.push(...left.splice(i < 0 ? 0 : i, 1));
  }
  for (const t of ordered) if (t.id_goc_dinh_ky && !ids.includes(t.id_goc_dinh_ky)) t.id_goc_dinh_ky = null;
  const bang: Bang[] = [
    { t: "cong_viec", rows: pack(ordered) },
    { t: "cong_viec_thanh_vien", rows: pack(await tx`SELECT * FROM cong_viec_thanh_vien WHERE id_cong_viec IN ${tx(ids)}`) },
    { t: "cong_viec_chi_tieu", rows: pack(await tx`SELECT * FROM cong_viec_chi_tieu WHERE id_cong_viec IN ${tx(ids)}`) },
    { t: "checklist", rows: pack(await tx`SELECT * FROM checklist WHERE id_cong_viec IN ${tx(ids)}`) },
    { t: "gia_han", rows: pack(await tx`SELECT * FROM gia_han WHERE id_cong_viec IN ${tx(ids)}`) },
    { t: "binh_luan", rows: pack(await tx`SELECT * FROM binh_luan WHERE id_cong_viec IN ${tx(ids)}`) },
    { t: "tep_dinh_kem", rows: pack(await tx`SELECT * FROM tep_dinh_kem WHERE doi_tuong = 'cong_viec' AND id_doi_tuong IN ${tx(ids)}`) },
  ];
  const tid = await put(tx, "cong_viec", id, String(tasks.find((t) => t.id === id)?.ten || `Việc #${id}`) + (ids.length > 1 ? ` (kèm ${ids.length - 1} việc con)` : ""), bang, uid, ly_do);
  await tx`UPDATE cong_viec SET id_goc_dinh_ky = NULL WHERE id_goc_dinh_ky IN ${tx(ids)} AND id NOT IN ${tx(ids)}`;
  await tx`DELETE FROM cong_viec_thanh_vien WHERE id_cong_viec IN ${tx(ids)}`;
  await tx`DELETE FROM cong_viec_chi_tieu WHERE id_cong_viec IN ${tx(ids)}`;
  await tx`DELETE FROM thong_bao WHERE doi_tuong = 'cong_viec' AND id_doi_tuong IN ${tx(ids)}`;
  await delRows(tx, bang);
  return tid;
}

// ---------- Chỉ tiêu (kèm phần phân rã, số liệu, kế hoạch kỳ) ----------
export async function trashKpi(tx: Tx, id: number, uid: number, ly_do: string | null) {
  const all = await tx`WITH RECURSIVE t AS (SELECT id FROM chi_tieu WHERE id = ${id} UNION SELECT c.id FROM chi_tieu c JOIN t ON c.id_cha = t.id) SELECT id FROM t`;
  const ids = all.map((r) => r.id as number);
  if (!ids.length) return null;
  const kpis = await tx`SELECT * FROM chi_tieu WHERE id IN ${tx(ids)} ORDER BY (id_cha IS NOT NULL), id`;
  const sl = await tx`SELECT * FROM chi_tieu_so_lieu WHERE id_chi_tieu IN ${tx(ids)}`;
  const slIds = sl.map((r) => r.id as number);
  const bang: Bang[] = [
    { t: "chi_tieu", rows: pack(kpis) },
    { t: "chi_tieu_ke_hoach_ky", rows: pack(await tx`SELECT * FROM chi_tieu_ke_hoach_ky WHERE id_chi_tieu IN ${tx(ids)}`) },
    { t: "chi_tieu_so_lieu", rows: pack(sl) },
    { t: "cong_viec_chi_tieu", rows: pack(await tx`SELECT * FROM cong_viec_chi_tieu WHERE id_chi_tieu IN ${tx(ids)}`) },
    { t: "tep_dinh_kem", rows: slIds.length ? pack(await tx`SELECT * FROM tep_dinh_kem WHERE doi_tuong = 'so_lieu' AND id_doi_tuong IN ${tx(slIds)}`) : [] },
  ];
  const tid = await put(tx, "chi_tieu", id, String(kpis.find((k) => k.id === id)?.ten || `Chỉ tiêu #${id}`), bang, uid, ly_do);
  await tx`DELETE FROM chi_tieu_ke_hoach_ky WHERE id_chi_tieu IN ${tx(ids)}`;
  await tx`DELETE FROM cong_viec_chi_tieu WHERE id_chi_tieu IN ${tx(ids)}`;
  await tx`DELETE FROM thong_bao WHERE doi_tuong = 'chi_tieu' AND id_doi_tuong IN ${tx(ids)}`;
  // chi_tieu: con trước cha khi xóa
  const tep = bang[4].rows.map((r) => r.id as number);
  if (tep.length) await tx`DELETE FROM tep_dinh_kem WHERE id IN ${tx(tep)}`;
  if (slIds.length) await tx`DELETE FROM chi_tieu_so_lieu WHERE id IN ${tx(slIds)}`;
  for (const k of [...kpis].reverse()) await tx`DELETE FROM chi_tieu WHERE id = ${k.id}`;
  return tid;
}

// ---------- Bản ghi module ----------
export async function trashRecord(tx: Tx, id: number, uid: number, ly_do: string | null, tieu_de: string) {
  const rows = await tx`SELECT * FROM mo_dun_ban_ghi WHERE id = ${id}`;
  if (!rows.length) return null;
  const bang: Bang[] = [
    { t: "mo_dun_ban_ghi", rows: pack(rows) },
    { t: "tep_dinh_kem", rows: pack(await tx`SELECT * FROM tep_dinh_kem WHERE doi_tuong = 'ban_ghi' AND id_doi_tuong = ${id}`) },
  ];
  const tid = await put(tx, "ban_ghi", id, tieu_de, bang, uid, ly_do);
  await delRows(tx, bang);
  return tid;
}

// ---------- Module (kèm module con, trường, dữ liệu) ----------
export async function trashModule(tx: Tx, id: number, uid: number, ly_do: string | null) {
  const all = await tx`WITH RECURSIVE t AS (SELECT id FROM mo_dun WHERE id = ${id} UNION SELECT c.id FROM mo_dun c JOIN t ON c.id_cha = t.id) SELECT id FROM t`;
  const ids = all.map((r) => r.id as number);
  const mods = await tx`SELECT * FROM mo_dun WHERE id IN ${tx(ids)} ORDER BY (id_cha IS NOT NULL), id`;
  if (mods.some((m) => m.loai === "he_thong")) throw new Error("Module hệ thống chỉ có thể ẩn, không xóa được. Hãy chuyển module hệ thống ra khỏi nhóm trước khi xóa nhóm.");
  const recs = await tx`SELECT * FROM mo_dun_ban_ghi WHERE id_mo_dun IN ${tx(ids)}`;
  const recIds = recs.map((r) => r.id as number);
  const bang: Bang[] = [
    { t: "mo_dun", rows: pack(mods) },
    { t: "mo_dun_truong", rows: pack(await tx`SELECT * FROM mo_dun_truong WHERE id_mo_dun IN ${tx(ids)}`) },
    { t: "mo_dun_ban_ghi", rows: pack(recs) },
    { t: "tep_dinh_kem", rows: recIds.length ? pack(await tx`SELECT * FROM tep_dinh_kem WHERE doi_tuong = 'ban_ghi' AND id_doi_tuong IN ${tx(recIds)}`) : [] },
  ];
  const tid = await put(tx, "mo_dun", id, `${mods.find((m) => m.id === id)?.ten || "Module"}${recs.length ? ` (${recs.length} bản ghi)` : ""}`, bang, uid, ly_do);
  const tep = bang[3].rows.map((r) => r.id as number);
  if (tep.length) await tx`DELETE FROM tep_dinh_kem WHERE id IN ${tx(tep)}`;
  if (recIds.length) await tx`DELETE FROM mo_dun_ban_ghi WHERE id IN ${tx(recIds)}`;
  await tx`DELETE FROM mo_dun_truong WHERE id_mo_dun IN ${tx(ids)}`;
  for (const m of [...mods].reverse()) await tx`DELETE FROM mo_dun WHERE id = ${m.id}`;
  return tid;
}

// ---------- Dòng đơn lẻ: số liệu chỉ tiêu, bình luận, tệp ----------
export async function trashSimple(tx: Tx, table: "chi_tieu_so_lieu" | "binh_luan" | "tep_dinh_kem", loai: string, id: number, uid: number, tieu_de: string, ly_do: string | null) {
  const rows = await tx`SELECT * FROM ${tx(table)} WHERE id = ${id}`;
  if (!rows.length) return null;
  const bang: Bang[] = [{ t: table, rows: pack(rows) }];
  if (table === "chi_tieu_so_lieu") bang.push({ t: "tep_dinh_kem", rows: pack(await tx`SELECT * FROM tep_dinh_kem WHERE doi_tuong = 'so_lieu' AND id_doi_tuong = ${id}`) });
  const tid = await put(tx, loai, id, tieu_de, bang, uid, ly_do);
  await delRows(tx, bang);
  return tid;
}

/** Khôi phục: chèn lại đúng các dòng đã lưu */
export async function restore(tx: Tx, trashId: number, uid: number) {
  const r = (await tx`SELECT * FROM thung_rac WHERE id = ${trashId} AND trang_thai = 'trong_thung' FOR UPDATE`)[0];
  if (!r) throw new Error("Mục này không còn trong thùng rác.");
  const bang = r.du_lieu as Bang[];
  for (const b of bang) {
    if (!b.rows.length) continue;
    const rows = unpack(tx, b.rows);
    for (const row of rows) await tx`INSERT INTO ${tx(b.t)} ${tx(row as never)} ON CONFLICT DO NOTHING`;
  }
  await tx`UPDATE thung_rac SET trang_thai = 'da_khoi_phuc' WHERE id = ${trashId}`;
  await writeLog(tx, uid, "khoi_phuc", r.loai, r.id_goc, null, { thung_rac: trashId, tieu_de: r.tieu_de });
  return r as { loai: string; id_goc: number; tieu_de: string };
}

/** Xóa hẳn khỏi thùng rác (bỏ ảnh chụp dữ liệu, giữ dòng để biết đã xóa) */
export async function purge(tx: Tx, trashId: number, uid: number) {
  const r = (await tx`UPDATE thung_rac SET trang_thai = 'da_xoa_han', du_lieu = '[]'::jsonb WHERE id = ${trashId} AND trang_thai = 'trong_thung' RETURNING loai, id_goc, tieu_de`)[0];
  if (r) await writeLog(tx, uid, "xoa_han", r.loai, r.id_goc, null, { thung_rac: trashId, tieu_de: r.tieu_de });
}
