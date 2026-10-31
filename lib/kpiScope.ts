import type { User } from "./auth";
import { allUnits, subtree } from "./perm";

/**
 * Phạm vi xem đánh giá KPI:
 *  - quyền bc.kpi: toàn phường (null)
 *  - quyền bc.kpi_don_vi: đơn vị của mình (kể cả đơn vị con) và các đơn vị được phân công theo dõi
 *  - không có quyền: false
 */
export async function kpiViewScope(user: User): Promise<number[] | null | false> {
  if (user.quyen.includes("bc.kpi")) return null;
  if (!user.quyen.includes("bc.kpi_don_vi")) return false;
  const units = await allUnits();
  const roots = [user.id_don_vi, ...(user.pham_vi.loai === "don_vi" ? user.pham_vi.don_vi : [])].filter((x): x is number => !!x);
  const ids = [...new Set(roots.flatMap((r) => subtree(units, r)))];
  return ids.length ? ids : false;
}
