// Thể thức văn bản hành chính theo Nghị định số 30/2020/NĐ-CP (Phụ lục I):
// khổ A4; lề trên, dưới 20 mm, lề trái 30 mm, lề phải 15 mm; phông Times New Roman;
// số trang ở giữa lề trên, không đánh số trang đầu.
import {
  AlignmentType,
  BorderStyle,
  Document,
  Header,
  Packer,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  PageOrientation,
  VerticalAlign,
} from "docx";
import type { CaiDat } from "./const";
import { vnDate } from "./time";

const FONT = "Times New Roman";
const BODY = 14; // cỡ chữ nội dung 13-14
const mm = (x: number) => Math.round(x * 56.7); // mm → twip

const t = (text: string, o: { bold?: boolean; italics?: boolean; size?: number } = {}) =>
  new TextRun({ text, font: FONT, size: (o.size ?? BODY) * 2, bold: o.bold, italics: o.italics });

type PO = { bold?: boolean; italics?: boolean; align?: "center" | "left" | "right" | "both"; size?: number; before?: number; after?: number; indent?: boolean; line?: number };
export const p = (text: string | TextRun[], o: PO = {}) =>
  new Paragraph({
    children: typeof text === "string" ? [t(text, o)] : text,
    alignment: o.align === "center" ? AlignmentType.CENTER : o.align === "right" ? AlignmentType.RIGHT : o.align === "left" ? AlignmentType.LEFT : AlignmentType.JUSTIFIED,
    // khoảng cách giữa các đoạn tối thiểu 6pt, dòng tối thiểu đơn
    spacing: { before: o.before ?? 0, after: o.after ?? 120, line: o.line ?? 276 },
    // lùi đầu dòng 1 cm
    indent: o.indent ? { firstLine: mm(10) } : undefined,
  });

/** Đường kẻ ngang nét liền, dài `dai` mm, đặt giữa ô rộng `o` mm */
function rule(o: number, dai: number) {
  const le = Math.max(0, Math.round(mm((o - dai) / 2)));
  return new Paragraph({
    children: [new TextRun({ text: "", size: 2 })],
    spacing: { before: 0, after: 0, line: 40 },
    indent: { left: le, right: le },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "000000", space: 1 } },
  });
}

const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none };

/** Ngày dưới 10 và tháng 1, 2 ghi thêm số 0 ở trước */
export function ngayThang(d = vnDate()) {
  const dd = d.slice(8, 10);
  const m = Number(d.slice(5, 7));
  return `ngày ${dd} tháng ${m <= 2 ? `0${m}` : m} năm ${d.slice(0, 4)}`;
}

// độ rộng vùng chữ: A4 dọc 210 − 30 − 15 = 165 mm; ngang 297 − 30 − 15 = 252 mm
const vung = (ngang = false) => (ngang ? 252 : 165);

/** Phần đầu văn bản: tên cơ quan, số ký hiệu (trái); Quốc hiệu, Tiêu ngữ, địa danh ngày tháng (phải) */
export function header(cfg: CaiDat, o: { so?: string; kyHieu?: string; ngang?: boolean } = {}) {
  const VUNG = vung(o.ngang);
  const so = o.so || "";
  const kyHieu = o.kyHieu || "BC-UBND";
  const trai = Math.round(VUNG * 0.4);
  const phai = VUNG - trai;
  const capTren = (cfg.ten_cap_tren || "").trim().toUpperCase();
  const coQuan = cfg.ten_don_vi.trim().toUpperCase().replace(/^UBND\b/, "ỦY BAN NHÂN DÂN");
  return [
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: noBorders,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 40, type: WidthType.PERCENTAGE },
              borders: noBorders,
              children: [
                ...(capTren ? [p([t(capTren, { size: 13 })], { align: "center", after: 0, line: 240 })] : []),
                p([t(coQuan, { bold: true, size: 13 })], { align: "center", after: 0, line: 240 }),
                rule(trai, Math.min(30, trai / 2)),
                p([t(`Số:  ${so || "      "}/${kyHieu}`, { size: 13 })], { align: "center", before: 120, after: 0 }),
              ],
            }),
            new TableCell({
              width: { size: 60, type: WidthType.PERCENTAGE },
              borders: noBorders,
              children: [
                p([t("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", { bold: true, size: 13 })], { align: "center", after: 0, line: 240 }),
                p([t("Độc lập - Tự do - Hạnh phúc", { bold: true, size: 14 })], { align: "center", after: 0, line: 240 }),
                rule(phai, 62),
                p([t(`${cfg.dia_danh ? cfg.dia_danh.trim() + ", " : ""}${ngayThang()}`, { italics: true, size: 14 })], { align: "center", before: 120, after: 0 }),
              ],
            }),
          ],
        }),
      ],
    }),
  ];
}

