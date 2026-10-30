"use server";
import { randomInt } from "crypto";
import { db } from "@/lib/db";
import { getUser, hashPassword } from "@/lib/auth";
import { writeLog } from "@/lib/log";
import { saveSettings } from "@/lib/settings";
import type { ActionState } from "@/components/ActionForm";
import { VAI_TRO } from "@/lib/const";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

async function admin() {
  const u = await getUser();
  if (!u || u.vai_tro !== "quan_tri") return null;
  return u;
}

function tempPassword() {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const b = "abcdefghijkmnpqrstuvwxyz";
  return `${a[randomInt(a.length)]}${b[randomInt(b.length)]}${b[randomInt(b.length)]}${randomInt(100000, 999999)}`;
}

export async function saveUnitAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await admin();
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
  const u = await admin();
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
  };
  if (!v.ho_ten || !v.ten_dang_nhap) return { error: "Nhập họ tên và tên đăng nhập." };
  if (!/^[a-z0-9._-]{3,40}$/.test(v.ten_dang_nhap)) return { error: "Tên đăng nhập chỉ gồm chữ không dấu, số, dấu chấm, gạch." };
  const dup = await sql`SELECT id FROM nguoi_dung WHERE ten_dang_nhap = ${v.ten_dang_nhap} AND id <> ${id ?? 0}`;
  if (dup.length) return { error: "Tên đăng nhập đã tồn tại." };
  if (id) {
    const cu = (await sql`SELECT ho_ten, ten_dang_nhap, id_don_vi, chuc_vu, vai_tro, linh_vuc_phu_trach, trang_thai FROM nguoi_dung WHERE id = ${id}`)[0];
    if (id === u.id && (v.vai_tro !== "quan_tri" || v.trang_thai !== "hoat_dong")) return { error: "Không tự hạ quyền hoặc khóa tài khoản của chính mình." };
    await sql`UPDATE nguoi_dung SET ${sql(v as never)}, phien = CASE WHEN ${v.trang_thai} = 'khoa' THEN phien + 1 ELSE phien END WHERE id = ${id}`;
    await writeLog(sql, u.id, "sua_nguoi_dung", "nguoi_dung", id, cu, v);
    return { ok: true, message: "Đã lưu. Quyền mới có hiệu lực ngay (phân quyền theo chức vụ + đơn vị)." };
  }
  const pw = tempPassword();
  const [r] = await sql`INSERT INTO nguoi_dung ${sql({ ...v, mat_khau: await hashPassword(pw), doi_mat_khau: true } as never)} RETURNING id`;
  await writeLog(sql, u.id, "tao_nguoi_dung", "nguoi_dung", r.id, null, { ...v });
  return { ok: true, message: `Đã tạo tài khoản ${v.ten_dang_nhap}. Mật khẩu tạm: ${pw} (người dùng phải đổi khi đăng nhập lần đầu).`, reset: true };
}

export async function resetPasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await admin();
  if (!u) return { error: "Không có quyền." };
  const sql = await db();
  const id = Number(str(fd, "id"));
  const pw = tempPassword();
  await sql`UPDATE nguoi_dung SET mat_khau = ${await hashPassword(pw)}, doi_mat_khau = TRUE, phien = phien + 1, otp_bat = FALSE, otp_bi_mat = NULL WHERE id = ${id}`;
  await writeLog(sql, u.id, "cap_lai_mat_khau", "nguoi_dung", id);
  return { ok: true, message: `Mật khẩu tạm mới: ${pw} (đã tắt OTP, người dùng cần cài lại).` };
}

export async function importUsersAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await admin();
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
  const u = await admin();
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
  const u = await admin();
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
  const u = await admin();
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
