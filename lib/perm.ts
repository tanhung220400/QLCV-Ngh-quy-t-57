import type postgres from "postgres";
import type { User } from "./auth";
import { db } from "./db";
import { tinhPhamVi, type PhamVi } from "./quyen";

export type Identity = {
  id: number;
  vai_tro: string;
  id_don_vi: number | null;
  linh_vuc_phu_trach: string[];
  pham_vi: PhamVi;
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
  const me: Identity = { id: user.id, vai_tro: user.vai_tro, id_don_vi: user.id_don_vi, linh_vuc_phu_trach: user.linh_vuc_phu_trach, pham_vi: user.pham_vi };
  if (!user.uy_quyen_tu.length) return [me];
  const sql = await db();
  const rows = await sql`SELECT id, vai_tro, id_don_vi, id_don_vi_kiem_nhiem, linh_vuc_phu_trach, pham_vi FROM nguoi_dung WHERE id IN ${sql(user.uy_quyen_tu)}`;
  return [
    me,
    ...rows.map((r) => ({
      id: r.id,
      vai_tro: r.vai_tro,
      id_don_vi: r.id_don_vi,
      linh_vuc_phu_trach: r.linh_vuc_phu_trach || [],
      pham_vi: tinhPhamVi(r.vai_tro, r.id_don_vi, r.linh_vuc_phu_trach || [], r.pham_vi, r.id_don_vi_kiem_nhiem),
    })),
  ];
}

export const seesAll = (i: Identity) => i.pham_vi.loai === "toan_xa";

/** Danh sách đơn vị (kể cả đơn vị con) và lĩnh vực mà các danh tính được xem */
export async function scopeSets(ids: Identity[]) {
  const units = await allUnits();
  const donVi = new Set<number>();
  const linhVuc = new Set<string>();
  for (const i of ids) {
    if (i.pham_vi.loai === "don_vi") for (const d of i.pham_vi.don_vi) for (const x of subtree(units, d)) donVi.add(x);
    if (i.pham_vi.loai === "linh_vuc") for (const l of i.pham_vi.linh_vuc) linhVuc.add(l);
  }
  return { donVi: [...donVi], linhVuc: [...linhVuc], units };
}

export type Scope = { q: postgres.PendingQuery<postgres.Row[]> };

/**
 * Điều kiện SQL giới hạn các công việc người dùng được xem (bảng alias cv).
 * Trả về { q } (bọc trong object vì fragment của postgres.js là "thenable", await trực tiếp sẽ bị chạy như truy vấn).
 * Ai cũng luôn xem được việc mình giao, chủ trì, thực hiện, phối hợp, theo dõi.
 */
export async function taskScope(sql: postgres.Sql, user: User): Promise<Scope> {
  const ids = await identities(user);
  if (ids.some(seesAll)) return { q: sql`TRUE` };
  const personIds = ids.map((i) => i.id);
  const parts: postgres.PendingQuery<postgres.Row[]>[] = [
    sql`(cv.id_chu_tri IN ${sql(personIds)} OR cv.id_nguoi_giao IN ${sql(personIds)} OR cv.id_nguoi_thuc_hien IN ${sql(personIds)} OR cv.id_nguoi_tao IN ${sql(personIds)}
     OR EXISTS (SELECT 1 FROM cong_viec_thanh_vien tv WHERE tv.id_cong_viec = cv.id AND tv.id_nguoi_dung IN ${sql(personIds)}))`,
  ];
  const { donVi, linhVuc } = await scopeSets(ids);
  if (linhVuc.length) parts.push(sql`cv.linh_vuc IN ${sql(linhVuc)}`);
  if (donVi.length) parts.push(sql`cv.id_don_vi_chu_tri IN ${sql(donVi)}`);
  return { q: parts.reduce((a, b) => sql`${a} OR ${b}`) };
}

/** Điều kiện SQL cho chỉ tiêu (bảng alias ct): theo phạm vi được phân công */
export async function kpiScope(sql: postgres.Sql, user: User): Promise<Scope> {
  if (!user.quyen.includes("ct.xem")) return { q: sql`FALSE` };
  const ids = await identities(user);
  if (ids.some(seesAll)) return { q: sql`TRUE` };
  const personIds = ids.map((i) => i.id);
  const parts: postgres.PendingQuery<postgres.Row[]>[] = [sql`(ct.id_phu_trach IN ${sql(personIds)} OR ct.id_lanh_dao IN ${sql(personIds)})`];
  const { donVi, linhVuc } = await scopeSets(ids);
  if (linhVuc.length) parts.push(sql`ct.linh_vuc IN ${sql(linhVuc)}`);
  if (donVi.length) parts.push(sql`ct.id_don_vi_phu_trach IN ${sql(donVi)}`);
  // phần phân rã của chỉ tiêu được xem thì cũng được xem
  const base = parts.reduce((a, b) => sql`${a} OR ${b}`);
  return { q: sql`(${base} OR EXISTS (SELECT 1 FROM chi_tieu p WHERE p.id = ct.id_cha AND (p.id_phu_trach IN ${sql(personIds)})))` };
}

