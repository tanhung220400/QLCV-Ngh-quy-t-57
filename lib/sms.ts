import type postgres from "postgres";
import { db } from "./db";
import { vnTime } from "./time";

/** Các sự kiện có thể gửi SMS, khóa = loại thông báo trong ứng dụng */
export const SU_KIEN_SMS: Record<string, string> = {
  giao_viec: "Được giao nhiệm vụ mới",
  giao_chi_tieu: "Được giao phụ trách chỉ tiêu",
  nhac_han: "Sắp đến hạn (trước 3 ngày và 1 ngày)",
  den_han: "Đến hạn hôm nay",
  qua_han_ct: "Quá hạn (gửi người chủ trì)",
  qua_han: "Quá hạn nhiều ngày (báo người giao, lãnh đạo lĩnh vực)",
  nhac: "Lãnh đạo bấm Nhắc việc",
  lam_lai: "Bị yêu cầu làm lại",
  chot_so_lieu: "Sắp đến hạn chốt số liệu chỉ tiêu",
};
export const SU_KIEN_MAC_DINH = ["giao_viec", "giao_chi_tieu", "nhac_han", "den_han", "qua_han_ct", "qua_han"];

export type SmsConfig = {
  bat: boolean;
  nha_cung_cap: "esms" | "speedsms" | "twilio" | "webhook";
  api_key: string;
  secret_key: string;
  brandname: string;
  sms_type: string;
  twilio_sid: string;
  twilio_token: string;
  twilio_from: string;
  webhook_url: string;
  webhook_token: string;
  tien_to: string;
  su_kien: string[];
  im_lang_tu: string; // không gửi SMS trong khung giờ này, để sáng hôm sau
  im_lang_den: string;
};

