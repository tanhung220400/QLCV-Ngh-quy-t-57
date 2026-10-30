import type { User } from "./auth";
import { db } from "./db";
import { taskScope, identities, allUnits, subtree } from "./perm";
import { TASK_LIST_FROM, TASK_LIST_SELECT, type TaskListItem } from "./tasks";
import { getHolidays, getSettings } from "./settings";
import { addWorkingDays, vnDate, fromVN } from "./time";

export type TaskFilter = {
  tab?: string;
  q?: string;
  trang_thai?: string;
  linh_vuc?: string;
  don_vi?: string;
  nguon?: string;
  nguoi?: string;
  uu_tien?: string;
  han_tu?: string;
  han_den?: string;
  con?: string; // '1' = gồm cả việc con
};

export const TABS: { key: string; label: string }[] = [
  { key: "cua_toi", label: "Việc của tôi" },
  { key: "toi_giao", label: "Việc tôi giao" },
  { key: "don_vi", label: "Việc của đơn vị" },
  { key: "sap_han", label: "Sắp đến hạn" },
  { key: "qua_han", label: "Quá hạn" },
  { key: "tat_ca", label: "Tất cả" },
];

export async function queryTasks(user: User, f: TaskFilter, limit = 300): Promise<TaskListItem[]> {
  const sql = await db();
  const scope = (await taskScope(sql, user)).q;
  const ids = (await identities(user)).map((i) => i.id);
  const conds = [scope];
  const tab = f.tab || "cua_toi";
  const OPEN = sql`cv.trang_thai IN ('moi_giao','da_nhan','dang_thuc_hien','cho_duyet','tra_lai','tam_dung')`;
  const WORKING = sql`cv.trang_thai IN ('moi_giao','da_nhan','dang_thuc_hien')`;
  if (tab === "cua_toi")
    conds.push(sql`(cv.id_chu_tri IN ${sql(ids)} OR cv.id_nguoi_thuc_hien IN ${sql(ids)}
      OR EXISTS (SELECT 1 FROM cong_viec_thanh_vien tv WHERE tv.id_cong_viec = cv.id AND tv.id_nguoi_dung IN ${sql(ids)} AND tv.vai_tro = 'phoi_hop'))`);
  else if (tab === "toi_giao") conds.push(sql`(cv.id_nguoi_giao IN ${sql(ids)} OR cv.id_nguoi_tao IN ${sql(ids)})`);
  else if (tab === "don_vi") {
    const units = await allUnits();
    const st = subtree(units, user.id_don_vi);
    conds.push(st.length ? sql`cv.id_don_vi_chu_tri IN ${sql(st)}` : sql`FALSE`);
  } else if (tab === "sap_han") {
    const cfg = await getSettings();
    const hol = await getHolidays();
    const lim = fromVN(addWorkingDays(vnDate(), cfg.nguong_vang, hol), "23:59");
    conds.push(WORKING, sql`cv.han >= now() AND cv.han <= ${lim}`);
  } else if (tab === "qua_han") conds.push(WORKING, sql`cv.han < now()`);

  if (f.trang_thai) {
    if (f.trang_thai === "dang_mo") conds.push(OPEN);
    else conds.push(sql`cv.trang_thai = ${f.trang_thai}`);
  } else if (!["sap_han", "qua_han"].includes(tab)) {
    // mặc định ẩn việc đã hủy
    conds.push(sql`cv.trang_thai <> 'huy'`);
  }
  if (f.q) conds.push(sql`(cv.ten ILIKE ${"%" + f.q + "%"} OR cv.so_hieu_vb ILIKE ${"%" + f.q + "%"} OR cv.cuoc_hop ILIKE ${"%" + f.q + "%"})`);
  if (f.linh_vuc) conds.push(sql`cv.linh_vuc = ${f.linh_vuc}`);
  if (f.nguon) conds.push(sql`cv.nguon_giao = ${f.nguon}`);
  if (f.uu_tien) conds.push(sql`cv.uu_tien = ${f.uu_tien}`);
  if (f.don_vi) conds.push(sql`cv.id_don_vi_chu_tri = ${Number(f.don_vi)}`);
  if (f.nguoi) conds.push(sql`(cv.id_chu_tri = ${Number(f.nguoi)} OR cv.id_nguoi_thuc_hien = ${Number(f.nguoi)})`);
  if (f.han_tu) conds.push(sql`cv.han >= ${fromVN(f.han_tu, "00:00")}`);
  if (f.han_den) conds.push(sql`cv.han <= ${fromVN(f.han_den, "23:59")}`);
  if (f.con !== "1" && tab !== "cua_toi") conds.push(sql`cv.id_cha IS NULL`);
  const where = conds.reduce((a, b) => sql`${a} AND ${b}`);
  const rows = await sql`
    SELECT ${sql.unsafe(TASK_LIST_SELECT)} FROM ${sql.unsafe(TASK_LIST_FROM)}
    WHERE ${where}
    ORDER BY CASE WHEN cv.trang_thai IN ('hoan_thanh','huy') THEN 1 ELSE 0 END,
             CASE cv.uu_tien WHEN 'hoa_toc' THEN 0 WHEN 'khan' THEN 1 ELSE 2 END, cv.han
    LIMIT ${limit}`;
  return rows as unknown as TaskListItem[];
}
