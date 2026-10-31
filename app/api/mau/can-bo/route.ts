import ExcelJS from "exceljs";
import { apiUser } from "@/lib/auth";
import { styleHeader, toResponse, borderAll } from "@/lib/excel";
import { VAI_TRO } from "@/lib/const";

export async function GET() {
  const u = await apiUser("qt.nguoi_dung");
  if (u instanceof Response) return u;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Can bo");
  ws.columns = [
    { header: "Họ và tên", key: "a", width: 26 },
    { header: "Chức vụ trong Đảng", key: "b", width: 22 },
    { header: "Chức vụ chính quyền", key: "c", width: 24 },
    { header: "Đơn vị chính", key: "d", width: 34 },
    { header: "Chức vụ kiêm nhiệm", key: "e", width: 20 },
    { header: "Đơn vị kiêm nhiệm", key: "f", width: 24 },
    { header: "Chức danh Ban chỉ đạo", key: "g", width: 22 },
    { header: "Chức danh Tổ giúp việc", key: "h", width: 22 },
    { header: "Số điện thoại", key: "i", width: 14 },
    { header: "Tên đăng nhập (để trống: tự tạo)", key: "j", width: 20 },
    { header: `Vai trò (để trống: theo chức vụ; ${Object.values(VAI_TRO).join(" / ")})`, key: "k", width: 30 },
    { header: "Lĩnh vực phụ trách (cách nhau dấu ;)", key: "l", width: 36 },
    { header: "Giao việc (Cấp 1 / Cấp 2; để trống: theo vai trò)", key: "m", width: 22 },
  ];
  styleHeader(ws);
  ws.addRow({ a: "Nguyễn Văn A", b: "Đảng ủy viên", c: "Trưởng phòng", d: "Phòng Kinh tế, Hạ tầng và Đô thị", h: "Tổ phó", i: "0912345678" });
  ws.addRow({ a: "Trần Thị B", c: "Chuyên viên", d: "Phòng Kinh tế, Hạ tầng và Đô thị", h: "Thành viên" });
  ws.addRow({ a: "Lê Văn C", b: "Ủy viên Ban Thường vụ Đảng ủy", c: "Phó Chủ tịch", d: "Ủy ban nhân dân phường", g: "Phó Trưởng ban", k: "Lãnh đạo phường", l: "Đất đai; Xây dựng, giao thông", m: "Cấp 1" });
  borderAll(ws, 1);
  return toResponse(wb, "Mau_danh_sach_can_bo.xlsx");
}
