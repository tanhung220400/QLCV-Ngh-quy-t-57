import ExcelJS from "exceljs";
import { getUser } from "@/lib/auth";
import { styleHeader, toResponse, borderAll } from "@/lib/excel";
import { VAI_TRO } from "@/lib/const";

export async function GET() {
  const u = await getUser();
  if (!u || u.vai_tro !== "quan_tri") return new Response("Không có quyền", { status: 403 });
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Can bo");
  ws.columns = [
    { header: "Họ tên", key: "a", width: 26 },
    { header: "Tên đăng nhập (không dấu)", key: "b", width: 20 },
    { header: "Đơn vị", key: "c", width: 30 },
    { header: "Chức vụ", key: "d", width: 26 },
    { header: `Vai trò (${Object.values(VAI_TRO).join(" / ")})`, key: "e", width: 30 },
    { header: "Số điện thoại", key: "f", width: 14 },
    { header: "Lĩnh vực phụ trách (lãnh đạo, cách nhau dấu ;)", key: "g", width: 40 },
  ];
  styleHeader(ws);
  ws.addRow({ a: "Nguyễn Văn A", b: "nva", c: "Phòng Kinh tế", d: "Chuyên viên", e: "Công chức, viên chức", f: "0912345678" });
  ws.addRow({ a: "Trần Thị B", b: "ttb", c: "Lãnh đạo xã", d: "Phó Chủ tịch UBND", e: "Lãnh đạo xã", g: "Đất đai; Xây dựng, giao thông" });
  borderAll(ws, 1);
  return toResponse(wb, "Mau_danh_sach_can_bo.xlsx");
}
