"use server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import {
  checkPassword,
  createSession,
  destroySession,
  getPendingOtp,
  getUser,
  hashPassword,
  setPendingOtp,
  verifyOtp,
  newOtpSecret,
} from "@/lib/auth";
import { writeLog } from "@/lib/log";
import type { ActionState } from "@/components/ActionForm";
import { seedAll } from "@/lib/seed";
import { getSettings } from "@/lib/settings";

// Chống dò mật khẩu: tối đa 8 lần sai / 15 phút / tài khoản
async function tooMany(username: string) {
  const sql = await db();
  const r = await sql`SELECT count(*)::int AS n FROM nhat_ky WHERE hanh_dong = 'dang_nhap_sai' AND gia_tri_moi->>'u' = ${username} AND thoi_gian > now() - interval '15 minutes'`;
  return r[0].n >= 8;
}

export async function loginAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const username = String(fd.get("ten_dang_nhap") || "").trim().toLowerCase();
  const password = String(fd.get("mat_khau") || "");
  if (!username || !password) return { error: "Nhập tên đăng nhập và mật khẩu." };
  const sql = await db();
  if (await tooMany(username)) return { error: "Sai mật khẩu quá nhiều lần. Vui lòng thử lại sau 15 phút." };
  const u = (await sql`SELECT id, mat_khau, trang_thai, otp_bat, phien, vai_tro FROM nguoi_dung WHERE ten_dang_nhap = ${username}`)[0];
  if (!u || !(await checkPassword(password, u.mat_khau))) {
    await writeLog(sql, u?.id ?? null, "dang_nhap_sai", "nguoi_dung", u?.id ?? null, null, { u: username, ip: (await headers()).get("x-forwarded-for") });
    return { error: "Tên đăng nhập hoặc mật khẩu không đúng." };
  }
  if (u.trang_thai !== "hoat_dong") return { error: "Tài khoản đã bị khóa. Liên hệ quản trị hệ thống." };
  const cfg = await getSettings();
  if (u.otp_bat) {
    await setPendingOtp(u.id);
    return { redirect: "/dang-nhap/otp" };
  }
  await createSession(u.id, u.phien);
  await writeLog(sql, u.id, "dang_nhap", "nguoi_dung", u.id);
  if (cfg.bat_buoc_otp) return { redirect: "/tai-khoan?bat_otp=1" };
  return { redirect: "/" };
}

export async function otpAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const uid = await getPendingOtp();
  if (!uid) return { redirect: "/dang-nhap" };
  const code = String(fd.get("ma") || "");
  const sql = await db();
  const u = (await sql`SELECT id, otp_bi_mat, phien, ten_dang_nhap FROM nguoi_dung WHERE id = ${uid}`)[0];
  if (await tooMany(u.ten_dang_nhap)) return { error: "Sai quá nhiều lần. Thử lại sau 15 phút." };
  if (!u?.otp_bi_mat || !verifyOtp(u.otp_bi_mat, code)) {
    await writeLog(sql, uid, "dang_nhap_sai", "nguoi_dung", uid, null, { u: u?.ten_dang_nhap, otp: true });
    return { error: "Mã xác thực không đúng hoặc đã hết hạn." };
  }
  await createSession(u.id, u.phien);
  await writeLog(sql, u.id, "dang_nhap", "nguoi_dung", u.id, null, { otp: true });
  return { redirect: "/" };
}

export async function logoutAction() {
  await destroySession();
  redirect("/dang-nhap");
}

