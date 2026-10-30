import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canAccessObject } from "@/lib/files";
import { writeLog } from "@/lib/log";

const ALLOWED = /\.(pdf|docx?|xlsx?|jpe?g|png|heic|webp)$/i;

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const sql = await db();
  const ct = req.headers.get("content-type") || "";
  let doi_tuong: string, id: number, ten: string, mime: string | null, size: number, gps: string | null, chup: string | null, minh: boolean;
  let url: string | null = null;
  let bytes: Buffer | null = null;
  if (ct.includes("application/json")) {
    const b = await req.json();
    doi_tuong = String(b.doi_tuong);
    id = Number(b.id_doi_tuong);
    ten = String(b.ten || "tep");
    mime = b.mime || null;
    size = Number(b.size) || 0;
    gps = b.gps || null;
    chup = b.thoi_gian_chup || null;
    minh = !!b.minh_chung;
    url = String(b.url || "");
    if (!/^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//.test(url)) return NextResponse.json({ error: "Địa chỉ tệp không hợp lệ" }, { status: 400 });
  } else {
    const fd = await req.formData();
    const f = fd.get("file");
    if (!(f instanceof File)) return NextResponse.json({ error: "Thiếu tệp" }, { status: 400 });
    if (f.size > 4 * 1024 * 1024) return NextResponse.json({ error: "Tệp vượt quá 4 MB (chưa bật kho lưu trữ tệp)" }, { status: 400 });
    doi_tuong = String(fd.get("doi_tuong"));
    id = Number(fd.get("id_doi_tuong"));
    ten = f.name;
    mime = f.type || null;
    size = f.size;
    gps = (fd.get("gps") as string) || null;
    chup = (fd.get("thoi_gian_chup") as string) || null;
    minh = fd.get("minh_chung") === "1";
    bytes = Buffer.from(await f.arrayBuffer());
  }
  if (!ALLOWED.test(ten)) return NextResponse.json({ error: "Chỉ nhận PDF, Word, Excel và ảnh" }, { status: 400 });
  if (size > 20 * 1024 * 1024) return NextResponse.json({ error: "Tệp vượt quá 20 MB" }, { status: 400 });
  if (!(await canAccessObject(user, doi_tuong, id, true))) return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  if (gps && !/^-?\d{1,3}\.\d+,-?\d{1,3}\.\d+$/.test(gps)) gps = null;
  const [r] = await sql`INSERT INTO tep_dinh_kem (doi_tuong, id_doi_tuong, ten_tep, duong_dan, du_lieu, loai_mime, kich_thuoc, gps, thoi_gian_chup, la_minh_chung, id_nguoi_tai)
    VALUES (${doi_tuong}, ${id}, ${ten.slice(0, 200)}, ${url}, ${bytes}, ${mime}, ${size}, ${gps}, ${chup ? new Date(chup) : null}, ${minh}, ${user.id}) RETURNING id`;
  await writeLog(sql, user.id, "tai_tep", doi_tuong, id, null, { id_tep: r.id, ten, gps });
  return NextResponse.json({ ok: true, id: r.id });
}
