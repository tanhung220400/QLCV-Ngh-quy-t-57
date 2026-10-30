import type postgres from "postgres";
import type { User } from "./auth";
import { db } from "./db";

export type Identity = {
  id: number;
  vai_tro: string;
  id_don_vi: number | null;
  linh_vuc_phu_trach: string[];
};

type DonViRow = { id: number; id_cha: number | null };

export async function allUnits(): Promise<DonViRow[]> {
  const sql = await db();
  return (await sql`SELECT id, id_cha FROM don_vi`) as unknown as DonViRow[];
}

export function subtree(units: DonViRow[], root: number | null): number[] {
  if (!root) return [];
  const out = [root];
  for (let i = 0; i < out.length; i++) for (const u of units) if (u.id_cha === out[i] && !out.includes(u.id)) out.push(u.id);
  return out;
}

/** Bản thân + những người đã ủy quyền cho mình hôm nay */
export async function identities(user: User): Promise<Identity[]> {
  const me: Identity = { id: user.id, vai_tro: user.vai_tro, id_don_vi: user.id_don_vi, linh_vuc_phu_trach: user.linh_vuc_phu_trach };
  if (!user.uy_quyen_tu.length) return [me];
  const sql = await db();
  const rows = await sql`SELECT id, vai_tro, id_don_vi, linh_vuc_phu_trach FROM nguoi_dung WHERE id IN ${sql(user.uy_quyen_tu)}`;
  return [me, ...(rows as unknown as Identity[])];
}

export const seesAll = (i: Identity) =>
  i.vai_tro === "quan_tri" || i.vai_tro === "tong_hop" || (i.vai_tro === "lanh_dao" && i.linh_vuc_phu_trach.length === 0);

/** Điều kiện SQL giới hạn các công việc người dùng được xem (bảng alias cv) */
export async function taskScope(sql: postgres.Sql, user: User): Promise<postgres.PendingQuery<postgres.Row[]>> {
  const ids = await identities(user);
  if (ids.some(seesAll)) return sql`TRUE`;
  const units = await allUnits();
  const parts: postgres.PendingQuery<postgres.Row[]>[] = [];
  const personIds = ids.map((i) => i.id);
  parts.push(sql`(cv.id_chu_tri IN ${sql(personIds)} OR cv.id_nguoi_giao IN ${sql(personIds)} OR cv.id_nguoi_thuc_hien IN ${sql(personIds)} OR cv.id_nguoi_tao IN ${sql(personIds)}
     OR EXISTS (SELECT 1 FROM cong_viec_thanh_vien tv WHERE tv.id_cong_viec = cv.id AND tv.id_nguoi_dung IN ${sql(personIds)}))`);
  for (const i of ids) {
    if (i.vai_tro === "lanh_dao" && i.linh_vuc_phu_trach.length) parts.push(sql`cv.linh_vuc IN ${sql(i.linh_vuc_phu_trach)}`);
    if (i.vai_tro === "truong_don_vi" && i.id_don_vi) {
      const st = subtree(units, i.id_don_vi);
      parts.push(sql`cv.id_don_vi_chu_tri IN ${sql(st)}`);
    }
  }
  return parts.reduce((a, b) => sql`${a} OR ${b}`);
}

export async function kpiScope(sql: postgres.Sql, user: User): Promise<postgres.PendingQuery<postgres.Row[]>> {
  const ids = await identities(user);
  if (ids.some(seesAll) || ids.some((i) => i.vai_tro === "lanh_dao")) return sql`TRUE`;
  const units = await allUnits();
  const personIds = ids.map((i) => i.id);
  const unitIds = ids.flatMap((i) => (i.vai_tro === "truong_don_vi" ? subtree(units, i.id_don_vi) : []));
  if (unitIds.length) return sql`(ct.id_phu_trach IN ${sql(personIds)} OR ct.id_don_vi_phu_trach IN ${sql(unitIds)})`;
  return sql`ct.id_phu_trach IN ${sql(personIds)}`;
}

export const canCreateTask = (u: User) => ["lanh_dao", "truong_don_vi", "tong_hop"].includes(u.vai_tro) || u.uy_quyen_tu.length > 0;
export const isAdmin = (u: User) => u.vai_tro === "quan_tri";
export const isLeader = (u: User) => u.vai_tro === "lanh_dao";
export const canManageKpi = (u: User) => ["lanh_dao", "tong_hop", "quan_tri"].includes(u.vai_tro);

export type TaskRow = {
  id: number;
  trang_thai: string;
  id_nguoi_giao: number;
  id_chu_tri: number;
  id_nguoi_thuc_hien: number | null;
  id_don_vi_chu_tri: number | null;
  linh_vuc: string;
  id_nguoi_tao: number;
};

export type TaskPerms = {
  xem: boolean;
  nhan: boolean;
  tra_lai: boolean;
  giao_lai: boolean;
  cap_nhat: boolean;
  bao_cao: boolean;
  xin_gia_han: boolean;
  duyet: boolean; // duyệt kết quả, duyệt gia hạn
  quan_ly: boolean; // sửa, tạm dừng, hủy, giao lại người chủ trì
  viec_con: boolean;
};

export async function taskPerms(user: User, t: TaskRow): Promise<TaskPerms> {
  const ids = await identities(user);
  const pid = ids.map((i) => i.id);
  const units = await allUnits();
  const isOwner = pid.includes(t.id_chu_tri);
  const isDoer = t.id_nguoi_thuc_hien != null && pid.includes(t.id_nguoi_thuc_hien);
  const isAssigner = pid.includes(t.id_nguoi_giao) || pid.includes(t.id_nguoi_tao);
  const leaderOver = ids.some((i) => i.vai_tro === "lanh_dao" && (i.linh_vuc_phu_trach.length === 0 || i.linh_vuc_phu_trach.includes(t.linh_vuc)));
  const unitHead = ids.some((i) => i.vai_tro === "truong_don_vi" && t.id_don_vi_chu_tri != null && subtree(units, i.id_don_vi).includes(t.id_don_vi_chu_tri));
  const sql = await db();
  const member = (await sql`SELECT 1 FROM cong_viec_thanh_vien WHERE id_cong_viec = ${t.id} AND id_nguoi_dung IN ${sql(pid)} LIMIT 1`).length > 0;
  const xem = ids.some(seesAll) || isOwner || isDoer || isAssigner || leaderOver || unitHead || member;
  const s = t.trang_thai;
  const open = !["hoan_thanh", "huy"].includes(s);
  const working = ["da_nhan", "dang_thuc_hien"].includes(s);
  return {
    xem,
    nhan: s === "moi_giao" && (isOwner || unitHead),
    tra_lai: (s === "moi_giao" || s === "da_nhan") && (isOwner || unitHead),
    giao_lai: open && s !== "cho_duyet" && s !== "tra_lai" && (isOwner || unitHead) && ids.some((i) => ["truong_don_vi", "lanh_dao"].includes(i.vai_tro)),
    cap_nhat: working && (isOwner || isDoer),
    bao_cao: working && (isOwner || isDoer),
    xin_gia_han: open && s !== "tra_lai" && s !== "tam_dung" && (isOwner || isDoer),
    duyet: isAssigner || leaderOver,
    quan_ly: isAssigner || leaderOver || user.vai_tro === "quan_tri",
    viec_con: open && (isOwner || isDoer || isAssigner || unitHead),
  };
}
