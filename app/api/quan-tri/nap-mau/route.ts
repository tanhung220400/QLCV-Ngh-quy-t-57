import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import { seedDemoNQ57, removeDemoNQ57 } from "@/lib/seedNq57";

export const maxDuration = 60;

/** Nạp / xóa dữ liệu mẫu Nghị quyết 57 từ xa (cần khóa SETUP_KEY trong tiêu đề x-setup-key) */
export async function POST(req: Request) {
  const key = process.env.SETUP_KEY || "";
  const got = req.headers.get("x-setup-key") || "";
  if (!key || got.length !== key.length || !timingSafeEqual(Buffer.from(got), Buffer.from(key))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sql = await db();
  const admin = (await sql`SELECT id FROM nguoi_dung WHERE vai_tro = 'quan_tri' AND trang_thai = 'hoat_dong' ORDER BY id LIMIT 1`)[0];
  if (!admin) return NextResponse.json({ error: "Chưa có tài khoản quản trị" }, { status: 400 });
  const op = new URL(req.url).searchParams.get("op");
  if (op === "xoa") return NextResponse.json({ xoa: await sql.begin((tx) => removeDemoNQ57(tx, admin.id)) });
  if (op !== "them" && (await sql`SELECT 1 FROM cai_dat WHERE khoa = 'demo_nq57'`).length) return NextResponse.json({ da_co: true, ghi_chu: "Dữ liệu mẫu đã nạp; dùng ?op=them để nạp thêm" });
  return NextResponse.json(await sql.begin((tx) => seedDemoNQ57(tx, admin.id)));
}
