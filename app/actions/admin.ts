"use server";
import { randomInt } from "crypto";
import { db } from "@/lib/db";
import { getUser, hashPassword } from "@/lib/auth";
import { writeLog } from "@/lib/log";
import { saveSettings } from "@/lib/settings";
import type { ActionState } from "@/components/ActionForm";
import { VAI_TRO } from "@/lib/const";
import { TAT_CA_QUYEN, QUYEN_MAC_DINH, LOAI_PHAM_VI } from "@/lib/quyen";
import { saveSmsConfig, getSmsConfig, sendSms, smsReady, chuanSdt, buildSmsText, SU_KIEN_SMS, type SmsConfig } from "@/lib/sms";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

async function need(q: string) {
  const u = await getUser();
  if (!u || !u.quyen.includes(q)) return null;
  return u;
}

function tempPassword() {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const b = "abcdefghijkmnpqrstuvwxyz";
  return `${a[randomInt(a.length)]}${b[randomInt(b.length)]}${b[randomInt(b.length)]}${randomInt(100000, 999999)}`;
}

export async function saveUnitAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await need("qt.co_cau");
  if (!u) return { error: "Không có quyền." };
  const sql = await db();
  const id = Number(str(fd, "id")) || null;
  const v = { ten: str(fd, "ten"), loai: str(fd, "loai") || "phong", id_cha: Number(str(fd, "id_cha")) || null, thu_tu: Number(str(fd, "thu_tu")) || 0, hoat_dong: str(fd, "hoat_dong") !== "0" };
  if (!v.ten) return { error: "Nhập tên đơn vị." };
  if (id && v.id_cha === id) return { error: "Đơn vị cha không hợp lệ." };
  if (id) {
    const cu = (await sql`SELECT * FROM don_vi WHERE id = ${id}`)[0];
    await sql`UPDATE don_vi SET ${sql(v)} WHERE id = ${id}`;
    await writeLog(sql, u.id, "sua_don_vi", "don_vi", id, cu, v);
  } else {
    const [r] = await sql`INSERT INTO don_vi ${sql(v)} RETURNING id`;
    await writeLog(sql, u.id, "tao_don_vi", "don_vi", r.id, null, v);
  }
  return { ok: true, message: "Đã lưu đơn vị.", reset: !id };
}

export async function saveUserAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await need("qt.nguoi_dung");
  if (!u) return { error: "Không có quyền." };
  const sql = await db();
  const id = Number(str(fd, "id")) || null;
  const v = {
    ho_ten: str(fd, "ho_ten"),
    ten_dang_nhap: str(fd, "ten_dang_nhap").toLowerCase(),
    sdt: str(fd, "sdt") || null,
    email: str(fd, "email") || null,
    id_don_vi: Number(str(fd, "id_don_vi")) || null,
    chuc_vu: str(fd, "chuc_vu") || null,
    vai_tro: VAI_TRO[str(fd, "vai_tro")] ? str(fd, "vai_tro") : "cong_chuc",
    linh_vuc_phu_trach: fd.getAll("linh_vuc_phu_trach").map(String).filter(Boolean),
    trang_thai: str(fd, "trang_thai") === "khoa" ? "khoa" : "hoat_dong",
  } as Record<string, unknown>;
  let logQuyen: unknown = undefined;
  // Phân quyền chi tiết: so sánh quyền được chọn với mặc định của vai trò
  if (fd.get("co_phan_quyen") === "1") {
    const chosen = new Set(fd.getAll("quyen").map(String).filter((q) => TAT_CA_QUYEN.includes(q)));
    const def = new Set(QUYEN_MAC_DINH[v.vai_tro as string] || []);
    const them = [...chosen].filter((q) => !def.has(q));
    const bo = [...def].filter((q) => !chosen.has(q));
    const loai = str(fd, "pham_vi");
    const pv =
      loai && loai !== "mac_dinh" && LOAI_PHAM_VI[loai as keyof typeof LOAI_PHAM_VI]
        ? { loai, linh_vuc: fd.getAll("pv_linh_vuc").map(String).filter(Boolean), don_vi: fd.getAll("pv_don_vi").map(Number).filter(Boolean) }
        : null;
    logQuyen = { them, bo, pham_vi: pv };
    v.quyen = them.length || bo.length ? sql.json({ them, bo }) : null;
    v.pham_vi = pv ? sql.json(pv) : null;
    if (id === u.id && !chosen.has("qt.nguoi_dung")) return { error: "Không tự bỏ quyền quản lý tài khoản của chính mình." };
  }
  if (!v.ho_ten || !v.ten_dang_nhap) return { error: "Nhập họ tên và tên đăng nhập." };
  if (!/^[a-z0-9._-]{3,40}$/.test(v.ten_dang_nhap)) return { error: "Tên đăng nhập chỉ gồm chữ không dấu, số, dấu chấm, gạch." };
  const dup = await sql`SELECT id FROM nguoi_dung WHERE ten_dang_nhap = ${v.ten_dang_nhap} AND id <> ${id ?? 0}`;
  if (dup.length) return { error: "Tên đăng nhập đã tồn tại." };
  if (id) {
    const cu = (await sql`SELECT ho_ten, ten_dang_nhap, id_don_vi, chuc_vu, vai_tro, linh_vuc_phu_trach, trang_thai FROM nguoi_dung WHERE id = ${id}`)[0];
    if (id === u.id && v.trang_thai !== "hoat_dong") return { error: "Không tự khóa tài khoản của chính mình." };
    await sql`UPDATE nguoi_dung SET ${sql(v as never)}, phien = CASE WHEN ${v.trang_thai} = 'khoa' THEN phien + 1 ELSE phien END WHERE id = ${id}`;
    await writeLog(sql, u.id, "sua_nguoi_dung", "nguoi_dung", id, cu, { ...v, quyen: undefined, pham_vi: undefined, phan_quyen: logQuyen });
    return { ok: true, message: "Đã lưu. Quyền mới có hiệu lực ngay (phân quyền theo chức vụ + đơn vị)." };
  }
  const pw = tempPassword();
  const [r] = await sql`INSERT INTO nguoi_dung ${sql({ ...v, mat_khau: await hashPassword(pw), doi_mat_khau: true } as never)} RETURNING id`;
  await writeLog(sql, u.id, "tao_nguoi_dung", "nguoi_dung", r.id, null, { ...v, quyen: undefined, pham_vi: undefined, phan_quyen: logQuyen });
  return { ok: true, message: `Đã tạo tài khoản ${v.ten_dang_nhap}. Mật khẩu tạm: ${pw} (người dùng phải đổi khi đăng nhập lần đầu).`, reset: true };
}

