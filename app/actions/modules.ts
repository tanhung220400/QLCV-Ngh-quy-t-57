"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { writeLog } from "@/lib/log";
import type { ActionState } from "@/components/ActionForm";
import { loadModule, lookups, readForm, recordRights, recordScope, recordTitle, parseValue } from "@/lib/records";
import { KIEU_TRUONG, MAU_MODULE, MAU_MODULE_NQ57, createModuleFromTemplate, slugify, type MoDun } from "@/lib/modules";
import { trashModule, trashRecord } from "@/lib/trash";
import { VAI_TRO } from "@/lib/const";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

// ===================== Bản ghi =====================
export async function saveRecordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getUser();
  if (!user) return { redirect: "/dang-nhap" };
  const sql = await db();
  const mod = await loadModule(sql, str(fd, "ma"));
  if (!mod || mod.m.loai !== "du_lieu") return { error: "Không tìm thấy module." };
  const { m, fields } = mod;
  const id = Number(str(fd, "id")) || null;
  let cu: Record<string, unknown> | null = null;
  if (id) {
    const sc = (await recordScope(sql, user, m)).q;
    const r = (await sql`SELECT * FROM mo_dun_ban_ghi bg WHERE bg.id = ${id} AND bg.id_mo_dun = ${m.id} AND (${sc})`)[0];
    if (!r || !recordRights(user, m, r as never).sua) return { error: "Bạn không có quyền sửa bản ghi này." };
    cu = r.du_lieu;
  } else if (!recordRights(user, m).them) return { error: "Bạn không có quyền nhập dữ liệu vào module này." };
  const lk = await lookups(sql);
  const { data, errs } = readForm(fields, fd, lk);
  if (errs.length) return { error: errs.join("\n") };
  if (!Object.keys(data).length) return { error: "Chưa nhập nội dung." };
  let rid = id;
  if (id) {
    await sql`UPDATE mo_dun_ban_ghi SET du_lieu = ${sql.json(data as never)}, id_nguoi_sua = ${user.id}, cap_nhat_luc = now() WHERE id = ${id}`;
    await writeLog(sql, user.id, "sua_ban_ghi", "ban_ghi", id, cu, data);
  } else {
    const [r] = await sql`INSERT INTO mo_dun_ban_ghi (id_mo_dun, du_lieu, id_don_vi, id_nguoi_tao, id_nguoi_sua) VALUES (${m.id}, ${sql.json(data as never)}, ${user.id_don_vi}, ${user.id}, ${user.id}) RETURNING id`;
    rid = r.id;
    await writeLog(sql, user.id, "them_ban_ghi", "ban_ghi", r.id, null, { mo_dun: m.ma, ...data });
  }
  if (str(fd, "tiep") === "1") return { ok: true, message: "Đã lưu. Nhập tiếp bản ghi mới.", reset: true };
  return { redirect: `/m/${m.ma}/${rid}?luu=1` };
}

export async function deleteRecordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getUser();
  if (!user) return { redirect: "/dang-nhap" };
  const sql = await db();
  const id = Number(str(fd, "id"));
  const r = (await sql`SELECT bg.*, m.ma FROM mo_dun_ban_ghi bg JOIN mo_dun m ON m.id = bg.id_mo_dun WHERE bg.id = ${id}`)[0];
  if (!r) return { error: "Không tìm thấy bản ghi." };
  const mod = (await loadModule(sql, r.ma))!;
  if (!recordRights(user, mod.m, r as never).xoa) return { error: "Bạn không có quyền xóa bản ghi này." };
  const lk = await lookups(sql);
  const title = `${mod.m.ten}: ${recordTitle(mod.fields, r as never, lk)}`;
  await sql.begin((tx) => trashRecord(tx, id, user.id, str(fd, "ly_do") || null, title));
  return { redirect: `/m/${r.ma}?xoa=1` };
}

