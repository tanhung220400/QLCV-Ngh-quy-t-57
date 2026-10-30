import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  PageOrientation,
} from "docx";
import type { CaiDat } from "./const";
import { vnDate } from "./time";

const FONT = "Times New Roman";
const t = (text: string, o: { bold?: boolean; italics?: boolean; size?: number } = {}) => new TextRun({ text, font: FONT, size: (o.size ?? 13) * 2, bold: o.bold, italics: o.italics });
export const p = (text: string | TextRun[], o: { bold?: boolean; italics?: boolean; align?: "center" | "left" | "right" | "both"; size?: number; before?: number; after?: number; indent?: boolean } = {}) =>
  new Paragraph({
    children: typeof text === "string" ? [t(text, o)] : text,
    alignment: o.align === "center" ? AlignmentType.CENTER : o.align === "right" ? AlignmentType.RIGHT : o.align === "left" ? AlignmentType.LEFT : AlignmentType.JUSTIFIED,
    spacing: { before: o.before ?? 0, after: o.after ?? 80, line: 300 },
    indent: o.indent ? { firstLine: 567 } : undefined,
  });

const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none };

/** Phần đầu văn bản hành chính: tên cơ quan, quốc hiệu, địa danh ngày tháng */
export function header(cfg: CaiDat, so = "") {
  const d = vnDate();
  const left = [cfg.ten_cap_tren, cfg.ten_don_vi].filter(Boolean).map((x) => x.toUpperCase());
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
                ...left.map((x, i) => p([t(x, { bold: i === left.length - 1, size: 13 })], { align: "center", after: 0 })),
                p("———", { align: "center", after: 0 }),
                p(`Số: ${so || "      "}/BC-UBND`, { align: "center", size: 13 }),
              ],
            }),
            new TableCell({
              width: { size: 60, type: WidthType.PERCENTAGE },
              borders: noBorders,
              children: [
                p([t("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", { bold: true, size: 13 })], { align: "center", after: 0 }),
                p([t("Độc lập - Tự do - Hạnh phúc", { bold: true, size: 14 })], { align: "center", after: 0 }),
                p("———————————", { align: "center", after: 0 }),
                p([t(`${cfg.dia_danh ? cfg.dia_danh + ", " : ""}ngày ${Number(d.slice(8))} tháng ${Number(d.slice(5, 7))} năm ${d.slice(0, 4)}`, { italics: true, size: 14 })], { align: "center" }),
              ],
            }),
          ],
        }),
      ],
    }),
  ];
}

export function signature(cfg: CaiDat) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: noBorders,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: noBorders,
            children: [p([t("Nơi nhận:", { bold: true, italics: true, size: 12 })], { align: "left", after: 0 }), ...cfg.noi_nhan.split("\n").map((l) => p([t(l, { size: 11 })], { align: "left", after: 0 }))],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: noBorders,
            children: [
              p([t(`TM. ${cfg.ten_don_vi.toUpperCase().replace(/^UBND/, "ỦY BAN NHÂN DÂN")}`, { bold: true, size: 13 })], { align: "center", after: 0 }),
              p([t(cfg.chuc_vu_ky.toUpperCase(), { bold: true, size: 13 })], { align: "center", after: 1200 }),
              p([t(cfg.nguoi_ky, { bold: true, size: 14 })], { align: "center" }),
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
  const cell = (v: string | number, bold: boolean, i: number) =>
    new TableCell({
      width: { size: w[i], type: WidthType.PERCENTAGE },
      borders: allBorders,
      children: [p([t(String(v), { bold, size: 12 })], { align: typeof v === "number" || i === 0 ? "center" : "left", after: 20 })],
    });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({ tableHeader: true, children: head.map((h, i) => cell(h, true, i)) }), ...rows.map((r) => new TableRow({ children: r.map((v, i) => cell(v, false, i)) }))],
  });
}

export async function docResponse(children: (Paragraph | Table)[], filename: string, landscape = false) {
  const doc = new Document({
    styles: { default: { document: { run: { font: FONT, size: 26 } } } },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1134, bottom: 1134, left: 1701, right: 1134 },
            size: landscape ? { orientation: PageOrientation.LANDSCAPE, width: 16838, height: 11906 } : undefined,
          },
        },
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
