import type postgres from "postgres";

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
  for (const r of uniq) {
    const k = khoa ? `${khoa}:${r}` : null;
    await sql`INSERT INTO thong_bao (id_nguoi_nhan, loai, tieu_de, noi_dung, doi_tuong, id_doi_tuong, khoa)
      VALUES (${r}, ${loai}, ${tieu_de}, ${noi_dung}, ${doi_tuong}, ${id_doi_tuong}, ${k})
      ON CONFLICT (khoa) DO NOTHING`;
  }
}