/** Nhập nhiều bản ghi từ Excel (dòng 1 là tên cột, khớp theo tên trường) */
export async function importRecordsAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getUser();
  if (!user) return { redirect: "/dang-nhap" };
  const sql = await db();
  const mod = await loadModule(sql, str(fd, "ma"));
  if (!mod || mod.m.loai !== "du_lieu") return { error: "Không tìm thấy module." };
  if (!recordRights(user, mod.m).them) return { error: "Không có quyền nhập dữ liệu." };
  const f = fd.get("file");
  if (!(f instanceof File) || !f.size) return { error: "Chọn tệp Excel (.xlsx)." };
  const ExcelJS = (await import("exceljs")).default;
  const { cellText } = await import("@/lib/excel");
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(Buffer.from(await f.arrayBuffer()) as never);
  } catch {
    return { error: "Không đọc được tệp. Hãy dùng tệp .xlsx (tải mẫu ở nút “Tải mẫu nhập”)." };
  }
  const ws = wb.worksheets[0];
  const norm = (s: string) => s.toLowerCase().replace(/\s*\*$/, "").replace(/\s+/g, " ").trim();
  const head: Record<number, (typeof mod.fields)[number]> = {};
  ws.getRow(1).eachCell((c, i) => {
    const t = norm(cellText(c.value));
    const fld = mod.fields.find((x) => norm(x.ten) === t || x.khoa === t);
    if (fld) head[i] = fld;
  });
  if (!Object.keys(head).length) return { error: "Dòng đầu của tệp phải là tên các cột như trong mẫu." };
  const lk = await lookups(sql);
  const rows: Record<string, unknown>[] = [];
  const errs: string[] = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const data: Record<string, unknown> = {};
    let any = false;
    for (const [i, fld] of Object.entries(head)) {
      let raw = cellText(row.getCell(Number(i)).value);
      const cv = row.getCell(Number(i)).value;
      if (fld.kieu === "ngay" && cv instanceof Date) raw = cv.toISOString().slice(0, 10);
      if (raw) any = true;
      const [v, e] = parseValue(fld, raw, lk);
      if (e && raw) errs.push(`Dòng ${n}: ${e}`);
      else if (e && fld.bat_buoc) errs.push(`Dòng ${n}: ${e}`);
      if (v !== null) data[fld.khoa] = v;
    }
    if (any) rows.push(data);
  });
  if (errs.length) return { error: errs.slice(0, 15).join("\n") + (errs.length > 15 ? `\n… và ${errs.length - 15} lỗi khác` : "") };
  if (!rows.length) return { error: "Tệp không có dòng dữ liệu." };
  await sql.begin(async (tx) => {
    for (const d of rows) await tx`INSERT INTO mo_dun_ban_ghi (id_mo_dun, du_lieu, id_don_vi, id_nguoi_tao, id_nguoi_sua) VALUES (${mod.m.id}, ${tx.json(d as never)}, ${user.id_don_vi}, ${user.id}, ${user.id})`;
    await writeLog(tx, user.id, "nhap_excel_ban_ghi", "mo_dun", mod.m.id, null, { so_dong: rows.length });
  });
  return { ok: true, message: `Đã nhập ${rows.length} bản ghi.` };
}

// ===================== Thiết kế module (quản trị) =====================
async function designer() {
  const u = await getUser();
  return u && u.quyen.includes("qt.mo_dun") ? u : null;
}

const LOAI = ["nhom", "du_lieu", "lien_ket", "he_thong"];

