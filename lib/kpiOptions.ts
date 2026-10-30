import { db } from "./db";
import { getCatalog } from "./settings";

export async function kpiFormOptions() {
  const sql = await db();
  const units = (await sql`SELECT id, ten FROM don_vi WHERE hoat_dong AND loai <> 'lanh_dao' ORDER BY thu_tu, ten`) as unknown as { id: number; ten: string }[];
  const people = (await sql`SELECT n.id, n.ho_ten || COALESCE(' — ' || d.ten, '') AS ten FROM nguoi_dung n LEFT JOIN don_vi d ON d.id = n.id_don_vi
    WHERE n.trang_thai = 'hoat_dong' AND n.vai_tro <> 'quan_tri' ORDER BY d.thu_tu NULLS LAST, n.ho_ten`) as unknown as { id: number; ten: string }[];
  const leaders = (await sql`SELECT id, ho_ten || COALESCE(' — ' || chuc_vu, '') AS ten FROM nguoi_dung WHERE vai_tro = 'lanh_dao' AND trang_thai = 'hoat_dong' ORDER BY id`) as unknown as { id: number; ten: string }[];
  return {
    units,
    people,
    leaders,
    nhom: await getCatalog("nhom_chi_tieu"),
    nguon: await getCatalog("nguon_chi_tieu"),
    dvt: await getCatalog("don_vi_tinh"),
  };
}