/** Kiểm tra một chỉ tiêu có thuộc phạm vi xem không */
export async function canSeeKpi(user: User, id: number): Promise<boolean> {
  const sql = await db();
  const s = (await kpiScope(sql, user)).q;
  return (await sql`SELECT 1 FROM chi_tieu ct WHERE ct.id = ${id} AND (${s})`).length > 0;
}

export const canCreateTask = (u: User) => u.quyen.includes("cv.giao_cap1") || u.quyen.includes("cv.giao_cap2");
export const isAdmin = (u: User) => u.quyen.some((q) => q.startsWith("qt."));
export const isLeader = (u: User) => u.vai_tro === "lanh_dao";
export const canManageKpi = (u: User) => u.quyen.includes("ct.quan_ly");

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
  duyet: boolean; // duyệt gia hạn
  /** xác nhận kết quả: chỉ người giao việc (hoặc người tạo) và quản trị dữ liệu */
  xac_nhan: boolean;
  quan_ly: boolean; // sửa, tạm dừng, hủy, giao lại người chủ trì
  viec_con: boolean;
  /** Quản trị dữ liệu: sửa mọi trường, xóa vào thùng rác */
  admin: boolean;
};

export async function taskPerms(user: User, t: TaskRow): Promise<TaskPerms> {
  const ids = await identities(user);
  const pid = ids.map((i) => i.id);
  const { donVi, linhVuc } = await scopeSets(ids);
  const isOwner = pid.includes(t.id_chu_tri);
  const isDoer = t.id_nguoi_thuc_hien != null && pid.includes(t.id_nguoi_thuc_hien);
  const isAssigner = pid.includes(t.id_nguoi_giao) || pid.includes(t.id_nguoi_tao);
  const inScope = ids.some(seesAll) || linhVuc.includes(t.linh_vuc) || (t.id_don_vi_chu_tri != null && donVi.includes(t.id_don_vi_chu_tri));
  const unitHead = ids.some((i) => i.vai_tro === "truong_don_vi") && t.id_don_vi_chu_tri != null && donVi.includes(t.id_don_vi_chu_tri);
  const sql = await db();
  const member = (await sql`SELECT 1 FROM cong_viec_thanh_vien WHERE id_cong_viec = ${t.id} AND id_nguoi_dung IN ${sql(pid)} LIMIT 1`).length > 0;
  const q = new Set(user.quyen);
  const admin = q.has("qt.du_lieu");
  const xem = admin || inScope || isOwner || isDoer || isAssigner || member;
  const s = t.trang_thai;
  const open = !["hoan_thanh", "huy"].includes(s);
  const working = ["da_nhan", "dang_thuc_hien"].includes(s);
  return {
    xem,
    nhan: s === "moi_giao" && (isOwner || unitHead),
    tra_lai: (s === "moi_giao" || s === "da_nhan") && (isOwner || unitHead),
    giao_lai: open && s !== "cho_duyet" && s !== "tra_lai" && (isOwner || unitHead) && (q.has("cv.giao_cap1") || q.has("cv.giao_cap2")),
    cap_nhat: working && (isOwner || isDoer),
    bao_cao: working && (isOwner || isDoer),
    xin_gia_han: open && s !== "tra_lai" && s !== "tam_dung" && (isOwner || isDoer),
    duyet: admin || isAssigner || (q.has("cv.duyet") && inScope),
    xac_nhan: s === "cho_duyet" && (admin || isAssigner),
    quan_ly: admin || isAssigner || (q.has("cv.quan_ly") && inScope),
    viec_con: open && (isOwner || isDoer || isAssigner || unitHead),
    admin,
  };
}

/** Đơn vị mà người dùng được giao việc tới (null = toàn xã) */
export async function assignableUnits(user: User): Promise<number[] | null> {
  const ids = await identities(user);
  if (ids.some((i) => i.pham_vi.loai === "toan_xa" || i.pham_vi.loai === "linh_vuc")) return null;
  const { donVi, units } = await scopeSets(ids);
  const own = [...ids.flatMap((i) => subtree(units, i.id_don_vi)), ...subtree(units, user.id_don_vi_kiem_nhiem)];
  return [...new Set([...donVi, ...own])];
}
