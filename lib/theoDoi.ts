// Ai được chọn làm “Người theo dõi” công việc: Phó Chủ tịch hoặc người đứng đầu đơn vị
// (theo cột “Chức vụ chính quyền” của danh sách cán bộ). Những người còn lại (cấp phó, cán bộ,
// chưa có chức vụ chính quyền) được chọn làm “Người phối hợp”.
import { bacChucVu, khongDau } from "./canBo";

export function coTheTheoDoi(chucVu: string | null | undefined): boolean {
  const s = khongDau(chucVu || "");
  if (!s) return false;
  return /^pho chu tich/.test(s) || bacChucVu(chucVu) === 1;
}
