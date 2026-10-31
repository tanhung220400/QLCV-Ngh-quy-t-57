import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { writeLog } from "@/lib/log";
import { LOAI_ANH, getTheme, saveTheme } from "@/lib/theme";

const MAX = 4 * 1024 * 1024;

/** Ảnh giao diện (nền menu, màn hình chào mừng): ai cũng xem được, kể cả trang đăng nhập */
export async function GET(_: Request, { params }: { params: Promise<{ loai: string }> }) {
  const { loai } = await params;
  if (!LOAI_ANH[loai]) return new NextResponse("Không có", { status: 404 });
  const sql = await db();
  const r = (await sql`SELECT gia_tri FROM cai_dat WHERE khoa = ${"anh:" + loai}`)[0];
  if (!r) return new NextResponse("Chưa có ảnh", { status: 404 });
  const { mime, b64 } = r.gia_tri as { mime: string; b64: string };
  return new NextResponse(Buffer.from(b64, "base64"), {
    headers: { "content-type": mime, "cache-control": "public, max-age=31536000, immutable" },
  });
}

/** Quản trị tải ảnh lên (đã được thu nhỏ ở trình duyệt) hoặc xóa ảnh (?xoa=1) */
export async function POST(req: Request, { params }: { params: Promise<{ loai: string }> }) {
  const { loai } = await params;
  if (!LOAI_ANH[loai]) return NextResponse.json({ error: "Loại ảnh không hợp lệ" }, { status: 400 });
  const u = await getUser();
  if (!u || !u.quyen.includes("qt.cai_dat")) return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  const sql = await db();
  const key = loai === "menu" ? "menu_v" : "chao_v";
  if (new URL(req.url).searchParams.get("xoa")) {
    await sql`DELETE FROM cai_dat WHERE khoa = ${"anh:" + loai}`;
    await saveTheme(sql, { [key]: 0 });
    await writeLog(sql, u.id, "xoa_anh_giao_dien", "he_thong", null, null, { loai });
    return NextResponse.json({ ok: true });
  }
  const fd = await req.formData();
  const f = fd.get("file");
  if (!(f instanceof File) || !f.size) return NextResponse.json({ error: "Chọn ảnh" }, { status: 400 });
  if (!/^image\/(jpeg|png|webp)$/.test(f.type)) return NextResponse.json({ error: "Chỉ nhận ảnh JPG, PNG, WEBP" }, { status: 400 });
  if (f.size > MAX) return NextResponse.json({ error: "Ảnh quá lớn (tối đa 4 MB)" }, { status: 400 });
  const b64 = Buffer.from(await f.arrayBuffer()).toString("base64");
  await sql`INSERT INTO cai_dat (khoa, gia_tri) VALUES (${"anh:" + loai}, ${sql.json({ mime: f.type, b64 } as never)}) ON CONFLICT (khoa) DO UPDATE SET gia_tri = EXCLUDED.gia_tri`;
  const v = Date.now();
  await saveTheme(sql, { [key]: v });
  await writeLog(sql, u.id, "doi_anh_giao_dien", "he_thong", null, null, { loai, kich_thuoc: f.size });
  return NextResponse.json({ ok: true, v });
}
