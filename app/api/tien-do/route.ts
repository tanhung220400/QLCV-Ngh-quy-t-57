import { NextResponse } from "next/server";
import { taskAction } from "@/app/actions/task";

export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  if (!b?.id) return NextResponse.json({ error: "Thiếu dữ liệu" }, { status: 400 });
  const fd = new FormData();
  fd.set("id", String(b.id));
  fd.set("op", "cap_nhat");
  fd.set("phan_tram", String(b.phan_tram ?? 0));
  const offline = b.luc && Date.now() - new Date(b.luc).getTime() > 120000;
  fd.set("ghi_chu", `${b.ghi_chu || ""}${offline ? ` (cập nhật lúc mất mạng, ${new Date(b.luc).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })})` : ""}`.trim());
  const r = await taskAction(null, fd);
  if (r?.redirect) return NextResponse.json({ error: "Phiên đăng nhập đã hết, hãy đăng nhập lại" }, { status: 401 });
  if (r?.error) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
