import type { User } from "./auth";
import type postgres from "postgres";
import { lyDoKhongGiao, type NguoiGiaoViec } from "./canBo";

type Q = postgres.Sql | postgres.TransactionSql;
const COT = "id, ho_ten, vai_tro, quyen, id_don_vi, chuc_vu, id_don_vi_kiem_nhiem, chuc_vu_kiem_nhiem, chuc_vu_dang, pham_vi";

async function nguoiGiao(sql: Q, user: User) {
  const r = (await sql`SELECT ${sql.unsafe(COT)} FROM nguoi_dung WHERE id = ${user.id}`)[0] as unknown as NguoiGiaoViec;
  return { ...r, pham_vi: user.pham_vi, quyenHieuLuc: new Set(user.quyen) };
}

/** Những người ở phía trên trong chuỗi giao việc của công việc (người giao, người tạo, người chủ trì của việc và các việc cha) */
export async function chuoiTren(sql: Q, idViec: number | null): Promise<number[]> {
  if (!idViec) return [];
  const rows = await sql`
    WITH RECURSIVE c AS (
      SELECT id, id_cha, id_nguoi_giao, id_nguoi_tao, id_chu_tri, id_nguoi_thuc_hien, 0 AS d FROM cong_viec WHERE id = ${idViec}
      UNION ALL
      SELECT p.id, p.id_cha, p.id_nguoi_giao, p.id_nguoi_tao, p.id_chu_tri, p.id_nguoi_thuc_hien, c.d + 1 FROM cong_viec p JOIN c ON p.id = c.id_cha WHERE c.d < 20
    ) SELECT * FROM c`;
  const s = new Set<number>();
  for (const r of rows) {
    s.add(r.id_nguoi_giao);
    s.add(r.id_nguoi_tao);
    s.add(r.id_chu_tri);
    if (r.d > 0 && r.id_nguoi_thuc_hien) s.add(r.id_nguoi_thuc_hien);
  }
  return [...s];
}

/** Lý do không được giao việc cho người nhận (null = được). idViecTren: việc cha / việc đang giao lại */
export async function kiemTraGiao(sql: Q, user: User, idNhan: number, idViecTren: number | null = null): Promise<string | null> {
  const giao = await nguoiGiao(sql, user);
  const nhan = (await sql`SELECT ${sql.unsafe(COT)} FROM nguoi_dung WHERE id = ${idNhan}`)[0] as unknown as NguoiGiaoViec | undefined;
  if (!nhan) return "Người nhận không hợp lệ.";
  const units = (await sql`SELECT id, id_cha FROM don_vi`) as unknown as { id: number; id_cha: number | null }[];
  const tren = (await chuoiTren(sql, idViecTren)).filter((x) => x !== user.id);
  return lyDoKhongGiao(giao, nhan, units, tren);
}

/** Tập id cán bộ mà người dùng được giao việc tới (để lọc danh sách chọn) */
export async function nguoiDuocGiao(sql: Q, user: User, idViecTren: number | null = null): Promise<Set<number>> {
  const giao = await nguoiGiao(sql, user);
  const all = (await sql`SELECT ${sql.unsafe(COT)} FROM nguoi_dung WHERE trang_thai = 'hoat_dong'`) as unknown as NguoiGiaoViec[];
  const units = (await sql`SELECT id, id_cha FROM don_vi`) as unknown as { id: number; id_cha: number | null }[];
  const tren = (await chuoiTren(sql, idViecTren)).filter((x) => x !== user.id);
  return new Set(all.filter((n) => !lyDoKhongGiao(giao, n, units, tren)).map((n) => n.id));
}

/**
 * Người đứng đầu đơn vị: ưu tiên cấp trưởng, rồi cấp phó, rồi cán bộ (theo chức vụ tại đơn vị đó);
 * cùng bậc thì ưu tiên người có đơn vị chính là đơn vị này, rồi vai trò trưởng đơn vị. Chỉ xét tài khoản đang hoạt động.
 */
export async function truongDonVi(sql: Q, dv: number | null | undefined): Promise<number | null> {
  if (!dv) return null;
  const r = await sql`SELECT id, vai_tro, id_don_vi = ${dv} AS chinh, CASE WHEN id_don_vi = ${dv} THEN chuc_vu ELSE chuc_vu_kiem_nhiem END AS cv
                      FROM nguoi_dung WHERE (id_don_vi = ${dv} OR id_don_vi_kiem_nhiem = ${dv}) AND trang_thai = 'hoat_dong' AND ten_dang_nhap <> 'admin'`;
  const { bacChucVu } = await import("./canBo");
  const role: Record<string, number> = { truong_don_vi: 0, truong_thon: 1, lanh_dao: 2 };
  r.sort((a, b) => bacChucVu(a.cv) - bacChucVu(b.cv) || Number(b.chinh) - Number(a.chinh) || (role[a.vai_tro] ?? 3) - (role[b.vai_tro] ?? 3) || a.id - b.id);
  return (r[0]?.id as number) ?? null;
}