export const SMS_MAC_DINH: SmsConfig = {
  bat: false,
  nha_cung_cap: "esms",
  api_key: "",
  secret_key: "",
  brandname: "",
  sms_type: "2",
  twilio_sid: "",
  twilio_token: "",
  twilio_from: "",
  webhook_url: "",
  webhook_token: "",
  tien_to: "QLCV xa",
  su_kien: SU_KIEN_MAC_DINH,
  im_lang_tu: "21:00",
  im_lang_den: "06:30",
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function getSmsConfig(_fresh = false): Promise<SmsConfig> {
  const sql = await db();
  const r = await sql`SELECT gia_tri FROM cai_dat WHERE khoa = 'sms'`;
  return { ...SMS_MAC_DINH, ...((r[0]?.gia_tri as Partial<SmsConfig>) || {}) };
}

export async function saveSmsConfig(v: Partial<SmsConfig>) {
  const sql = await db();
  const cur = await getSmsConfig(true);
  const next = { ...cur, ...v };
  await sql`INSERT INTO cai_dat (khoa, gia_tri) VALUES ('sms', ${sql.json(next as never)}) ON CONFLICT (khoa) DO UPDATE SET gia_tri = EXCLUDED.gia_tri`;
}

export function smsReady(c: SmsConfig): boolean {
  if (!c.bat) return false;
  if (c.nha_cung_cap === "esms") return !!(c.api_key && c.secret_key);
  if (c.nha_cung_cap === "speedsms") return !!c.api_key;
  if (c.nha_cung_cap === "twilio") return !!(c.twilio_sid && c.twilio_token && c.twilio_from);
  return !!c.webhook_url;
}

/** Bỏ dấu tiếng Việt: tin không dấu rẻ hơn và không bị cắt nội dung */
export function khongDau(s: string): string {
  return s
    .replace(/[·•–—]/g, "-")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function chuanSdt(sdt: string | null | undefined): string | null {
  if (!sdt) return null;
  let d = sdt.replace(/\D/g, "");
  if (d.startsWith("84")) d = "0" + d.slice(2);
  if (!/^0\d{9,10}$/.test(d)) return null;
  return d;
}

export function appUrl(): string {
  const u = process.env.APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "");
  return u.replace(/\/$/, "");
}

export function buildSmsText(c: SmsConfig, tieuDe: string, noiDung: string | null, path: string | null): string {
  const link = path && appUrl() ? ` ${appUrl().replace(/^https?:\/\//, "")}${path}` : "";
  let body = khongDau(`${tieuDe}${noiDung ? `. ${noiDung}` : ""}`);
  const head = `[${khongDau(c.tien_to || "QLCV")}] `;
  const max = 300 - head.length - link.length; // tối đa 2 tin ghép
  if (body.length > max) body = body.slice(0, max - 3) + "...";
  return `${head}${body}${link}`;
}

type Q = postgres.Sql | postgres.TransactionSql;

/** Đưa SMS vào hàng đợi cho các người nhận (gọi trong cùng giao dịch với thông báo ứng dụng) */
export async function queueSms(sql: Q, recipients: number[], loai: string, tieuDe: string, noiDung: string | null, path: string | null, khoa: string | null) {
  if (!recipients.length) return;
  const c = await getSmsConfig();
  if (!c.bat || !c.su_kien.includes(loai)) return;
  const users = await sql`SELECT id, sdt FROM nguoi_dung WHERE id IN ${sql(recipients)} AND trang_thai = 'hoat_dong'`;
  const text = buildSmsText(c, tieuDe, noiDung, path);
  for (const u of users) {
    const sdt = chuanSdt(u.sdt);
    if (!sdt) continue;
    await sql`INSERT INTO sms_hang_doi (id_nguoi_nhan, sdt, noi_dung, loai, khoa)
      VALUES (${u.id}, ${sdt}, ${text}, ${loai}, ${khoa ? `${khoa}:${u.id}` : null}) ON CONFLICT (khoa) DO NOTHING`;
  }
}

function inQuietHours(c: SmsConfig, now = new Date()): boolean {
  const t = vnTime(now);
  const a = c.im_lang_tu;
  const b = c.im_lang_den;
  if (!/^\d{2}:\d{2}$/.test(a) || !/^\d{2}:\d{2}$/.test(b) || a === b) return false;
  return a < b ? t >= a && t < b : t >= a || t < b;
}

/** Gửi một tin qua nhà cung cấp đã cấu hình */
export async function sendSms(c: SmsConfig, sdt: string, text: string): Promise<{ ok: boolean; id?: string; error?: string }> {
  const ctrl = AbortSignal.timeout(15000);
  try {
    if (c.nha_cung_cap === "esms") {
      const r = await fetch("https://rest.esms.vn/MainService.svc/json/SendMultipleMessage_V4_post_json/", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ApiKey: c.api_key, SecretKey: c.secret_key, Phone: sdt, Content: text, Brandname: c.brandname, SmsType: c.sms_type || "2", IsUnicode: "0", RequestId: crypto.randomUUID() }),
        signal: ctrl,
      });
      const j = await r.json().catch(() => ({}));
      if (String(j.CodeResult) === "100") return { ok: true, id: j.SMSID };
      return { ok: false, error: `eSMS ${j.CodeResult ?? r.status}: ${j.ErrorMessage ?? ""}` };
    }
    if (c.nha_cung_cap === "speedsms") {
      const r = await fetch("https://api.speedsms.vn/index.php/sms/send", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Basic " + Buffer.from(`${c.api_key}:x`).toString("base64") },
        body: JSON.stringify({ to: ["84" + sdt.slice(1)], content: text, sms_type: Number(c.sms_type || 2), sender: c.brandname }),
        signal: ctrl,
      });
      const j = await r.json().catch(() => ({}));
      if (j.status === "success") return { ok: true, id: String(j.data?.tranId ?? "") };
      return { ok: false, error: `SpeedSMS ${j.code ?? r.status}: ${j.message ?? ""}` };
    }
    if (c.nha_cung_cap === "twilio") {
      const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(c.twilio_sid)}/Messages.json`, {
        method: "POST",
        headers: { authorization: "Basic " + Buffer.from(`${c.twilio_sid}:${c.twilio_token}`).toString("base64"), "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ To: "+84" + sdt.slice(1), From: c.twilio_from, Body: text }),
        signal: ctrl,
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) return { ok: true, id: j.sid };
      return { ok: false, error: `Twilio ${r.status}: ${j.message ?? ""}` };
    }
    // Webhook: chuyển cho cổng SMS / Zalo của tỉnh hoặc nhà mạng
    const r = await fetch(c.webhook_url, {
      method: "POST",
      headers: { "content-type": "application/json", ...(c.webhook_token ? { authorization: `Bearer ${c.webhook_token}` } : {}) },
      body: JSON.stringify({ phone: sdt, message: text }),
      signal: ctrl,
    });
    if (r.ok) return { ok: true };
    return { ok: false, error: `Webhook HTTP ${r.status}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Lỗi kết nối" };
  }
}

/** Gửi các tin đang chờ (tối đa 30 tin/lần, thử lại tối đa 3 lần) */
export async function flushSms(): Promise<{ sent: number; failed: number }> {
  const c = await getSmsConfig(true);
  if (!smsReady(c) || inQuietHours(c)) return { sent: 0, failed: 0 };
  const sql = await db();
  let sent = 0;
  let failed = 0;
  const rows = await sql`
    UPDATE sms_hang_doi SET so_lan = so_lan + 1, trang_thai = 'dang_gui'
    WHERE id IN (SELECT id FROM sms_hang_doi WHERE (trang_thai = 'cho' OR (trang_thai = 'loi' AND so_lan < 3))
                 AND tao_luc > now() - interval '2 days' ORDER BY id LIMIT 30 FOR UPDATE SKIP LOCKED)
    RETURNING id, sdt, noi_dung`;
  for (const r of rows) {
    const res = await sendSms(c, r.sdt, r.noi_dung);
    if (res.ok) {
      sent++;
      await sql`UPDATE sms_hang_doi SET trang_thai = 'da_gui', gui_luc = now(), ma_nha_mang = ${res.id ?? null}, loi = NULL WHERE id = ${r.id}`;
    } else {
      failed++;
      await sql`UPDATE sms_hang_doi SET trang_thai = 'loi', loi = ${res.error ?? "Lỗi"} WHERE id = ${r.id}`;
    }
  }
  return { sent, failed };
}