export async function saveModuleAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await designer();
  if (!u) return { error: "Không có quyền thiết kế module." };
  const sql = await db();
  const id = Number(str(fd, "id")) || null;
  const cu = id ? ((await sql`SELECT * FROM mo_dun WHERE id = ${id}`)[0] as unknown as MoDun | undefined) : undefined;
  if (id && !cu) return { error: "Không tìm thấy module." };
  const ten = str(fd, "ten");
  if (!ten) return { error: "Nhập tên module." };
  const loai = cu?.loai === "he_thong" ? "he_thong" : LOAI.includes(str(fd, "loai")) && str(fd, "loai") !== "he_thong" ? str(fd, "loai") : "du_lieu";
  const id_cha = Number(str(fd, "id_cha")) || null;
  if (id_cha) {
    if (id && id_cha === id) return { error: "Module không thể nằm trong chính nó." };
    const p = (await sql`WITH RECURSIVE up AS (SELECT id, id_cha, loai FROM mo_dun WHERE id = ${id_cha} UNION SELECT m.id, m.id_cha, m.loai FROM mo_dun m JOIN up ON m.id = up.id_cha) SELECT * FROM up`) as unknown as { id: number; loai: string }[];
    if (id && p.some((x) => x.id === id)) return { error: "Không thể chuyển module vào module con của nó." };
    if (p[0]?.loai !== "nhom" && p[0]?.loai !== "du_lieu") return { error: "Chỉ đặt được module con trong nhóm hoặc module nhập liệu." };
  }
  let duong_dan = str(fd, "duong_dan") || null;
  if (loai === "lien_ket" && !duong_dan) return { error: "Nhập đường dẫn cho module liên kết." };
  if (loai === "he_thong") duong_dan = cu!.duong_dan;
  if (loai === "lien_ket" && duong_dan && !/^(https?:\/\/|\/)/.test(duong_dan)) duong_dan = `https://${duong_dan}`;
  const roles = (k: string) => fd.getAll(k).map(String).filter((r) => VAI_TRO[r]);
  const v = {
    ten,
    mo_ta: str(fd, "mo_ta") || null,
    bieu_tuong: str(fd, "bieu_tuong") || "folder",
    mau: MAU_MODULE[str(fd, "mau")] ? str(fd, "mau") : "blue",
    loai,
    duong_dan,
    id_cha,
    thu_tu: Number(str(fd, "thu_tu")) || 0,
    hien: str(fd, "hien") !== "0",
    vai_tro_xem: roles("vai_tro_xem"),
    vai_tro_nhap: roles("vai_tro_nhap"),
    pham_vi: str(fd, "pham_vi") === "don_vi" ? "don_vi" : "toan_xa",
  };
  if (id) {
    await sql`UPDATE mo_dun SET ${sql(v as never)} WHERE id = ${id}`;
    await writeLog(sql, u.id, "sua_mo_dun", "mo_dun", id, cu, v);
    revalidatePath("/", "layout");
    return { ok: true, message: "Đã lưu module." };
  }
  let ma = slugify(str(fd, "ma") || ten);
  for (let i = 2; (await sql`SELECT 1 FROM mo_dun WHERE ma = ${ma}`).length; i++) ma = `${slugify(ten)}-${i}`;
  if (!v.thu_tu) v.thu_tu = ((await sql`SELECT coalesce(max(thu_tu), 0)::int AS n FROM mo_dun WHERE id_cha IS NOT DISTINCT FROM ${id_cha}`)[0].n as number) + 1;
  const [r] = await sql`INSERT INTO mo_dun ${sql({ ...v, ma } as never)} RETURNING id`;
  await writeLog(sql, u.id, "tao_mo_dun", "mo_dun", r.id, null, { ...v, ma });
  // module nhập liệu mới có sẵn 2 trường để bắt đầu
  if (loai === "du_lieu") {
    await sql`INSERT INTO mo_dun_truong (id_mo_dun, khoa, ten, kieu, bat_buoc, thu_tu) VALUES (${r.id}, 'ten', 'Tên, nội dung', 'van_ban', TRUE, 1), (${r.id}, 'ghi_chu', 'Ghi chú', 'doan_van', FALSE, 2)`;
    await sql`UPDATE mo_dun_truong SET hien_danh_sach = FALSE WHERE id_mo_dun = ${r.id} AND khoa = 'ghi_chu'`;
  }
  revalidatePath("/", "layout");
  redirect(`/quan-tri/mo-dun/${r.id}?moi=1`);
}

export async function templateModuleAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await designer();
  if (!u) return { error: "Không có quyền thiết kế module." };
  const t = MAU_MODULE_NQ57.find((x) => x.ma === str(fd, "mau"));
  if (!t) return { error: "Chọn mẫu." };
  const sql = await db();
  let ma = t.ma;
  for (let i = 2; (await sql`SELECT 1 FROM mo_dun WHERE ma = ${ma}`).length; i++) ma = `${t.ma}-${i}`;
  const id_cha = Number(str(fd, "id_cha")) || null;
  const n = ((await sql`SELECT coalesce(max(thu_tu), 0)::int AS n FROM mo_dun WHERE id_cha IS NOT DISTINCT FROM ${id_cha}`)[0].n as number) + 1;
  const id = await sql.begin((tx) => createModuleFromTemplate(tx, t, id_cha, n, ma));
  await writeLog(sql, u.id, "tao_mo_dun", "mo_dun", id, null, { mau: t.ma, ma });
  revalidatePath("/", "layout");
  redirect(`/quan-tri/mo-dun/${id}?moi=1`);
}

export async function moveModuleAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await designer();
  if (!u) return { error: "Không có quyền." };
  const sql = await db();
  const id = Number(str(fd, "id"));
  const dir = str(fd, "dir") === "len" ? -1 : 1;
  const m = (await sql`SELECT id, id_cha FROM mo_dun WHERE id = ${id}`)[0];
  if (!m) return { error: "Không tìm thấy module." };
  await sql.begin(async (tx) => {
    const sib = await tx`SELECT id FROM mo_dun WHERE id_cha IS NOT DISTINCT FROM ${m.id_cha} ORDER BY thu_tu, id`;
    const ids = sib.map((r) => r.id as number);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    for (const [k, x] of ids.entries()) await tx`UPDATE mo_dun SET thu_tu = ${k + 1} WHERE id = ${x}`;
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function toggleModuleAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await designer();
  if (!u) return { error: "Không có quyền." };
  const sql = await db();
  const id = Number(str(fd, "id"));
  const [r] = await sql`UPDATE mo_dun SET hien = NOT hien WHERE id = ${id} RETURNING ten, hien`;
  if (!r) return { error: "Không tìm thấy module." };
  await writeLog(sql, u.id, r.hien ? "hien_mo_dun" : "an_mo_dun", "mo_dun", id, null, { ten: r.ten });
  revalidatePath("/", "layout");
  return { ok: true, message: r.hien ? `Đã hiện “${r.ten}”.` : `Đã ẩn “${r.ten}”.` };
}

export async function deleteModuleAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await designer();
  if (!u) return { error: "Không có quyền." };
  const sql = await db();
  const id = Number(str(fd, "id"));
  try {
    await sql.begin((tx) => trashModule(tx, id, u.id, str(fd, "ly_do") || null, str(fd, "giu_con") === "1"));
  } catch (e) {
    return { error: (e as Error).message };
  }
  if (str(fd, "o_lai") === "1") return { ok: true, message: "Đã xóa module vào Thùng rác." };
  revalidatePath("/", "layout");
  redirect("/quan-tri?muc=mo_dun&xoa=1");
}

