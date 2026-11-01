import type { User } from "./auth";
import { identities, allUnits, subtree, seesAll } from "./perm";

/**
 * Quyền của người dùng trên một chỉ tiêu cụ thể (đã biết là được xem).
 *  - enter: nhập số liệu (người phụ trách, cán bộ đơn vị có quyền nhập số liệu, người quản lý chỉ tiêu)
 *  - confirm: xác nhận số liệu — chỉ người có quyền “Giao việc cấp 1” (trong phạm vi chỉ tiêu)
 *    hoặc “Giao việc cấp 2” (chỉ tiêu của đơn vị mình), hoặc quản trị dữ liệu.
 *    Không ai tự xác nhận số liệu do chính mình nhập (kiểm tra ở từng dòng số liệu).
 */
export async function kpiRights(user: User, k: { id_phu_trach: number | null; id_don_vi_phu_trach: number | null; id_lanh_dao?: number | null }) {
  const ids = await identities(user);
  const pid = ids.map((i) => i.id);
  const units = await allUnits();
  const q = new Set(user.quyen);
  const manage = q.has("ct.quan_ly");
  const dv = k.id_don_vi_phu_trach ?? -1;
  const ofUnit = ids.some(
    (i) =>
      (i.pham_vi.loai === "toan_xa" ||
        (i.pham_vi.loai === "don_vi" && i.pham_vi.don_vi.some((d) => subtree(units, d).includes(dv))) ||
        subtree(units, i.id_don_vi).includes(dv)) &&
      k.id_don_vi_phu_trach != null,
  );
  // đơn vị của chính mình (đơn vị chính hoặc kiêm nhiệm, kể cả đơn vị trực thuộc)
  const donViMinh = k.id_don_vi_phu_trach != null && [user.id_don_vi, user.id_don_vi_kiem_nhiem].some((d) => d != null && subtree(units, d).includes(dv));
  const owner = pid.includes(k.id_phu_trach ?? -1);
  const lanhDao = pid.includes(k.id_lanh_dao ?? -1);
  const cap1 = q.has("cv.giao_cap1");
  const cap2 = q.has("cv.giao_cap2");
  const confirm = q.has("qt.du_lieu") || (cap1 && (ids.some(seesAll) || ofUnit || lanhDao || donViMinh || owner)) || (cap2 && donViMinh);
  return {
    manage,
    enter: manage || (q.has("ct.nhap_so_lieu") && (owner || ofUnit)) || (q.has("ct.xac_nhan") && ofUnit),
    confirm,
  };
}