export async function resetPasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await need("qt.nguoi_dung");
  if (!u) return { error: "Không có quyền." };
  const sql = await db();
  const id = Number(str(fd, "id"));
  const pw = tempPassword();
  await sql`UPDATE nguoi_dung SET mat_khau = ${await hashPassword(pw)}, doi_mat_khau = TRUE, phien = phien + 1, otp_bat = FALSE, otp_bi_mat = NULL WHERE id = ${id}`;
  await writeLog(sql, u.id, "cap_lai_mat_khau", "nguoi_dung", id);
  return { ok: true, message: `Mật khẩu tạm mới: ${pw} (đã tắt OTP, người dùng cần cài lại).` };
}

export async function importUsersAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await need("qt.nguoi_dung");
  if (!u) return { error: "Không có quyền." };
  const f = fd.get("file");
  if (!(f instanceof File) || !f.size) return { error: "Chọn tệp Excel." };
  const ExcelJS = (await import("exceljs")).default;
  const { cellText } = await import("@/lib/excel");
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(Buffer.from(await f.arrayBuffer()) as never);
  } catch {
    return { error: "Không đọc được tệp .xlsx." };
  }
  const ws = wb.worksheets[0];
  const sql = await db();
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/\s+/g, " ").trim();
  const units = (await sql`SELECT id, ten FROM don_vi`) as unknown as { id: number; ten: string }[];
  const roleBy: Record<string, string> = {};
  for (const [k, v] of Object.entries(VAI_TRO)) roleBy[norm(v)] = k;
  const out: string[] = [];
  const errs: string[] = [];
  const rows: { n: number; v: Record<string, unknown> }[] = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const c = (i: number) => cellText(row.getCell(i).value);
    if (!c(1)) return;
    const username = c(2).toLowerCase();
    const unitName = c(3);
    let unit = units.find((x) => norm(x.ten) === norm(unitName));
    if (!unit && unitName) unit = { id: -1, ten: unitName };
    const role = roleBy[norm(c(5))] || (Object.keys(VAI_TRO).includes(c(5)) ? c(5) : "cong_chuc");
    if (!/^[a-z0-9._-]{3,40}$/.test(username)) errs.push(`Dòng ${n}: tên đăng nhập “${c(2)}” không hợp lệ.`);
    rows.push({ n, v: { ho_ten: c(1), ten_dang_nhap: username, don_vi: unit, chuc_vu: c(4) || null, vai_tro: role, sdt: c(6) || null, linh_vuc_phu_trach: c(7) ? c(7).split(/[;,]/).map((s) => s.trim()).filter(Boolean) : [] } });
  });
  if (errs.length) return { error: errs.slice(0, 15).join("\n") };
  await sql.begin(async (tx) => {
    for (const { v } of rows) {
      const ex = await tx`SELECT id FROM nguoi_dung WHERE ten_dang_nhap = ${v.ten_dang_nhap as string}`;
      if (ex.length) {
        out.push(`${v.ten_dang_nhap}: đã có, bỏ qua`);
        continue;
      }
      let dv = v.don_vi as { id: number; ten: string } | undefined;
      if (dv && dv.id === -1) {
        const [nu] = await tx`INSERT INTO don_vi (ten, loai) VALUES (${dv.ten}, ${/thon|to dan pho/.test(norm(dv.ten)) ? "thon" : "phong"}) RETURNING id`;
        dv = { id: nu.id, ten: dv.ten };
        units.push(dv);
      }
      const pw = tempPassword();
      await tx`INSERT INTO nguoi_dung (ho_ten, ten_dang_nhap, mat_khau, id_don_vi, chuc_vu, vai_tro, sdt, linh_vuc_phu_trach, doi_mat_khau)
        VALUES (${v.ho_ten as string}, ${v.ten_dang_nhap as string}, ${await hashPassword(pw)}, ${dv?.id ?? null}, ${v.chuc_vu as string}, ${v.vai_tro as string}, ${v.sdt as string}, ${v.linh_vuc_phu_trach as string[]}, TRUE)`;
      out.push(`${v.ho_ten}\t${v.ten_dang_nhap}\t${pw}`);
    }
    await writeLog(tx, u.id, "nhap_nguoi_dung_excel", "nguoi_dung", null, null, { so_dong: rows.length });
  });
  return { ok: true, message: `Kết quả (Họ tên — Tên đăng nhập — Mật khẩu tạm). Hãy lưu lại để phát cho cán bộ:\n${out.join("\n")}` };
}

