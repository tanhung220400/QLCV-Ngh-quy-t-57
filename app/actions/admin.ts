"use server";
import { randomInt } from "crypto";
import { db } from "@/lib/db";
import { getUser, hashPassword } from "@/lib/auth";
import { writeLog } from "@/lib/log";
import { saveSettings } from "@/lib/settings";
import type { ActionState } from "@/components/ActionForm";
import { VAI_TRO, LOAI_DON_VI } from "@/lib/const";
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
  if (!LOAI_DON_VI[v.loai]) v.loai = "phong";
  if (id && v.id_cha) {
    const sub = await sql`WITH RECURSIVE t AS (SELECT id FROM don_vi WHERE id = ${id} UNION SELECT d.id FROM don_vi d JOIN t ON d.id_cha = t.id) SELECT id FROM t`;
    if (sub.some((r) => r.id === v.id_cha)) return { error: "Không đặt đơn vị trực thuộc chính đơn vị con của nó." };
  }
  if (id) {
    const cu = (await sql`SELECT * FROM don_vi WHERE id = ${id}`)[0];
    await sql`UPDATE don_vi SET ${sql(v)} WHERE id = ${id}`;
    await writeLog(sql, u.id, "sua_don_vi", "don_vi", id, cu, v);
  } else {
    const [r] = await sql`INSERT INTO don_vi ${sql(v)} RETURNING id`;
    await writeLog(sql, u.id, "tao_don_vi", "don_vi", r.id, null, v);
  }
  if (!id) {
    if (str(fd, "tiep") === "1") return { ok: true, message: `Đã thêm “${v.ten}”.`, reset: true };
    return { redirect: "/quan-tri?muc=don_vi&luu=1" };
  }
  return { ok: true, message: "Đã lưu đơn vị." };
}

