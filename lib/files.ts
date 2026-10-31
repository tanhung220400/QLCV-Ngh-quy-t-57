import type { User } from "./auth";
import { db } from "./db";
import { taskPerms, type TaskRow, canSeeKpi, identities } from "./perm";
import { kpiRights } from "./kpiRights";

/** Kiểm tra quyền xem / tải tệp lên một đối tượng */
export async function canAccessObject(user: User, doiTuong: string, id: number, write: boolean): Promise<boolean> {
  const sql = await db();
  if (doiTuong === "cong_viec") {
    const t = (await sql`SELECT * FROM cong_viec WHERE id = ${id}`)[0];
    if (!t) return false;
    const p = await taskPerms(user, t as unknown as TaskRow);
    if (!p.xem) return false;
    if (!write) return true;
    return t.trang_thai !== "huy";
  }
  if (doiTuong === "so_lieu") {
    const r = (await sql`SELECT ct.id, ct.id_phu_trach, ct.id_don_vi_phu_trach, ct.id_lanh_dao, sl.id_nguoi_nhap FROM chi_tieu_so_lieu sl JOIN chi_tieu ct ON ct.id = sl.id_chi_tieu WHERE sl.id = ${id}`)[0];
    if (!r || !(await canSeeKpi(user, r.id))) return false;
    if (!write) return true;
    const ids = (await identities(user)).map((i) => i.id);
    return ids.includes(r.id_nguoi_nhap) || (await kpiRights(user, r as never)).enter;
  }
  if (doiTuong === "ban_ghi") {
    const { recordRights, recordScope } = await import("./records");
    const r = (await sql`SELECT bg.*, m.ma FROM mo_dun_ban_ghi bg JOIN mo_dun m ON m.id = bg.id_mo_dun WHERE bg.id = ${id}`)[0];
    if (!r) return false;
    const m = (await sql`SELECT * FROM mo_dun WHERE id = ${r.id_mo_dun}`)[0] as never;
    const sc = (await recordScope(sql, user, m)).q;
    if (!(await sql`SELECT 1 FROM mo_dun_ban_ghi bg WHERE bg.id = ${id} AND (${sc})`).length) return false;
    const rt = recordRights(user, m, r as never);
    return write ? rt.sua : rt.xem;
  }
  return false;
}
