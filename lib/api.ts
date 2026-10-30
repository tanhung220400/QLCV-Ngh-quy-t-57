import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

/** API liên thông: chỉ đọc, xác thực bằng khóa API_KEY (đặt trong biến môi trường) */
export function checkApiKey(req: Request): NextResponse | null {
  const key = process.env.API_KEY;
  if (!key) return NextResponse.json({ error: "API chưa được bật (thiếu API_KEY)" }, { status: 503 });
  const got = req.headers.get("x-api-key") || "";
  const a = Buffer.from(got);
  const b = Buffer.from(key);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ error: "Sai khóa API" }, { status: 401 });
  return null;
}
