import type postgres from "postgres";
import { queueSms } from "./sms";

type Q = postgres.Sql | postgres.TransactionSql;

/** Ghi nhật ký thao tác (chỉ ghi thêm, không sửa, không xóa) */
export async function writeLog(
  sql: Q,
  uid: number | null,
  hanh_dong: string,
  doi_tuong: string,
  id_doi_tuong: number | null,
  cu?: unknown,
  moi?: unknown,
) {
  await sql`INSERT INTO nhat_ky (id_nguoi_dung, hanh_dong, doi_tuong, id_doi_tuong, gia_tri_cu, gia_tri_moi)
    VALUES (${uid}, ${hanh_dong}, ${doi_tuong}, ${id_doi_tuong},
            ${cu === undefined ? null : sql.json(cu as never)}, ${moi === undefined ? null : sql.json(moi as never)})`;
}

/** Thông báo trong ứng dụng; khoa để không gửi trùng một nhắc nhở */
export async function notify(
  sql: Q,
  recipients: (number | null | undefined)[],
  loai: string,
  tieu_de: string,
  noi_dung: string | null,
  doi_tuong: string | null,
  id_doi_tuong: number | null,
  khoa?: string,
  exclude?: number,
) {
  const uniq = [...new Set(recipients.filter((x): x is number => typeof x === "number" && x !== exclude))];
  if (!uniq.length) return;
  // một lệnh ghi cho tất cả người nhận (trước đây mỗi người một lệnh)
  const dong = uniq.map((r) => ({ id_nguoi_nhan: r, loai, tieu_de, noi_dung, doi_tuong, id_doi_tuong, khoa: khoa ? `${khoa}:${r}` : null }));
  const ins = await sql`INSERT INTO thong_bao ${sql(dong, "id_nguoi_nhan", "loai", "tieu_de", "noi_dung", "doi_tuong", "id_doi_tuong", "khoa")}
    ON CONFLICT (khoa) DO NOTHING RETURNING id_nguoi_nhan`;
  const fresh = ins.map((x) => x.id_nguoi_nhan as number);
  // Gửi kèm SMS cho các sự kiện quản trị đã bật (chỉ người chưa nhận thông báo này)
  if (fresh.length) {
    const path = doi_tuong === "cong_viec" && id_doi_tuong ? `/viec/${id_doi_tuong}` : doi_tuong === "chi_tieu" && id_doi_tuong ? `/chi-tieu/${id_doi_tuong}` : null;
    try {
      await queueSms(sql, fresh, loai, tieu_de, noi_dung, path, khoa ? `sms:${khoa}` : null);
    } catch (e) {
      console.error("queueSms", e);
    }
  }
}
