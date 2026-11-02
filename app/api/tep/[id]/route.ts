import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canAccessObject } from "@/lib/files";

/**
 * Loại tệp được xác định theo đuôi tên tệp (đã kiểm tra khi tải lên), không tin loại do trình duyệt người tải khai báo:
 * tránh trường hợp tệp “x.pdf” khai là trang web chứa mã độc rồi được mở ngay trong phần mềm.
 * Chỉ ảnh và PDF được xem trực tiếp; Word, Excel luôn tải về.
 */
const LOAI: Record<string, { mime: string; xem: boolean }> = {
  pdf: { mime: "application/pdf", xem: true },
  jpg: { mime: "image/jpeg", xem: true },
  jpeg: { mime: "image/jpeg", xem: true },
  png: { mime: "image/png", xem: true },
  webp: { mime: "image/webp", xem: true },
  heic: { mime: "image/heic", xem: false },
  doc: { mime: "application/msword", xem: false },
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xem: false },
  xls: { mime: "application/vnd.ms-excel", xem: false },
  xlsx: { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", xem: false },
};

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return NextResponse.redirect(new URL("/dang-nhap", _.url));
  const sql = await db();
  const f = (await sql`SELECT id, doi_tuong, id_doi_tuong, ten_tep, duong_dan, du_lieu FROM tep_dinh_kem WHERE id = ${Number(id) || 0}`)[0];
  if (!f) return new NextResponse("Không tìm thấy tệp", { status: 404 });
  if (!(await canAccessObject(user, f.doi_tuong, f.id_doi_tuong, false))) return new NextResponse("Không có quyền", { status: 403 });
  if (f.duong_dan) return NextResponse.redirect(f.duong_dan);
  const duoi = String(f.ten_tep).split(".").pop()?.toLowerCase() || "";
  const loai = LOAI[duoi] || { mime: "application/octet-stream", xem: false };
  return new NextResponse(f.du_lieu, {
    headers: {
      "content-type": loai.mime,
      "content-disposition": `${loai.xem ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(f.ten_tep)}`,
      "x-content-type-options": "nosniff",
      "cache-control": "private, max-age=3600",
    },
  });
}
