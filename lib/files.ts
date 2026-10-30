import type { User } from "./auth";
import { db } from "./db";
import { taskPerms, type TaskRow, canManageKpi, identities } from "./perm";

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
    const r = (await sql`SELECT ct.id_phu_trach, ct.id_don_vi_phu_trach, sl.id_nguoi_nhap FROM chi_tieu_so_lieu sl JOIN chi_tieu ct ON ct.id = sl.id_chi_tieu WHERE sl.id = ${id}`)[0];
    if (!r) return false;
    if (!write) return true;
    const ids = (await identities(user)).map((i) => i.id);
    return canManageKpi(user) || ids.includes(r.id_phu_trach) || ids.includes(r.id_nguoi_nhap) || (user.vai_tro === "truong_don_vi" && user.id_don_vi === r.id_don_vi_phu_trach);
  }
  return false;
}
