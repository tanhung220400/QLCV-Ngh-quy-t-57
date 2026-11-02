// Phạm vi xem “theo phòng, đơn vị” cho lãnh đạo có phân công phụ trách (Phó Chủ tịch...):
// gợi ý các phòng, đơn vị phụ trách những lĩnh vực được phân công; chuyển phạm vi “theo lĩnh vực” cũ sang (chạy một lần khi nâng cấp).
import type postgres from "postgres";
import { linhVucTheoDonVi } from "./canBo";

type Q = postgres.Sql | postgres.TransactionSql;

/** Các phòng, đơn vị phụ trách những lĩnh vực đã cho (trừ các đơn vị trong danh sách bỏ qua) */
export async function donViTheoLinhVuc(tx: Q, linhVuc: string[], boQua: (number | null | undefined)[] = []): Promise<number[]> {
  if (!linhVuc.length) return [];
  const lv = (await tx`SELECT ten FROM danh_muc WHERE loai = 'linh_vuc'`).map((r) => r.ten as string);
  const dvs = await tx`SELECT id, ten FROM don_vi WHERE hoat_dong`;
  return dvs.filter((d) => !boQua.includes(d.id as number) && linhVucTheoDonVi(d.ten as string, lv).some((x) => linhVuc.includes(x))).map((d) => d.id as number);
}

export async function doiPhamViTheoDonVi(tx: Q) {
  const users = await tx`SELECT id, vai_tro, id_don_vi, id_don_vi_kiem_nhiem, linh_vuc_phu_trach, pham_vi FROM nguoi_dung
                         WHERE (vai_tro = 'lanh_dao' AND pham_vi IS NULL AND cardinality(linh_vuc_phu_trach) > 0) OR pham_vi->>'loai' = 'linh_vuc'`;
  for (const u of users) {
    const cua = (u.pham_vi?.loai === "linh_vuc" && u.pham_vi.linh_vuc?.length ? u.pham_vi.linh_vuc : u.linh_vuc_phu_trach) as string[];
    const chon = await donViTheoLinhVuc(tx, cua, [u.id_don_vi, u.id_don_vi_kiem_nhiem]);
    await tx`UPDATE nguoi_dung SET pham_vi = ${tx.json({ loai: "don_vi", linh_vuc: [], don_vi: chon })} WHERE id = ${u.id}`;
    await tx`INSERT INTO nhat_ky (id_nguoi_dung, hanh_dong, doi_tuong, id_doi_tuong, gia_tri_cu, gia_tri_moi)
             VALUES (NULL, 'doi_pham_vi_theo_don_vi', 'nguoi_dung', ${u.id}, ${tx.json({ pham_vi: u.pham_vi, linh_vuc: cua })}, ${tx.json({ loai: "don_vi", don_vi: chon })})`;
  }
}
