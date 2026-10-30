import ExcelJS from "exceljs";
import { getUser } from "@/lib/auth";
import { KPI_COLUMNS, styleHeader, toResponse, borderAll } from "@/lib/excel";

export async function GET() {
  if (!(await getUser())) return new Response("Chưa đăng nhập", { status: 401 });
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Chi tieu");
  ws.columns = KPI_COLUMNS;
  styleHeader(ws);
  const y = new Date().getFullYear() + (new Date().getMonth() >= 10 ? 1 : 0);
  ws.addRows([
    { stt: 1, ten: "Tổng thu ngân sách nhà nước trên địa bàn", nhom: "Kinh tế", nguon: "Nghị quyết HĐND xã", dvt: "triệu đồng", loai: "Cộng dồn", chieu: "Cao", kh: 12000, dv: "Phòng Kinh tế", ld: "", ky: "Tháng", han: `31/12/${y}` },
    { stt: 2, ten: "Tỷ lệ người dân tham gia bảo hiểm y tế", nhom: "Văn hóa - xã hội", nguon: "Chỉ tiêu tỉnh giao", dvt: "%", loai: "Tỷ lệ", chieu: "Cao", kh: 95, dv: "Phòng Văn hóa - Xã hội", ky: "Tháng", han: `31/12/${y}` },
    { stt: 3, ten: "Tỷ lệ hộ nghèo", nhom: "Văn hóa - xã hội", nguon: "Nghị quyết HĐND xã", dvt: "%", loai: "Tỷ lệ", chieu: "Thấp", kh: 2.5, dau: 3.4, dv: "Phòng Văn hóa - Xã hội", ky: "Quý", han: `31/12/${y}` },
    { stt: 4, ten: "Xã đạt chuẩn văn hóa nông thôn mới", nhom: "Văn hóa - xã hội", nguon: "Nghị quyết HĐND xã", dvt: "tiêu chí", loai: "Đạt-không đạt", chieu: "Cao", kh: 1, dv: "Phòng Văn hóa - Xã hội", ky: "Quý", han: `30/11/${y}` },
  ]);
  borderAll(ws, 1);
  const note = wb.addWorksheet("Huong dan");
  note.getColumn(1).width = 110;
  [
    "HƯỚNG DẪN NHẬP CHỈ TIÊU",
    "Mỗi dòng ở trang 'Chi tieu' là một chỉ tiêu. Xóa các dòng ví dụ trước khi nhập.",
    "Loại: Cộng dồn (ví dụ thu ngân sách: cộng số các kỳ), Tỷ lệ (ví dụ % BHYT: lấy số kỳ gần nhất), Đạt-không đạt (đạt chuẩn: 1 là đạt).",
    "Chiều tốt: Cao = càng cao càng tốt; Thấp = càng thấp càng tốt (tỷ lệ hộ nghèo). Với chỉ tiêu Thấp nên điền Giá trị đầu năm.",
    "Đơn vị phụ trách: ghi đúng tên đơn vị trong phần mềm. Lãnh đạo phụ trách: ghi họ tên lãnh đạo (không bắt buộc).",
    "Năm của chỉ tiêu lấy theo Ngày hết hạn.",
  ].forEach((t, i) => (note.getCell(i + 1, 1).value = t));
  note.getRow(1).font = { bold: true, size: 14 };
  return toResponse(wb, "Mau_nhap_chi_tieu.xlsx");
}
