import type { User } from "./auth";
import { db } from "./db";
import { assignableUnits, kpiScope } from "./perm";
import { getCatalog } from "./settings";

/** Danh sách đơn vị, cán bộ, danh mục để điền vào biểu mẫu giao việc */
export async function taskFormOptions(user: User) {
  const sql = await db();
  const allowedUnits = await assignableUnits(user);
  const u = await sql`SELECT id, ten FROM don_vi WHERE hoat_dong AND loai <> 'lanh_dao' ORDER BY thu_tu, ten`;
  const p = await sql`SELECT n.id, n.ho_ten AS ten, n.chuc_vu, d.ten AS don_vi, n.id_don_vi FROM nguoi_dung n LEFT JOIN don_vi d ON d.id = n.id_don_vi
    WHERE n.trang_thai = 'hoat_dong' AND n.vai_tro <> 'quan_tri' ORDER BY d.thu_tu NULLS LAST, n.ho_ten`;
  const leaders = await sql`SELECT id, ho_ten AS ten, chuc_vu FROM nguoi_dung WHERE vai_tro = 'lanh_dao' AND trang_thai = 'hoat_dong' ORDER BY id`;
  const ks = (await kpiScope(sql, user)).q;
  const kpis = await sql`SELECT ct.id, ct.ten FROM chi_tieu ct WHERE NOT ct.huy AND ct.id_cha IS NULL AND ct.nam >= extract(year from now())::int - 1 AND (${ks}) ORDER BY ct.nam DESC, ct.thu_tu`;
  const filterU = (x: { id: number }) => !allowedUnits || allowedUnits.includes(x.id);
  const filterP = (x: { id_don_vi: number | null }) => !allowedUnits || (x.id_don_vi != null && allowedUnits.includes(x.id_don_vi));
  return {
    units: (u as unknown as { id: number; ten: string }[]).filter(filterU),
    people: (p as unknown as { id: number; ten: string; chuc_vu: string; don_vi: string; id_don_vi: number | null }[]).filter(filterP),
    allPeople: p as unknown as { id: number; ten: string; chuc_vu: string; don_vi: string; id_don_vi: number | null }[],
    leaders: leaders as unknown as { id: number; ten: string; chuc_vu: string }[],
    kpis: kpis as unknown as { id: number; ten: string }[],
    linhVuc: await getCatalog("linh_vuc"),
    nguon: await getCatalog("nguon_giao"),
    sanPham: await getCatalog("san_pham"),
  };
}
