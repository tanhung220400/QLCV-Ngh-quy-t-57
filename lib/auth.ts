import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import * as OTPAuth from "otpauth";
import { db } from "./db";
import { vnDate } from "./time";
import { tinhQuyen, tinhPhamVi, type PhamVi } from "./quyen";

const COOKIE = "qlcv_s";
const PENDING = "qlcv_otp";

function secret() {
  const s = process.env.AUTH_SECRET || process.env.SETUP_KEY;
  if (!s) throw new Error("Thiếu biến môi trường AUTH_SECRET");
  return new TextEncoder().encode(s);
}

export type User = {
  id: number;
  ho_ten: string;
  ten_dang_nhap: string;
  sdt: string | null;
  email: string | null;
  id_don_vi: number | null;
  ten_don_vi: string | null;
  chuc_vu: string | null;
  vai_tro: string;
  linh_vuc_phu_trach: string[];
  otp_bat: boolean;
  doi_mat_khau: boolean;
  /** id những người đang ủy quyền cho người này (hôm nay) */
  uy_quyen_tu: number[];
  /** Quyền chức năng hiệu lực (gồm cả quyền của người ủy quyền) */
  quyen: string[];
  pham_vi: PhamVi;
};

/** Kiểm tra người dùng có quyền chức năng */
export const co = (u: Pick<User, "quyen">, q: string) => u.quyen.includes(q);

export async function hashPassword(p: string) {
  return bcrypt.hash(p, 10);
}
export async function checkPassword(p: string, h: string) {
  return bcrypt.compare(p, h);
}

async function sign(payload: Record<string, unknown>, exp: string) {
  return new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(exp).sign(secret());
}

export async function createSession(uid: number, phien: number) {
  const token = await sign({ uid, v: phien }, "30d");
  const c = await cookies();
  c.set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 30 * 86400 });
  c.delete(PENDING);
}

export async function setPendingOtp(uid: number) {
  const token = await sign({ uid, otp: 1 }, "10m");
  const c = await cookies();
  c.set(PENDING, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 600 });
}

export async function getPendingOtp(): Promise<number | null> {
  const c = await cookies();
  const t = c.get(PENDING)?.value;
  if (!t) return null;
  try {
    const { payload } = await jwtVerify(t, secret());
    return payload.otp ? Number(payload.uid) : null;
  } catch {
    return null;
  }
}

export async function destroySession() {
  const c = await cookies();
  c.delete(COOKIE);
  c.delete(PENDING);
}

export async function getUser(): Promise<User | null> {
  const c = await cookies();
  const t = c.get(COOKIE)?.value;
  if (!t) return null;
  let uid: number, v: number;
  try {
    const { payload } = await jwtVerify(t, secret());
    uid = Number(payload.uid);
    v = Number(payload.v);
  } catch {
    return null;
  }
  const sql = await db();
  const rows = await sql`
    SELECT u.id, u.ho_ten, u.ten_dang_nhap, u.sdt, u.email, u.id_don_vi, d.ten AS ten_don_vi, u.chuc_vu, u.vai_tro,
           u.linh_vuc_phu_trach, u.otp_bat, u.doi_mat_khau, u.phien, u.trang_thai, u.quyen, u.pham_vi
    FROM nguoi_dung u LEFT JOIN don_vi d ON d.id = u.id_don_vi
    WHERE u.id = ${uid}`;
  const u = rows[0];
  if (!u || u.trang_thai !== "hoat_dong" || u.phien !== v) return null;
  const today = vnDate();
  const uq = await sql`
    SELECT id_nguoi_uy_quyen FROM uy_quyen
    WHERE id_nguoi_duoc = ${uid} AND NOT huy AND tu_ngay <= ${today} AND den_ngay >= ${today}`;
  const quyen = tinhQuyen(u.vai_tro, u.quyen);
  if (uq.length) {
    const others = await sql`SELECT vai_tro, quyen FROM nguoi_dung WHERE id IN ${sql(uq.map((r) => r.id_nguoi_uy_quyen as number))}`;
    for (const o of others) for (const q of tinhQuyen(o.vai_tro, o.quyen)) if (!q.startsWith("qt.")) quyen.add(q);
  }
  return {
    id: u.id,
    ho_ten: u.ho_ten,
    ten_dang_nhap: u.ten_dang_nhap,
    sdt: u.sdt,
    email: u.email,
    id_don_vi: u.id_don_vi,
    ten_don_vi: u.ten_don_vi,
    chuc_vu: u.chuc_vu,
    vai_tro: u.vai_tro,
    linh_vuc_phu_trach: u.linh_vuc_phu_trach || [],
    otp_bat: u.otp_bat,
    doi_mat_khau: u.doi_mat_khau,
    uy_quyen_tu: uq.map((r) => r.id_nguoi_uy_quyen as number),
    quyen: [...quyen],
    pham_vi: tinhPhamVi(u.vai_tro, u.id_don_vi, u.linh_vuc_phu_trach || [], u.pham_vi),
  };
}

export async function requireUser(): Promise<User> {
  const u = await getUser();
  if (!u) redirect("/dang-nhap");
  return u;
}

export async function requireRole(...roles: string[]): Promise<User> {
  const u = await requireUser();
  if (!roles.includes(u.vai_tro)) redirect("/");
  return u;
}

/** Yêu cầu có ít nhất một trong các quyền, nếu không về trang chủ */
export async function requirePerm(...qs: string[]): Promise<User> {
  const u = await requireUser();
  if (!qs.some((q) => u.quyen.includes(q))) redirect("/?khong_quyen=1");
  return u;
}

// ---- OTP (xác thực hai lớp bằng ứng dụng tạo mã: Google Authenticator, Microsoft Authenticator...) ----
export function newOtpSecret() {
  return new OTPAuth.Secret({ size: 20 }).base32;
}

export function otpUri(secretB32: string, label: string) {
  const totp = new OTPAuth.TOTP({ issuer: "QLCV xã", label, secret: OTPAuth.Secret.fromBase32(secretB32), digits: 6, period: 30 });
  return totp.toString();
}

export function verifyOtp(secretB32: string, code: string) {
  const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secretB32), digits: 6, period: 30 });
  return totp.validate({ token: code.replace(/\s/g, ""), window: 1 }) !== null;
}

/** Dùng trong route API: trả về người dùng hoặc Response lỗi */
export async function apiUser(...qs: string[]): Promise<User | Response> {
  const u = await getUser();
  if (!u) return new Response("Chưa đăng nhập", { status: 401 });
  if (qs.length && !qs.some((q) => u.quyen.includes(q))) return new Response("Tài khoản chưa được phân quyền chức năng này", { status: 403 });
  return u;
}