/** Xóa đơn vị. Nếu còn cán bộ, đơn vị con, công việc, chỉ tiêu, dữ liệu: phải chọn đơn vị nhận để chuyển sang trước khi xóa. */
export async function deleteUnitAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await need("qt.co_cau");
  if (!u) return { error: "Không có quyền." };
  const sql = await db();
  const id = Number(str(fd, "id"));
  const den = Number(str(fd, "chuyen_sang")) || null;
  const dv = (await sql`SELECT * FROM don_vi WHERE id = ${id}`)[0];
  if (!dv) return { error: "Không tìm thấy đơn vị." };
  const c = (await sql`SELECT
      (SELECT count(*)::int FROM nguoi_dung WHERE id_don_vi = ${id} OR id_don_vi_kiem_nhiem = ${id}) AS nguoi,
      (SELECT count(*)::int FROM don_vi WHERE id_cha = ${id}) AS con,
      (SELECT count(*)::int FROM cong_viec WHERE id_don_vi_chu_tri = ${id}) AS viec,
      (SELECT count(*)::int FROM chi_tieu WHERE id_don_vi_phu_trach = ${id}) AS chi_tieu,
      (SELECT count(*)::int FROM mo_dun_ban_ghi WHERE id_don_vi = ${id}) AS ban_ghi`)[0] as { nguoi: number; con: number; viec: number; chi_tieu: number; ban_ghi: number };
  const parts = [c.nguoi && `${c.nguoi} cán bộ`, c.con && `${c.con} đơn vị trực thuộc`, c.viec && `${c.viec} công việc`, c.chi_tieu && `${c.chi_tieu} chỉ tiêu`, c.ban_ghi && `${c.ban_ghi} bản ghi dữ liệu`].filter(Boolean);
  if (parts.length && !den)
    return { error: `“${dv.ten}” đang có ${parts.join(", ")}. Bấm Sửa → chọn “Chuyển sang đơn vị” rồi xóa, hoặc đặt “Ngừng hoạt động” để giữ lịch sử.` };
  if (den) {
    if (den === id) return { error: "Đơn vị nhận phải khác đơn vị bị xóa." };
    const sub = await sql`WITH RECURSIVE t AS (SELECT id FROM don_vi WHERE id = ${id} UNION SELECT d.id FROM don_vi d JOIN t ON d.id_cha = t.id) SELECT id FROM t`;
    if (sub.some((r) => r.id === den)) return { error: "Không chuyển sang đơn vị trực thuộc của chính đơn vị bị xóa." };
    if (!(await sql`SELECT 1 FROM don_vi WHERE id = ${den}`).length) return { error: "Đơn vị nhận không hợp lệ." };
  }
  const ten_den = den ? (await sql`SELECT ten FROM don_vi WHERE id = ${den}`)[0].ten : null;
  await sql.begin(async (tx) => {
    if (den) {
      await tx`UPDATE nguoi_dung SET id_don_vi = ${den} WHERE id_don_vi = ${id}`;
      await tx`UPDATE nguoi_dung SET id_don_vi_kiem_nhiem = CASE WHEN id_don_vi = ${den} THEN NULL ELSE ${den}::int END WHERE id_don_vi_kiem_nhiem = ${id}`;
      await tx`UPDATE don_vi SET id_cha = ${den} WHERE id_cha = ${id}`;
      await tx`UPDATE cong_viec SET id_don_vi_chu_tri = ${den} WHERE id_don_vi_chu_tri = ${id}`;
      await tx`UPDATE chi_tieu SET id_don_vi_phu_trach = ${den} WHERE id_don_vi_phu_trach = ${id}`;
      await tx`UPDATE mo_dun_ban_ghi SET id_don_vi = ${den} WHERE id_don_vi = ${id}`;
      const fs = await tx`SELECT id_mo_dun, khoa FROM mo_dun_truong WHERE kieu = 'don_vi'`;
      for (const f of fs) await tx`UPDATE mo_dun_ban_ghi SET du_lieu = jsonb_set(du_lieu, ${"{" + f.khoa + "}"}::text[], to_jsonb(${den}::int)) WHERE id_mo_dun = ${f.id_mo_dun} AND du_lieu->>${f.khoa} = ${String(id)}`;
    }
    // bỏ đơn vị khỏi phạm vi được phân công của cán bộ
    for (const r of await tx`SELECT id, pham_vi FROM nguoi_dung WHERE pham_vi IS NOT NULL AND jsonb_typeof(pham_vi->'don_vi') = 'array'`) {
      const ds = (r.pham_vi.don_vi as unknown[]).map(Number);
      if (!ds.includes(id)) continue;
      const moi = [...new Set(ds.map((x) => (x === id ? den : x)).filter((x): x is number => !!x))];
      await tx`UPDATE nguoi_dung SET pham_vi = ${tx.json({ ...r.pham_vi, don_vi: moi })} WHERE id = ${r.id}`;
    }
    await tx`DELETE FROM don_vi WHERE id = ${id}`;
    await writeLog(tx, u.id, "xoa_don_vi", "don_vi", id, dv, { chuyen_sang: den, ...c });
  });
  const msg = `Đã xóa “${dv.ten}”${den ? `; đã chuyển ${parts.join(", ")} sang “${ten_den}”` : ""}.`;
  return { redirect: `/quan-tri?muc=don_vi&da_xoa=${encodeURIComponent(msg)}` };
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
    chuc_vu_dang: str(fd, "chuc_vu_dang") || null,
    chuc_vu_kiem_nhiem: str(fd, "chuc_vu_kiem_nhiem") || null,
    id_don_vi_kiem_nhiem: Number(str(fd, "id_don_vi_kiem_nhiem")) || null,
    chuc_danh_bcd: str(fd, "chuc_danh_bcd") || null,
    chuc_danh_tgv: str(fd, "chuc_danh_tgv") || null,
    vai_tro: VAI_TRO[str(fd, "vai_tro")] ? str(fd, "vai_tro") : "cong_chuc",
    linh_vuc_phu_trach: fd.getAll("linh_vuc_phu_trach").map(String).filter(Boolean),
    trang_thai: str(fd, "trang_thai") === "khoa" ? "khoa" : "hoat_dong",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as Record<string, any>;
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
  const { docBang, nhapCanBo } = await import("@/lib/nhapCanBo");
  const { getCatalog } = await import("@/lib/settings");
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(Buffer.from(await f.arrayBuffer()) as never);
  } catch {
    return { error: "Không đọc được tệp .xlsx." };
  }
  const ws = wb.worksheets[0];
  const rows: string[][] = [];
  ws.eachRow((row) => {
    const r: string[] = [];
    for (let i = 1; i <= Math.max(ws.columnCount, 15); i++) r.push(cellText(row.getCell(i).value));
    rows.push(r);
  });
  const { dong, loi } = docBang(rows);
  if (loi.length) return { error: loi.join("\n") };
  if (!dong.length) return { error: "Không có cán bộ nào trong tệp." };
  const sql = await db();
  const linhVucCo = await getCatalog("linh_vuc");
  const r = (await sql.begin(async (tx) => {
    const k = await nhapCanBo(tx, dong, { hash: hashPassword, matKhau: tempPassword, linhVucCo });
    await writeLog(tx, u.id, "nhap_nguoi_dung_excel", "nguoi_dung", null, null, { so_dong: dong.length, tao: k.tao.length, cap_nhat: k.capNhat.length });
    return k;
  })) as unknown as Awaited<ReturnType<typeof nhapCanBo>>;
  const parts = [
    `Đã tạo ${r.tao.length} tài khoản, cập nhật ${r.capNhat.length} tài khoản đã có${r.donViMoi.length ? `, thêm ${r.donViMoi.length} đơn vị (${r.donViMoi.join("; ")})` : ""}.`,
    r.tao.length ? `Tài khoản mới (Họ tên — Tên đăng nhập — Mật khẩu tạm). Hãy lưu lại để phát cho cán bộ:\n${r.tao.map((x) => `${x.ho_ten}\t${x.ten_dang_nhap}\t${x.mat_khau}`).join("\n")}` : "",
    r.capNhat.length ? `Cập nhật chức vụ, đơn vị (giữ mật khẩu, vai trò, quyền): ${r.capNhat.map((x) => x.ho_ten).join(", ")}` : "",
    r.loi.length ? `Lưu ý:\n${r.loi.join("\n")}` : "",
  ];
  return { ok: true, message: parts.filter(Boolean).join("\n\n") };
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
    ten_hien_thi: str(fd, "ten_hien_thi"),
    ten_cap_tren: str(fd, "ten_cap_tren"),
    dia_danh: str(fd, "dia_danh"),
    chuc_vu_ky: str(fd, "chuc_vu_ky"),
    nguoi_ky: str(fd, "nguoi_ky"),
    tm_ky: str(fd, "tm_ky") || "TM. ỦY BAN NHÂN DÂN",
    chuc_vu_ky_thay: str(fd, "chuc_vu_ky_thay"),
    nguoi_ky_thay: str(fd, "nguoi_ky_thay"),
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