export async function saveCatalogAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await need("qt.co_cau");
  if (!u) return { error: "Không có quyền." };
  const loai = str(fd, "loai");
  const items = str(fd, "ds").split("\n").map((s) => s.trim()).filter(Boolean);
  if (!items.length) return { error: "Danh mục không được trống." };
  const sql = await db();
  await sql.begin(async (tx) => {
    const cu = await tx`SELECT ten FROM danh_muc WHERE loai = ${loai} ORDER BY thu_tu`;
    await tx`DELETE FROM danh_muc WHERE loai = ${loai}`;
    for (const [i, ten] of items.entries()) await tx`INSERT INTO danh_muc (loai, ten, thu_tu) VALUES (${loai}, ${ten}, ${i}) ON CONFLICT DO NOTHING`;
    await writeLog(tx, u.id, "sua_danh_muc", "danh_muc", null, cu.map((r) => r.ten), items);
  });
  return { ok: true, message: "Đã lưu danh mục." };
}

export async function saveHolidaysAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await need("qt.co_cau");
  if (!u) return { error: "Không có quyền." };
  const lines = str(fd, "ds").split("\n").map((s) => s.trim()).filter(Boolean);
  const rows: [string, string][] = [];
  for (const l of lines) {
    const m = l.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s*[-–:]?\s*(.*)$/) || l.match(/^(\d{4})-(\d{2})-(\d{2})\s*[-–:]?\s*(.*)$/);
    if (!m) return { error: `Dòng không đúng định dạng: “${l}”. Dùng dd/mm/yyyy - Tên ngày nghỉ.` };
    const iso = m[1].length === 4 ? `${m[1]}-${m[2]}-${m[3]}` : `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    rows.push([iso, m[4] || "Ngày nghỉ"]);
  }
  const sql = await db();
  await sql.begin(async (tx) => {
    await tx`DELETE FROM ngay_nghi`;
    for (const [d, t] of rows) await tx`INSERT INTO ngay_nghi (ngay, ten) VALUES (${d}, ${t}) ON CONFLICT (ngay) DO UPDATE SET ten = EXCLUDED.ten`;
    await writeLog(tx, u.id, "sua_ngay_nghi", "ngay_nghi", null, null, { so_ngay: rows.length });
  });
  return { ok: true, message: `Đã lưu ${rows.length} ngày nghỉ.` };
}

export async function saveSettingsAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await need("qt.cai_dat");
  if (!u) return { error: "Không có quyền." };
  const nums = (k: string) => str(fd, k).split(/[,; ]+/).map(Number).filter((n) => n > 0);
  const v = {
    ten_don_vi: str(fd, "ten_don_vi"),
    ten_cap_tren: str(fd, "ten_cap_tren"),
    dia_danh: str(fd, "dia_danh"),
    chuc_vu_ky: str(fd, "chuc_vu_ky"),
    nguoi_ky: str(fd, "nguoi_ky"),
    noi_nhan: String(fd.get("noi_nhan") || ""),
    nguong_vang: Math.max(1, Number(str(fd, "nguong_vang")) || 3),
    nhac_truoc: nums("nhac_truoc").length ? nums("nhac_truoc") : [3, 1],
    bao_cap_tren_sau: Math.max(1, Number(str(fd, "bao_cap_tren_sau")) || 3),
    nhac_nhan_viec_gio: Math.max(1, Number(str(fd, "nhac_nhan_viec_gio")) || 24),
    nguong_nguy_co: Math.max(1, Number(str(fd, "nguong_nguy_co")) || 10),
    gio_tom_tat: /^\d{2}:\d{2}$/.test(str(fd, "gio_tom_tat")) ? str(fd, "gio_tom_tat") : "07:30",
    bat_buoc_otp: fd.get("bat_buoc_otp") === "1",
  };
  if (!v.ten_don_vi) return { error: "Nhập tên đơn vị." };
  await saveSettings(v);
  const sql = await db();
  await writeLog(sql, u.id, "sua_cai_dat", "cai_dat", null, null, v);
  return { ok: true, message: "Đã lưu cài đặt." };
}

export async function saveSmsAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await need("qt.cai_dat");
  if (!u) return { error: "Không có quyền." };
  const cur = await getSmsConfig(true);
  const keep = (k: keyof SmsConfig) => {
    const v = str(fd, k);
    return v === "" || /^•+$/.test(v) ? (cur[k] as string) : v; // để trống = giữ khóa cũ
  };
  const ncc = ["esms", "speedsms", "twilio", "webhook"].includes(str(fd, "nha_cung_cap")) ? (str(fd, "nha_cung_cap") as SmsConfig["nha_cung_cap"]) : "esms";
  const v: Partial<SmsConfig> = {
    bat: fd.get("bat") === "1",
    nha_cung_cap: ncc,
    api_key: keep("api_key"),
    secret_key: keep("secret_key"),
    twilio_sid: keep("twilio_sid"),
    twilio_token: keep("twilio_token"),
    webhook_token: keep("webhook_token"),
    brandname: str(fd, "brandname"),
    sms_type: str(fd, "sms_type") || "2",
    twilio_from: str(fd, "twilio_from"),
    webhook_url: str(fd, "webhook_url"),
    tien_to: str(fd, "tien_to") || "QLCV xa",
    su_kien: fd.getAll("su_kien").map(String).filter((k) => k in SU_KIEN_SMS),
    im_lang_tu: str(fd, "im_lang_tu"),
    im_lang_den: str(fd, "im_lang_den"),
  };
  if (v.webhook_url && !/^https:\/\//.test(v.webhook_url) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(v.webhook_url)) return { error: "Địa chỉ webhook phải bắt đầu bằng https://" };
  await saveSmsConfig(v);
  const sql = await db();
  await writeLog(sql, u.id, "sua_cai_dat_sms", "cai_dat", null, null, { bat: v.bat, nha_cung_cap: v.nha_cung_cap, su_kien: v.su_kien });
  const c = await getSmsConfig(true);
  return { ok: true, message: v.bat && !smsReady(c) ? "Đã lưu, nhưng còn thiếu khóa API nên chưa gửi được SMS." : "Đã lưu cài đặt SMS." };
}

export async function testSmsAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await need("qt.cai_dat");
  if (!u) return { error: "Không có quyền." };
  const sdt = chuanSdt(str(fd, "sdt"));
  if (!sdt) return { error: "Số điện thoại không hợp lệ." };
  const c = await getSmsConfig(true);
  if (!smsReady({ ...c, bat: true })) return { error: "Chưa nhập đủ khóa API của nhà cung cấp." };
  const r = await sendSms(c, sdt, buildSmsText(c, "Tin nhan thu nghiem tu phan mem giao viec", null, null));
  const sql = await db();
  await sql`INSERT INTO sms_hang_doi (id_nguoi_nhan, sdt, noi_dung, loai, trang_thai, so_lan, loi, gui_luc) VALUES (${u.id}, ${sdt}, 'Tin thử nghiệm', 'thu_nghiem', ${r.ok ? "da_gui" : "loi"}, 1, ${r.error ?? null}, now())`;
  return r.ok ? { ok: true, message: `Đã gửi tin thử tới ${sdt}.` } : { error: `Gửi không thành công: ${r.error}` };
}
