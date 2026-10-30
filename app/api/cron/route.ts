import { NextResponse } from "next/server";
import { runScan } from "@/lib/scan";
import { flushSms } from "@/lib/sms";
import { hasDatabase } from "@/lib/db";

export const maxDuration = 60;

/** Tác vụ định kỳ: Vercel gọi lúc 7h30 hằng ngày; ngoài ra hệ thống tự quét mỗi 15 phút khi có người dùng truy cập */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!hasDatabase()) return NextResponse.json({ error: "no database" }, { status: 503 });
  const r = await runScan(true);
  const sms = await flushSms();
  return NextResponse.json({ ...r, sms });
}
