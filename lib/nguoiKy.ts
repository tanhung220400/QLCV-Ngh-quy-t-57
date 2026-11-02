// Người ký báo cáo theo người lập báo cáo:
//  - Lãnh đạo (Giao việc cấp 1), người xem toàn phường: theo “Thông tin đơn vị và mẫu báo cáo Word” trong Cài đặt.
//  - Trưởng đơn vị (Giao việc cấp 2) hoặc cán bộ của một phòng, đơn vị: báo cáo của đơn vị đó,
//    người ký là người đứng đầu đơn vị; ký thay là cấp phó của đơn vị.
import type { User } from "./auth";
import type { CaiDat } from "./const";
import { db } from "./db";
import { getSettings } from "./settings";
import { bacChucVu, khongDau } from "./canBo";

/** Chữ viết tắt tên đơn vị cho ký hiệu văn bản, ví dụ Phòng Kinh tế, Hạ tầng và Đô thị → KTHTĐT */
function vietTat(ten: string): string {
  const bo = new Set(["phong", "ban", "trung", "tam", "phuong", "va", "cua", "xa"]);
  return ten
    .replace(/[,–-]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !bo.has(khongDau(w)))
    .map((w) => w[0].toUpperCase())
    .join("");
}

export async function caiDatKy(user: User): Promise<CaiDat & { ky_hieu_bc?: string; cua_don_vi?: string }> {
  const cfg = await getSettings();
  if (user.quyen.includes("cv.giao_cap1") || user.pham_vi.loai === "toan_xa" || !user.id_don_vi) return cfg;
  const sql = await db();
  const dv = (await sql`SELECT id, ten FROM don_vi WHERE id = ${user.id_don_vi}`)[0];
  if (!dv) return cfg;
  const ds = await sql`SELECT id, ho_ten, CASE WHEN id_don_vi = ${dv.id} THEN chuc_vu ELSE chuc_vu_kiem_nhiem END AS cv
                       FROM nguoi_dung WHERE trang_thai = 'hoat_dong' AND (id_don_vi = ${dv.id} OR id_don_vi_kiem_nhiem = ${dv.id}) AND ten_dang_nhap <> 'admin'`;
  const xep = [...ds].sort((a, b) => bacChucVu(a.cv) - bacChucVu(b.cv) || a.id - b.id);
  const truong = xep[0];
  if (!truong) return cfg;
  const pho = xep.find((x) => x.id !== truong.id && bacChucVu(x.cv) === 2);
  return {
    ...cfg,
    ten_cap_tren: cfg.ten_don_vi,
    ten_don_vi: dv.ten,
    tm_ky: " ",
    chuc_vu_ky: truong.cv || "Trưởng đơn vị",
    nguoi_ky: truong.ho_ten,
    chuc_vu_ky_thay: pho?.cv || "",
    nguoi_ky_thay: pho?.ho_ten || "",
    ky_hieu_bc: `BC-${vietTat(dv.ten) || "ĐV"}`,
    cua_don_vi: dv.ten,
  };
}
