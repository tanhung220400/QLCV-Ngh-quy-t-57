import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canAccessObject } from "@/lib/files";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return NextResponse.redirect(new URL("/dang-nhap", _.url));
  const sql = await db();
  const f = (await sql`SELECT * FROM tep_dinh_kem WHERE id = ${Number(id)}`)[0];
  if (!f) return new NextResponse("Không tìm thấy tệp", { status: 404 });
  if (!(await canAccessObject(user, f.doi_tuong, f.id_doi_tuong, false))) return new NextResponse("Không có quyền", { status: 403 });
  if (f.duong_dan) return NextResponse.redirect(f.duong_dan);
  return new NextResponse(f.du_lieu, {
    headers: {
      "content-type": f.loai_mime || "application/octet-stream",
      "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(f.ten_tep)}`,
      "cache-control": "private, max-age=3600",
    },
  });
}
