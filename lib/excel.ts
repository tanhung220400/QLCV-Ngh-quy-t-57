import ExcelJS from "exceljs";

export const KPI_COLUMNS = [
  { header: "STT", key: "stt", width: 6 },
  { header: "Tên chỉ tiêu", key: "ten", width: 50 },
  { header: "Nhóm", key: "nhom", width: 22 },
  { header: "Nguồn", key: "nguon", width: 22 },
  { header: "Đơn vị tính", key: "dvt", width: 12 },
  { header: "Loại (Cộng dồn / Tỷ lệ / Đạt-không đạt)", key: "loai", width: 20 },
  { header: "Chiều tốt (Cao / Thấp)", key: "chieu", width: 12 },
  { header: "Kế hoạch năm", key: "kh", width: 14 },
  { header: "Giá trị đầu năm", key: "dau", width: 14 },
  { header: "Đơn vị phụ trách", key: "dv", width: 30 },
  { header: "Lãnh đạo phụ trách", key: "ld", width: 24 },
  { header: "Kỳ cập nhật (Tháng / Quý / Tuần)", key: "ky", width: 14 },
  { header: "Ngày hết hạn (dd/mm/yyyy)", key: "han", width: 14 },
  { header: "Lĩnh vực (theo danh mục)", key: "lv", width: 26 },
];

export function styleHeader(ws: ExcelJS.Worksheet, row = 1) {
  const r = ws.getRow(row);
  r.font = { bold: true, color: { argb: "FFFFFFFF" } };
  r.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1D4ED8" } };
  r.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  r.height = 36;
}

export function borderAll(ws: ExcelJS.Worksheet, fromRow: number) {
  ws.eachRow((row, n) => {
    if (n < fromRow) return;
    row.eachCell({ includeEmpty: true }, (c) => {
      c.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
      c.alignment = { ...(c.alignment || {}), vertical: "top", wrapText: true };
    });
  });
}

export async function toResponse(wb: ExcelJS.Workbook, filename: string) {
  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf as ArrayBuffer, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}

export function cellText(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("result" in v) return String(v.result ?? "");
    if ("text" in v) return String(v.text);
  }
  return String(v).trim();
}