export async function changePasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getUser();
  if (!user) return { redirect: "/dang-nhap" };
  const cur = String(fd.get("mat_khau_cu") || "");
  const p1 = String(fd.get("mat_khau_moi") || "");
  const p2 = String(fd.get("nhap_lai") || "");
  if (p1.length < 8) return { error: "Mật khẩu mới phải có ít nhất 8 ký tự." };
  if (p1 !== p2) return { error: "Hai lần nhập mật khẩu mới không khớp." };
  const sql = await db();
  const u = (await sql`SELECT mat_khau, phien FROM nguoi_dung WHERE id = ${user.id}`)[0];
  if (!(await checkPassword(cur, u.mat_khau))) return { error: "Mật khẩu hiện tại không đúng." };
  const phien = u.phien + 1;
  await sql`UPDATE nguoi_dung SET mat_khau = ${await hashPassword(p1)}, doi_mat_khau = FALSE, phien = ${phien} WHERE id = ${user.id}`;
  await writeLog(sql, user.id, "doi_mat_khau", "nguoi_dung", user.id);
  await createSession(user.id, phien);
  return { ok: true, message: "Đã đổi mật khẩu.", redirect: "/" };
}

export async function startOtpSetup(): Promise<string> {
  const user = await getUser();
  if (!user) redirect("/dang-nhap");
  const sql = await db();
  const s = newOtpSecret();
  await sql`UPDATE nguoi_dung SET otp_bi_mat = ${s} WHERE id = ${user.id} AND NOT otp_bat`;
  return s;
}

export async function enableOtpAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getUser();
  if (!user) return { redirect: "/dang-nhap" };
  const sql = await db();
  const u = (await sql`SELECT otp_bi_mat FROM nguoi_dung WHERE id = ${user.id}`)[0];
  if (!u.otp_bi_mat || !verifyOtp(u.otp_bi_mat, String(fd.get("ma") || ""))) return { error: "Mã không đúng. Kiểm tra lại giờ trên điện thoại và thử lại." };
  await sql`UPDATE nguoi_dung SET otp_bat = TRUE WHERE id = ${user.id}`;
  await writeLog(sql, user.id, "bat_otp", "nguoi_dung", user.id);
  return { ok: true, message: "Đã bật xác thực hai lớp." };
}

export async function disableOtpAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getUser();
  if (!user) return { redirect: "/dang-nhap" };
  const sql = await db();
  const u = (await sql`SELECT otp_bi_mat FROM nguoi_dung WHERE id = ${user.id}`)[0];
  if (!u.otp_bi_mat || !verifyOtp(u.otp_bi_mat, String(fd.get("ma") || ""))) return { error: "Mã không đúng." };
  const cfg = await getSettings();
  if (cfg.bat_buoc_otp) return { error: "Quản trị đã yêu cầu bắt buộc xác thực hai lớp." };
  await sql`UPDATE nguoi_dung SET otp_bat = FALSE, otp_bi_mat = NULL WHERE id = ${user.id}`;
  await writeLog(sql, user.id, "tat_otp", "nguoi_dung", user.id);
  return { ok: true, message: "Đã tắt xác thực hai lớp." };
}

export async function setupAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const sql = await db();
  const n = (await sql`SELECT count(*)::int AS n FROM nguoi_dung`)[0].n;
  if (n > 0) return { redirect: "/dang-nhap" };
  const key = String(fd.get("ma_khoi_tao") || "").trim();
  if (!process.env.SETUP_KEY || key !== process.env.SETUP_KEY) return { error: "Mã khởi tạo không đúng." };
  const ten_xa = String(fd.get("ten_xa") || "").trim();
  const ho_ten = String(fd.get("ho_ten") || "").trim();
  const username = String(fd.get("ten_dang_nhap") || "").trim().toLowerCase();
  const pw = String(fd.get("mat_khau") || "");
  if (!ten_xa || !ho_ten || !username) return { error: "Điền đủ tên xã, họ tên và tên đăng nhập." };
  if (!/^[a-z0-9._-]{3,40}$/.test(username)) return { error: "Tên đăng nhập chỉ gồm chữ không dấu, số, dấu chấm, gạch (3–40 ký tự)." };
  if (pw.length < 8) return { error: "Mật khẩu phải có ít nhất 8 ký tự." };
  await seedAll({ ten_xa, ho_ten, username, password: pw, demo: fd.get("du_lieu_mau") === "1" });
  const u = (await sql`SELECT id, phien FROM nguoi_dung WHERE ten_dang_nhap = ${username}`)[0];
  await createSession(u.id, u.phien);
  return { redirect: "/" };
}