// ===================== Danh mục: thêm, sửa tên, xóa, sắp xếp từng mục =====================
/** Bảng, cột đang dùng giá trị của từng loại danh mục (để đổi tên đồng bộ) */
const DUNG_DANH_MUC: Record<string, [string, string][]> = {
  linh_vuc: [
    ["cong_viec", "linh_vuc"],
    ["chi_tieu", "linh_vuc"],
  ],
  nguon_giao: [["cong_viec", "nguon_giao"]],
  san_pham: [["cong_viec", "san_pham"]],
  nhom_chi_tieu: [["chi_tieu", "nhom"]],
  don_vi_tinh: [["chi_tieu", "don_vi_tinh"]],
  nguon_chi_tieu: [["chi_tieu", "nguon"]],
  chuc_vu_dang: [["nguoi_dung", "chuc_vu_dang"]],
  chuc_vu: [["nguoi_dung", "chuc_vu"], ["nguoi_dung", "chuc_vu_kiem_nhiem"]],
  chuc_danh_bcd: [["nguoi_dung", "chuc_danh_bcd"]],
  chuc_danh_tgv: [["nguoi_dung", "chuc_danh_tgv"]],
};

export async function catalogItemAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await need("qt.co_cau");
  if (!u) return { error: "Không có quyền." };
  const loai = str(fd, "loai");
  if (!DUNG_DANH_MUC[loai]) return { error: "Danh mục không hợp lệ." };
  const op = str(fd, "op");
  const id = Number(str(fd, "id")) || 0;
  const ten = str(fd, "ten").replace(/\s+/g, " ");
  const sql = await db();
  // danh mục chưa lưu vào CSDL thì lưu mặc định trước
  if (!(await sql`SELECT 1 FROM danh_muc WHERE loai = ${loai} LIMIT 1`).length) {
    const { DANH_MUC_MAC_DINH } = await import("@/lib/const");
    for (const [i, t] of (DANH_MUC_MAC_DINH[loai] || []).entries()) await sql`INSERT INTO danh_muc (loai, ten, thu_tu) VALUES (${loai}, ${t}, ${i}) ON CONFLICT DO NOTHING`;
  }
  if (op === "them") {
    if (!ten) return { error: "Nhập tên." };
    if ((await sql`SELECT 1 FROM danh_muc WHERE loai = ${loai} AND lower(ten) = lower(${ten})`).length) return { error: `“${ten}” đã có trong danh mục.` };
    const n = (await sql`SELECT coalesce(max(thu_tu), 0)::int + 1 AS n FROM danh_muc WHERE loai = ${loai}`)[0].n;
    await sql`INSERT INTO danh_muc (loai, ten, thu_tu) VALUES (${loai}, ${ten}, ${n})`;
    await writeLog(sql, u.id, "them_danh_muc", "danh_muc", null, null, { loai, ten });
    return { ok: true, message: `Đã thêm “${ten}”.`, reset: true };
  }
  const row = (await sql`SELECT * FROM danh_muc WHERE id = ${id} AND loai = ${loai}`)[0];
  if (!row) return { error: "Không tìm thấy mục." };
  if (op === "sua") {
    if (!ten) return { error: "Nhập tên." };
    if (ten === row.ten) return { ok: true };
    if ((await sql`SELECT 1 FROM danh_muc WHERE loai = ${loai} AND lower(ten) = lower(${ten}) AND id <> ${id}`).length) return { error: `“${ten}” đã có trong danh mục.` };
    let n = 0;
    await sql.begin(async (tx) => {
      await tx`UPDATE danh_muc SET ten = ${ten} WHERE id = ${id}`;
      for (const [t, c] of DUNG_DANH_MUC[loai]) n += (await tx`UPDATE ${tx(t)} SET ${tx(c)} = ${ten} WHERE ${tx(c)} = ${row.ten}`).count;
      if (loai === "linh_vuc") {
        n += (await tx`UPDATE nguoi_dung SET linh_vuc_phu_trach = array_replace(linh_vuc_phu_trach, ${row.ten}, ${ten}) WHERE ${row.ten} = ANY(linh_vuc_phu_trach)`).count;
        await tx`UPDATE nguoi_dung SET pham_vi = jsonb_set(pham_vi, '{linh_vuc}', (SELECT coalesce(jsonb_agg(CASE WHEN x = ${row.ten} THEN ${ten} ELSE x END), '[]'::jsonb) FROM jsonb_array_elements_text(pham_vi->'linh_vuc') x))
                 WHERE pham_vi IS NOT NULL AND jsonb_typeof(pham_vi->'linh_vuc') = 'array' AND pham_vi->'linh_vuc' ? ${row.ten}`;
        // giá trị trong các module nhập liệu có trường kiểu lĩnh vực
        const fs = await tx`SELECT id_mo_dun, khoa FROM mo_dun_truong WHERE kieu = 'linh_vuc'`;
        for (const f of fs) n += (await tx`UPDATE mo_dun_ban_ghi SET du_lieu = jsonb_set(du_lieu, ${"{" + f.khoa + "}"}::text[], to_jsonb(${ten}::text)) WHERE id_mo_dun = ${f.id_mo_dun} AND du_lieu->>${f.khoa} = ${row.ten}`).count;
      }
      await writeLog(tx, u.id, "doi_ten_danh_muc", "danh_muc", id, { loai, ten: row.ten }, { loai, ten, cap_nhat: n });
    });
    return { ok: true, message: `Đã đổi tên thành “${ten}”${n ? `, cập nhật ${n} nội dung đang dùng` : ""}.` };
  }
  if (op === "xoa") {
    let used = 0;
    for (const [t, c] of DUNG_DANH_MUC[loai]) used += (await sql`SELECT count(*)::int AS n FROM ${sql(t)} WHERE ${sql(c)} = ${row.ten}`)[0].n;
    await sql`DELETE FROM danh_muc WHERE id = ${id}`;
    await writeLog(sql, u.id, "xoa_danh_muc", "danh_muc", id, { loai, ten: row.ten }, null);
    return { ok: true, message: `Đã xóa “${row.ten}”.${used ? ` ${used} nội dung cũ vẫn giữ tên này; chỉ không chọn được cho nội dung mới.` : ""}` };
  }
  if (op === "len" || op === "xuong") {
    await sql.begin(async (tx) => {
      const ids = (await tx`SELECT id FROM danh_muc WHERE loai = ${loai} ORDER BY thu_tu, id`).map((r) => r.id as number);
      const i = ids.indexOf(id);
      const j = i + (op === "len" ? -1 : 1);
      if (j < 0 || j >= ids.length) return;
      [ids[i], ids[j]] = [ids[j], ids[i]];
      for (const [k, x] of ids.entries()) await tx`UPDATE danh_muc SET thu_tu = ${k} WHERE id = ${x}`;
    });
    return { ok: true };
  }
  return { error: "Thao tác không hợp lệ." };
}

