import type postgres from "postgres";

type Q = postgres.Sql | postgres.TransactionSql;
type Tx = postgres.TransactionSql;

/**
 * Các cột tham chiếu tới cán bộ mà dữ liệu cần giữ lại (chuyển sang tài khoản khác khi xóa).
 * Thông báo, ủy quyền, mã đặt lại mật khẩu, hàng đợi SMS là dữ liệu riêng của tài khoản: xóa theo tài khoản.
 */
export const COT_DU_LIEU: { bang: string; cot: string; ten: string }[] = [
  { bang: "cong_viec", cot: "id_chu_tri", ten: "việc chủ trì" },
  { bang: "cong_viec", cot: "id_nguoi_thuc_hien", ten: "việc thực hiện" },
  { bang: "cong_viec", cot: "id_nguoi_giao", ten: "việc đã giao" },
  { bang: "cong_viec", cot: "id_nguoi_tao", ten: "việc đã tạo" },
  { bang: "cong_viec", cot: "id_nguoi_xac_nhan", ten: "việc đã xác nhận" },
  { bang: "cong_viec_thanh_vien", cot: "id_nguoi_dung", ten: "việc theo dõi, phối hợp" },
  { bang: "gia_han", cot: "id_nguoi_xin", ten: "lần xin gia hạn" },
  { bang: "gia_han", cot: "id_nguoi_duyet", ten: "lần duyệt gia hạn" },
  { bang: "binh_luan", cot: "id_nguoi_dung", ten: "trao đổi" },
  { bang: "tep_dinh_kem", cot: "id_nguoi_tai", ten: "tệp đã tải lên" },
  { bang: "chi_tieu", cot: "id_phu_trach", ten: "chỉ tiêu phụ trách" },
  { bang: "chi_tieu", cot: "id_lanh_dao", ten: "chỉ tiêu theo dõi" },
  { bang: "chi_tieu_so_lieu", cot: "id_nguoi_nhap", ten: "số liệu đã nhập" },
  { bang: "chi_tieu_so_lieu", cot: "id_nguoi_xac_nhan", ten: "số liệu đã xác nhận" },
  { bang: "mo_dun_ban_ghi", cot: "id_nguoi_tao", ten: "bản ghi đã tạo" },
  { bang: "mo_dun_ban_ghi", cot: "id_nguoi_sua", ten: "bản ghi đã sửa" },
];
const COT_NGUOI = new Set(COT_DU_LIEU.map((c) => c.cot).concat(["id_nguoi_uy_quyen", "id_nguoi_duoc", "id_nguoi_nhan"]));

export type DuLieuGan = { ten: string; so: number }[];

/** Dữ liệu đang gắn với tài khoản (để hiển thị và quyết định có cần chuyển sang tài khoản khác không) */
export async function demDuLieu(sql: Q, id: number): Promise<DuLieuGan> {
  const out: DuLieuGan = [];
  const dem = await Promise.all(COT_DU_LIEU.map((c) => sql`SELECT count(*)::int AS n FROM ${sql(c.bang)} WHERE ${sql(c.cot)} = ${id}`.then((r) => r[0].n as number)));
  COT_DU_LIEU.forEach((c, i) => dem[i] && out.push({ ten: c.ten, so: dem[i] }));
  const truong = await truongNguoi(sql);
  let bg = 0;
  for (const f of truong) bg += (await sql`SELECT count(*)::int AS n FROM mo_dun_ban_ghi WHERE id_mo_dun = ${f.id_mo_dun} AND du_lieu->>${f.khoa} = ${String(id)}`)[0].n as number;
  if (bg) out.push({ ten: "bản ghi module ghi tên cán bộ này", so: bg });
  const rac = (await mucRac(sql, id)).length;
  if (rac) out.push({ ten: "mục trong Thùng rác", so: rac });
  return out;
}

async function truongNguoi(sql: Q) {
  return (await sql`SELECT id_mo_dun, khoa FROM mo_dun_truong WHERE kieu = 'nguoi'`) as unknown as { id_mo_dun: number; khoa: string }[];
}

type Bang = { t: string; rows: Record<string, unknown>[] };
/** Các mục trong Thùng rác có ghi tài khoản này (để khi khôi phục không bị lỗi khóa ngoại) */
async function mucRac(sql: Q, id: number) {
  const rows = await sql`SELECT id, du_lieu FROM thung_rac WHERE trang_thai = 'trong_thung'`;
  return rows.filter((r) => ((r.du_lieu as Bang[]) || []).some((b) => b.rows.some((x) => Object.entries(x).some(([k, v]) => COT_NGUOI.has(k) && Number(v) === id))));
}

/**
 * Chuyển toàn bộ dữ liệu của tài khoản `tu` sang tài khoản `den` (gộp tài khoản trùng), kể cả các mục trong Thùng rác.
 * Dữ liệu riêng (thông báo, ủy quyền, mã đặt lại mật khẩu) của `tu` bị xóa.
 */
export async function chuyenDuLieu(tx: Tx, tu: number, den: number) {
  // thành viên việc: bỏ dòng trùng (người nhận đã là thành viên cùng vai trò) trước khi chuyển
  await tx`DELETE FROM cong_viec_thanh_vien a WHERE a.id_nguoi_dung = ${tu}
           AND EXISTS (SELECT 1 FROM cong_viec_thanh_vien b WHERE b.id_cong_viec = a.id_cong_viec AND b.vai_tro = a.vai_tro AND b.id_nguoi_dung = ${den})`;
  for (const c of COT_DU_LIEU) await tx`UPDATE ${tx(c.bang)} SET ${tx(c.cot)} = ${den} WHERE ${tx(c.cot)} = ${tu}`;
  for (const f of await truongNguoi(tx))
    await tx`UPDATE mo_dun_ban_ghi SET du_lieu = jsonb_set(du_lieu, ${"{" + f.khoa + "}"}::text[], to_jsonb(${den}::int))
             WHERE id_mo_dun = ${f.id_mo_dun} AND du_lieu->>${f.khoa} = ${String(tu)}`;
  for (const r of await mucRac(tx, tu)) {
    const bang = (r.du_lieu as Bang[]).map((b) => ({ ...b, rows: b.rows.map((x) => Object.fromEntries(Object.entries(x).map(([k, v]) => [k, COT_NGUOI.has(k) && Number(v) === tu ? den : v]))) }));
    await tx`UPDATE thung_rac SET du_lieu = ${tx.json(bang as never)} WHERE id = ${r.id}`;
  }
}

/** Xóa dữ liệu riêng của tài khoản (gọi sau khi đã chuyển hoặc khi không có dữ liệu) */
export async function xoaDuLieuRieng(tx: Tx, id: number) {
  await tx`DELETE FROM thong_bao WHERE id_nguoi_nhan = ${id}`;
  await tx`DELETE FROM uy_quyen WHERE id_nguoi_uy_quyen = ${id} OR id_nguoi_duoc = ${id}`;
  await tx`DELETE FROM dat_lai_mat_khau WHERE id_nguoi_dung = ${id}`;
  await tx`UPDATE sms_hang_doi SET id_nguoi_nhan = NULL WHERE id_nguoi_nhan = ${id}`;
}