/** Tên loại và trích yếu nội dung: in hoa, đậm, căn giữa; dưới trích yếu có đường kẻ ngang */
export function tieuDe(tenLoai: string, trichYeu: string, ngang = false) {
  const VUNG = vung(ngang);
  return [
    p([t(tenLoai.toUpperCase(), { bold: true, size: 14 })], { align: "center", before: 360, after: 0 }),
    p([t(trichYeu, { bold: true, size: 14 })], { align: "center", after: 0 }),
    rule(VUNG, 35),
    p("", { after: 120 }),
  ];
}

/** Nơi nhận (trái) và chữ ký (phải). Ký thay: TM. ỦY BAN NHÂN DÂN / KT. CHỦ TỊCH / PHÓ CHỦ TỊCH */
export function signature(cfg: CaiDat, kyThay = false) {
  const tm = (cfg.tm_ky || "TM. ỦY BAN NHÂN DÂN").toUpperCase();
  const chucVu = (cfg.chuc_vu_ky || "CHỦ TỊCH").toUpperCase();
  const thay = kyThay && !!(cfg.chuc_vu_ky_thay || cfg.nguoi_ky_thay);
  const dong = thay ? [tm, `KT. ${chucVu}`, (cfg.chuc_vu_ky_thay || "PHÓ CHỦ TỊCH").toUpperCase()] : [tm, chucVu];
  const ten = thay ? cfg.nguoi_ky_thay : cfg.nguoi_ky;
  const noiNhan = (cfg.noi_nhan || "").split("\n").map((l) => l.trim()).filter(Boolean);
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: noBorders,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 45, type: WidthType.PERCENTAGE },
            borders: noBorders,
            children: [
              p([t("Nơi nhận:", { bold: true, italics: true, size: 12 })], { align: "left", after: 0, line: 240 }),
              ...noiNhan.map((l) => p([t(l, { size: 11 })], { align: "left", after: 0, line: 240 })),
            ],
          }),
          new TableCell({
            width: { size: 55, type: WidthType.PERCENTAGE },
            borders: noBorders,
            children: [
              ...dong.map((x, i) => p([t(x, { bold: true, size: 14 })], { align: "center", after: i === dong.length - 1 ? 1500 : 0, line: 240 })),
              p([t(ten || "", { bold: true, size: 14 })], { align: "center", after: 0 }),
            ],
          }),
        ],
      }),
    ],
  });
}

const thin = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
const allBorders = { top: thin, bottom: thin, left: thin, right: thin };

export function table(head: string[], rows: (string | number)[][], widths?: number[]) {
  const w = widths || head.map(() => Math.floor(100 / head.length));
  const cell = (v: string | number, bold: boolean, i: number, head = false) =>
    new TableCell({
      width: { size: w[i], type: WidthType.PERCENTAGE },
      borders: allBorders,
      verticalAlign: VerticalAlign.CENTER,
      margins: { top: 40, bottom: 40, left: 80, right: 80 },
      children: [p([t(String(v), { bold, size: 12 })], { align: head || typeof v === "number" || i === 0 ? "center" : "left", after: 0, line: 240 })],
    });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: head.map((h, i) => cell(h, true, i, true)) }),
      // dòng nhóm (cột STT trống, cột 2 in hoa) in đậm
      ...rows.map((r) => {
        const nhom = r[0] === "" && typeof r[1] === "string" && r[1] === r[1].toUpperCase() && r.slice(2).every((x) => x === "");
        return new TableRow({ children: r.map((v, i) => cell(v, nhom, i)) });
      }),
    ],
  });
}

/** Số trang: chữ số Ả Rập, cỡ 14, giữa lề trên, không hiện ở trang đầu */
function soTrang() {
  return new Header({
    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 28 })] })],
  });
}

export async function docResponse(children: (Paragraph | Table)[], filename: string, landscape = false) {
  const doc = new Document({
    styles: { default: { document: { run: { font: FONT, size: BODY * 2 } } } },
    sections: [
      {
        properties: {
          titlePage: true,
          page: {
            margin: { top: mm(20), bottom: mm(20), left: mm(30), right: mm(15), header: mm(10) },
            size: landscape ? { orientation: PageOrientation.LANDSCAPE, width: 16838, height: 11906 } : { width: 11906, height: 16838 },
          },
        },
        headers: { default: soTrang(), first: new Header({ children: [new Paragraph({ children: [] })] }) },
        children,
      },
    ],
  });
  const buf = await Packer.toBuffer(doc);
  return new Response(new Uint8Array(buf), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}

export { t as run };