// ----- Trường dữ liệu -----
export async function saveFieldAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await designer();
  if (!u) return { error: "Không có quyền." };
  const sql = await db();
  const id_mo_dun = Number(str(fd, "id_mo_dun"));
  const id = Number(str(fd, "id")) || null;
  const ten = str(fd, "ten");
  if (!ten) return { error: "Nhập tên trường." };
  const kieu = KIEU_TRUONG[str(fd, "kieu")] ? str(fd, "kieu") : "van_ban";
  const tuy_chon = str(fd, "tuy_chon").split("\n").map((s) => s.trim()).filter(Boolean);
  if ((kieu === "lua_chon" || kieu === "nhieu_lua_chon") && !tuy_chon.length) return { error: "Nhập các lựa chọn, mỗi dòng một lựa chọn." };
  const v = {
    ten,
    kieu,
    bat_buoc: str(fd, "bat_buoc") === "1",
    tuy_chon,
    goi_y: str(fd, "goi_y") || null,
    hien_danh_sach: str(fd, "hien_danh_sach") === "1",
  };
  if (id) {
    const cu = (await sql`SELECT * FROM mo_dun_truong WHERE id = ${id} AND id_mo_dun = ${id_mo_dun}`)[0];
    if (!cu) return { error: "Không tìm thấy trường." };
    await sql`UPDATE mo_dun_truong SET ${sql(v as never)} WHERE id = ${id}`;
    await writeLog(sql, u.id, "sua_truong", "mo_dun", id_mo_dun, cu, v);
    return { ok: true, message: "Đã lưu trường." };
  }
  let khoa = slugify(ten).replace(/-/g, "_").slice(0, 40) || "truong";
  for (let i = 2; (await sql`SELECT 1 FROM mo_dun_truong WHERE id_mo_dun = ${id_mo_dun} AND khoa = ${khoa}`).length; i++) khoa = `${slugify(ten).replace(/-/g, "_").slice(0, 36)}_${i}`;
  const n = ((await sql`SELECT coalesce(max(thu_tu), 0)::int AS n FROM mo_dun_truong WHERE id_mo_dun = ${id_mo_dun}`)[0].n as number) + 1;
  await sql`INSERT INTO mo_dun_truong ${sql({ ...v, khoa, id_mo_dun, thu_tu: n } as never)}`;
  await writeLog(sql, u.id, "them_truong", "mo_dun", id_mo_dun, null, { ...v, khoa });
  return { ok: true, message: `Đã thêm trường “${ten}”.`, reset: true };
}

export async function fieldOpAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await designer();
  if (!u) return { error: "Không có quyền." };
  const sql = await db();
  const id = Number(str(fd, "id"));
  const f = (await sql`SELECT * FROM mo_dun_truong WHERE id = ${id}`)[0];
  if (!f) return { error: "Không tìm thấy trường." };
  const op = str(fd, "op");
  if (op === "xoa") {
    const n = (await sql`SELECT count(*)::int AS n FROM mo_dun_ban_ghi WHERE id_mo_dun = ${f.id_mo_dun} AND du_lieu ? ${f.khoa}`)[0].n;
    await sql`DELETE FROM mo_dun_truong WHERE id = ${id}`;
    await writeLog(sql, u.id, "xoa_truong", "mo_dun", f.id_mo_dun, f, null);
    return { ok: true, message: `Đã xóa trường “${f.ten}”.${n ? ` Dữ liệu cũ của ${n} bản ghi vẫn được giữ, thêm lại trường cùng tên để hiện lại.` : ""}` };
  }
  const dir = op === "len" ? -1 : 1;
  await sql.begin(async (tx) => {
    const ids = (await tx`SELECT id FROM mo_dun_truong WHERE id_mo_dun = ${f.id_mo_dun} ORDER BY thu_tu, id`).map((r) => r.id as number);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    for (const [k, x] of ids.entries()) await tx`UPDATE mo_dun_truong SET thu_tu = ${k + 1} WHERE id = ${x}`;
  });
  return { ok: true };
}