// ===================== Thùng rác =====================
export async function trashAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await need("qt.du_lieu");
  if (!u) return { error: "Không có quyền." };
  const { restore, purge } = await import("@/lib/trash");
  const id = Number(str(fd, "id"));
  const sql = await db();
  try {
    if (str(fd, "op") === "khoi_phuc") {
      const r = await sql.begin((tx) => restore(tx, id, u.id));
      return { ok: true, message: `Đã khôi phục “${r.tieu_de}”.` };
    }
    await sql.begin((tx) => purge(tx, id, u.id));
    return { ok: true, message: "Đã xóa vĩnh viễn." };
  } catch (e) {
    const msg = (e as Error).message;
    return { error: /foreign key|khóa ngoại/i.test(msg) ? "Không khôi phục được vì dữ liệu liên quan (cán bộ, đơn vị, mục cha) đã bị xóa. Hãy khôi phục mục cha trước." : msg };
  }
}

// ===================== Dữ liệu mẫu Nghị quyết 57 =====================
export async function seedDemoAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await need("qt.du_lieu");
  if (!u) return { error: "Không có quyền." };
  const { seedDemoNQ57, removeDemoNQ57 } = await import("@/lib/seedNq57");
  const sql = await db();
  if (str(fd, "op") === "xoa") {
    const n = await sql.begin((tx) => removeDemoNQ57(tx, u.id));
    return { ok: true, message: `Đã xóa ${n} nội dung mẫu.` };
  }
  const r = await sql.begin((tx) => seedDemoNQ57(tx, u.id));
  return { ok: true, message: `Đã nạp ${r.cong_viec} công việc, ${r.chi_tieu} chỉ tiêu, ${r.ban_ghi} bản ghi mẫu.` };
}

export async function saveThemeAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await need("qt.cai_dat");
  if (!u) return { error: "Không có quyền." };
  const { saveTheme } = await import("@/lib/theme");
  const sql = await db();
  const phu = Math.min(0.95, Math.max(0.55, Number(str(fd, "phu_menu")) || 0.82));
  await saveTheme(sql, { chao_bat: str(fd, "chao_bat") === "1", phu_menu: phu });
  await writeLog(sql, u.id, "sua_giao_dien", "he_thong", null, null, { chao_bat: str(fd, "chao_bat") === "1", phu_menu: phu });
  return { ok: true, message: "Đã lưu cài đặt giao diện." };
}
