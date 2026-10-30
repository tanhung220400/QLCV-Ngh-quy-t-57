import type { User } from "./auth";
import { identities, allUnits, subtree } from "./perm";

/** Quyền của người dùng trên một chỉ tiêu cụ thể (đã biết là được xem) */
export async function kpiRights(user: User, k: { id_phu_trach: number | null; id_don_vi_phu_trach: number | null; id_lanh_dao?: number | null }) {
  const ids = await identities(user);
  const pid = ids.map((i) => i.id);
  const units = await allUnits();
  const q = new Set(user.quyen);
  const manage = q.has("ct.quan_ly");
  const ofUnit = ids.some(
    (i) =>
      (i.pham_vi.loai === "toan_xa" ||
        (i.pham_vi.loai === "don_vi" && i.pham_vi.don_vi.some((d) => subtree(units, d).includes(k.id_don_vi_phu_trach ?? -1))) ||
        subtree(units, i.id_don_vi).includes(k.id_don_vi_phu_trach ?? -1)) &&
      k.id_don_vi_phu_trach != null,
  );
  const owner = pid.includes(k.id_phu_trach ?? -1);
  return {
    manage,
    enter: manage || (q.has("ct.nhap_so_lieu") && owner) || (q.has("ct.xac_nhan") && ofUnit),
    confirm: manage || (q.has("ct.xac_nhan") && (ofUnit || pid.includes(k.id_lanh_dao ?? -1))),
  };
}
