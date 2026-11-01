"use server";
import { after } from "next/server";
import { db } from "@/lib/db";
import { flushSms } from "@/lib/sms";
import { getUser, type User } from "@/lib/auth";
import { canManageKpi, canSeeKpi } from "@/lib/perm";
import { kpiRights } from "@/lib/kpiRights";
import { notify, writeLog } from "@/lib/log";
import { periodLabel } from "@/lib/kpi";
import type { ActionState } from "@/components/ActionForm";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const num = (s: string) => {
  const v = Number(s.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(v) ? v : NaN;
};

async function kpiRole(user: User, kpiId: number) {
  const sql = await db();
  const k = (await sql`SELECT * FROM chi_tieu WHERE id = ${kpiId}`)[0];
  if (!k || !(await canSeeKpi(user, kpiId))) return null;
  const r = await kpiRights(user, k as never);
  return { k, ...r };
}

export async function saveKpiAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getUser();
  if (!user) return { redirect: "/dang-nhap" };
  const id = Number(str(fd, "id")) || null;
  const idCha = Number(str(fd, "id_cha")) || null;
  if (!canManageKpi(user)) return { error: "Bạn không có quyền quản lý chỉ tiêu." };
  const sql = await db();
  const kh = num(str(fd, "ke_hoach_nam"));
  const dau = str(fd, "gia_tri_dau_nam") ? num(str(fd, "gia_tri_dau_nam")) : null;
  const v = {
    ten: str(fd, "ten"),
    nguon: str(fd, "nguon"),
    nhom: str(fd, "nhom"),
    don_vi_tinh: str(fd, "don_vi_tinh"),
    loai: ["cong_don", "ty_le", "dat_khong", "ho_so"].includes(str(fd, "loai")) ? str(fd, "loai") : "cong_don",
    chieu_tot: str(fd, "chieu_tot") === "thap" ? "thap" : "cao",
    ke_hoach_nam: kh,
    gia_tri_dau_nam: dau,
    nam: Number(str(fd, "nam")),
    han: str(fd, "han"),
    id_phu_trach: Number(str(fd, "id_phu_trach")) || null,
    id_don_vi_phu_trach: Number(str(fd, "id_don_vi_phu_trach")) || null,
    id_lanh_dao: Number(str(fd, "id_lanh_dao")) || null,
    linh_vuc: str(fd, "linh_vuc") || null,
    ky_cap_nhat: ["tuan", "thang", "quy"].includes(str(fd, "ky_cap_nhat")) ? str(fd, "ky_cap_nhat") : "thang",
    ngay_chot: Math.min(28, Math.max(1, Number(str(fd, "ngay_chot")) || 25)),
    id_cha: idCha,
  };
  // giao cho nhiều đơn vị: chỉ tiêu chung của phường + mỗi đơn vị một phần (tự tổng hợp)
  const nhieu = [...new Set(fd.getAll("don_vi_nhieu").map(Number).filter(Boolean))];
  if (fd.has("co_don_vi_nhieu")) {
    if (nhieu.length === 1) v.id_don_vi_phu_trach = nhieu[0];
    else if (nhieu.length > 1) {
      v.id_don_vi_phu_trach = null;
      if (!str(fd, "id_phu_trach")) v.id_phu_trach = null;
    }
  }
  if (v.loai === "ho_so") v.don_vi_tinh = "%";
  const miss = [!v.ten && "tên", !v.nguon && "nguồn", !v.nhom && "nhóm", !v.don_vi_tinh && "đơn vị tính", Number.isNaN(kh) && "kế hoạch năm", !v.nam && "năm", !/^\d{4}-\d{2}-\d{2}$/.test(v.han) && "ngày hết hạn", !v.id_phu_trach && !v.id_don_vi_phu_trach && nhieu.length < 2 && "người hoặc đơn vị phụ trách"].filter(Boolean);
  if (miss.length) return { error: `Còn thiếu: ${miss.join(", ")}.` };
  if (v.loai === "dat_khong") v.ke_hoach_nam = 1;
  if (!v.id_phu_trach && v.id_don_vi_phu_trach) {
    const h = await sql`SELECT id FROM nguoi_dung WHERE id_don_vi = ${v.id_don_vi_phu_trach} AND vai_tro IN ('truong_don_vi','truong_thon') AND trang_thai = 'hoat_dong' LIMIT 1`;
    v.id_phu_trach = h[0]?.id ?? null;
  }
  let newId = id;
  if (id) {
    const cu = (await sql`SELECT * FROM chi_tieu WHERE id = ${id}`)[0];
    await sql`UPDATE chi_tieu SET ${sql(v as never)} WHERE id = ${id}`;
    await writeLog(sql, user.id, "sua_chi_tieu", "chi_tieu", id, cu, v);
  } else {
    const [r] = await sql`INSERT INTO chi_tieu ${sql(v as never)} RETURNING id`;
    newId = r.id;
    await writeLog(sql, user.id, "tao_chi_tieu", "chi_tieu", r.id, null, v);
    await notify(sql, [v.id_phu_trach], "giao_chi_tieu", `Được giao phụ trách chỉ tiêu: ${v.ten}`, `Kế hoạch năm ${v.nam}: ${kh} ${v.don_vi_tinh}`, "chi_tieu", r.id, `giaoct:${r.id}`, user.id);
  }
  if (nhieu.length > 1 && newId) {
    // tạo phần của từng đơn vị chưa có; phần của đơn vị bỏ chọn được giữ lại (hủy ở trang chỉ tiêu con nếu cần)
    const co = (await sql`SELECT id_don_vi_phu_trach AS dv FROM chi_tieu WHERE id_cha = ${newId} AND NOT huy`).map((r) => r.dv as number);
    const ten = new Map((await sql`SELECT id, ten FROM don_vi WHERE id IN ${sql(nhieu)}`).map((r) => [r.id as number, r.ten as string]));
    const khCon = v.loai === "cong_don" ? Math.round((kh / nhieu.length) * 100) / 100 : v.ke_hoach_nam;
    // cập nhật thông tin chung xuống các phần đã có
    await sql`UPDATE chi_tieu SET nguon = ${v.nguon}, nhom = ${v.nhom}, loai = ${v.loai}, don_vi_tinh = ${v.don_vi_tinh}, chieu_tot = ${v.chieu_tot}, nam = ${v.nam}, han = ${v.han},
               linh_vuc = ${v.linh_vuc}, ky_cap_nhat = ${v.ky_cap_nhat}, ngay_chot = ${v.ngay_chot}, id_lanh_dao = ${v.id_lanh_dao},
               ke_hoach_nam = CASE WHEN ${v.loai} = 'cong_don' THEN ke_hoach_nam ELSE ${v.ke_hoach_nam} END
             WHERE id_cha = ${newId} AND NOT huy`;
    let i = 0;
    for (const dv of nhieu) {
      if (co.includes(dv)) continue;
      const h = await sql`SELECT id FROM nguoi_dung WHERE (id_don_vi = ${dv} OR id_don_vi_kiem_nhiem = ${dv}) AND vai_tro IN ('truong_don_vi','truong_thon','lanh_dao') AND trang_thai = 'hoat_dong'
                          ORDER BY CASE WHEN id_don_vi = ${dv} THEN 0 ELSE 1 END, CASE WHEN chuc_vu ILIKE 'Phó%' THEN 1 ELSE 0 END, id LIMIT 1`;
      const con = { ...v, ten: `${v.ten} — ${ten.get(dv) ?? ""}`, ke_hoach_nam: khCon, id_don_vi_phu_trach: dv, id_phu_trach: h[0]?.id ?? null, id_cha: newId, thu_tu: ++i };
      const [r] = await sql`INSERT INTO chi_tieu ${sql(con as never)} RETURNING id`;
      await writeLog(sql, user.id, "tao_chi_tieu", "chi_tieu", r.id, null, con);
      if (h[0]) await notify(sql, [h[0].id], "giao_chi_tieu", `Được giao phụ trách chỉ tiêu: ${con.ten}`, `Kế hoạch năm ${v.nam}: ${khCon} ${v.don_vi_tinh}`, "chi_tieu", r.id, `giaoct:${r.id}`, user.id);
    }
  }
  after(() => flushSms().catch(() => {}));
  return { redirect: `/chi-tieu/${idCha && !id ? idCha : newId}` };
}

export async function deleteKpiAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getUser();
  if (!user || !canManageKpi(user)) return { error: "Không có quyền." };
  const id = Number(str(fd, "id"));
  const sql = await db();
  await sql`UPDATE chi_tieu SET huy = TRUE WHERE id = ${id} OR id_cha = ${id}`;
  await writeLog(sql, user.id, "huy_chi_tieu", "chi_tieu", id, null, { ly_do: str(fd, "ly_do") });
  return { redirect: "/chi-tieu" };
}

export async function savePlansAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getUser();
  if (!user) return { redirect: "/dang-nhap" };
  const id = Number(str(fd, "id"));
  const r = await kpiRole(user, id);
  if (!r?.manage) return { error: "Không có quyền." };
  const sql = await db();
  const plans: { ky: string; gia_tri: number }[] = [];
  for (const [k, v] of fd.entries()) {
    if (!k.startsWith("ky_")) continue;
    const s = String(v).trim();
    if (!s) continue;
    const n = num(s);
    if (Number.isNaN(n)) return { error: `Giá trị không hợp lệ ở ${periodLabel(k.slice(3))}.` };
    plans.push({ ky: k.slice(3), gia_tri: n });
  }
  if (r.k.loai === "cong_don" && plans.length) {
    const total = plans.reduce((s, p) => s + p.gia_tri, 0);
    if (Math.abs(total - Number(r.k.ke_hoach_nam)) > 1e-6)
      return { error: `Tổng kế hoạch các kỳ (${total}) phải bằng kế hoạch năm (${r.k.ke_hoach_nam}) với chỉ tiêu cộng dồn.` };
  }
  await sql.begin(async (tx) => {
    await tx`DELETE FROM chi_tieu_ke_hoach_ky WHERE id_chi_tieu = ${id}`;
    for (const p of plans) await tx`INSERT INTO chi_tieu_ke_hoach_ky VALUES (${id}, ${p.ky}, ${p.gia_tri})`;
    await writeLog(tx, user.id, "ke_hoach_ky", "chi_tieu", id, null, plans);
  });
  return { ok: true, message: "Đã lưu kế hoạch theo kỳ." };
}

export async function addDataAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getUser();
  if (!user) return { redirect: "/dang-nhap" };
  const id = Number(str(fd, "id"));
  const r = await kpiRole(user, id);
  if (!r) return { error: "Không tìm thấy chỉ tiêu." };
  if (!r.enter) return { error: "Bạn không phụ trách chỉ tiêu này." };
  const ky = str(fd, "ky");
  if (!/^\d{4}-(\d{2}|Q[1-4]|\d{2}-\d{2})$/.test(ky)) return { error: "Chọn kỳ số liệu." };
  let hs: { tt: number; mp: number; tr: number } | null = null;
  let v: number;
  if (r.k.loai === "ho_so") {
    const n = (k: string) => (str(fd, k) === "" ? 0 : num(str(fd, k)));
    hs = { tt: n("so_toan_trinh"), mp: n("so_mot_phan"), tr: n("so_truc_tiep") };
    if ([hs.tt, hs.mp, hs.tr].some((x) => Number.isNaN(x) || x < 0 || !Number.isInteger(x))) return { error: "Số hồ sơ phải là số nguyên không âm." };
    const tong = hs.tt + hs.mp + hs.tr;
    if (!tong) return { error: "Nhập số hồ sơ phát sinh trong kỳ (toàn trình, một phần, trực tiếp)." };
    v = Math.round((hs.tt / tong) * 10000) / 100;
  } else v = r.k.loai === "dat_khong" ? (str(fd, "gia_tri") === "1" ? 1 : 0) : num(str(fd, "gia_tri"));
  if (Number.isNaN(v)) return { error: "Nhập số thực hiện hợp lệ." };
  const sql = await db();
  const autoConfirm = r.confirm;
  let newId = 0;
  await sql.begin(async (tx) => {
    const old = await tx`UPDATE chi_tieu_so_lieu SET hieu_luc = FALSE WHERE id_chi_tieu = ${id} AND ky = ${ky} AND hieu_luc RETURNING gia_tri, xac_nhan`;
    const [row] = await tx`INSERT INTO chi_tieu_so_lieu (id_chi_tieu, ky, gia_tri, ghi_chu, id_nguoi_nhap, xac_nhan, id_nguoi_xac_nhan, so_toan_trinh, so_mot_phan, so_truc_tiep)
      VALUES (${id}, ${ky}, ${v}, ${str(fd, "ghi_chu") || null}, ${user.id}, ${autoConfirm}, ${autoConfirm ? user.id : null}, ${hs?.tt ?? null}, ${hs?.mp ?? null}, ${hs?.tr ?? null}) RETURNING id`;
    newId = row.id;
    await writeLog(tx, user.id, old.length ? "sua_so_lieu" : "nhap_so_lieu", "chi_tieu", id, old[0] ?? null, { ky, gia_tri: v, id_so_lieu: row.id, ...(hs ? { ho_so: hs } : {}) });
    if (!autoConfirm) {
      const heads = await tx`SELECT id FROM nguoi_dung WHERE id_don_vi = ${r.k.id_don_vi_phu_trach ?? -1} AND vai_tro = 'truong_don_vi' AND trang_thai = 'hoat_dong'`;
      await notify(tx, heads.map((h) => h.id as number), "xac_nhan_so_lieu", `Chờ xác nhận số liệu: ${r.k.ten}`, `${periodLabel(ky)}: ${v} ${r.k.don_vi_tinh}`, "chi_tieu", id, undefined, user.id);
    }
  });
  const ve = Number(str(fd, "ve")) || id;
  return { ok: true, message: autoConfirm ? "Đã lưu số liệu." : "Đã lưu, chờ trưởng đơn vị xác nhận.", redirect: `/chi-tieu/${ve}?so_lieu=${newId}` };
}

export async function confirmDataAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getUser();
  if (!user) return { redirect: "/dang-nhap" };
  const sid = Number(str(fd, "id_so_lieu"));
  const sql = await db();
  const s = (await sql`SELECT * FROM chi_tieu_so_lieu WHERE id = ${sid} AND hieu_luc`)[0];
  if (!s) return { error: "Số liệu không còn hiệu lực." };
  const r = await kpiRole(user, s.id_chi_tieu);
  if (!r?.confirm) return { error: "Chỉ trưởng đơn vị hoặc lãnh đạo được xác nhận." };
  const ok = str(fd, "ket_luan") !== "tra_lai";
  if (ok) await sql`UPDATE chi_tieu_so_lieu SET xac_nhan = TRUE, id_nguoi_xac_nhan = ${user.id} WHERE id = ${sid}`;
  else await sql`UPDATE chi_tieu_so_lieu SET hieu_luc = FALSE WHERE id = ${sid}`;
  await writeLog(sql, user.id, ok ? "xac_nhan_so_lieu" : "tra_lai_so_lieu", "chi_tieu", s.id_chi_tieu, null, { id_so_lieu: sid, ky: s.ky, gia_tri: s.gia_tri, y_kien: str(fd, "y_kien") });
  await notify(sql, [s.id_nguoi_nhap], "so_lieu", `${ok ? "Đã xác nhận" : "Trả lại"} số liệu: ${r.k.ten}`, str(fd, "y_kien") || periodLabel(s.ky), "chi_tieu", s.id_chi_tieu, undefined, user.id);
  return { ok: true, message: ok ? "Đã xác nhận." : "Đã trả lại số liệu." };
}

// ---------- Nhập chỉ tiêu từ Excel theo mẫu ----------
const noAccent = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/\s+/g, " ").trim();

export async function importKpiAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getUser();
  if (!user) return { redirect: "/dang-nhap" };
  if (!canManageKpi(user)) return { error: "Không có quyền." };
  const f = fd.get("file");
  if (!(f instanceof File) || !f.size) return { error: "Chọn tệp Excel (.xlsx)." };
  const ExcelJS = (await import("exceljs")).default;
  const { cellText } = await import("@/lib/excel");
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(Buffer.from(await f.arrayBuffer()) as never);
  } catch {
    return { error: "Không đọc được tệp. Hãy dùng tệp .xlsx theo mẫu." };
  }
  const ws = wb.worksheets[0];
  const sql = await db();
  const units = (await sql`SELECT id, ten FROM don_vi`) as unknown as { id: number; ten: string }[];
  const leaders = (await sql`SELECT id, ho_ten FROM nguoi_dung WHERE vai_tro = 'lanh_dao'`) as unknown as { id: number; ho_ten: string }[];
  const { getCatalog } = await import("@/lib/settings");
  const lvList = await getCatalog("linh_vuc");
  const rows: Record<string, unknown>[] = [];
  const errs: string[] = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const c = (i: number) => cellText(row.getCell(i).value);
    const ten = c(2);
    if (!ten) return;
    const loaiT = noAccent(c(6));
    const loai = /ho so/.test(loaiT) ? "ho_so" : loaiT.startsWith("ty") ? "ty_le" : loaiT.startsWith("dat") ? "dat_khong" : "cong_don";
    const kh = Number(c(8).replace(",", "."));
    const dauS = c(9).replace(",", ".");
    const hanS = c(13);
    let han = "";
    const m = hanS.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
    if (m) han = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    else if (/^\d{4}-\d{2}-\d{2}$/.test(hanS)) han = hanS;
    else han = `${new Date().getFullYear()}-12-31`;
    const dvT = noAccent(c(10));
    const dv = units.find((u) => noAccent(u.ten) === dvT) || units.find((u) => dvT && (noAccent(u.ten).includes(dvT) || dvT.includes(noAccent(u.ten))));
    const ldT = noAccent(c(11));
    const ld = ldT ? leaders.find((l) => noAccent(l.ho_ten) === ldT || noAccent(l.ho_ten).endsWith(ldT)) : undefined;
    if (Number.isNaN(kh) && loai !== "dat_khong") errs.push(`Dòng ${n}: kế hoạch năm không phải số.`);
    if (!dv) errs.push(`Dòng ${n}: không tìm thấy đơn vị “${c(10)}”.`);
    const kyT = noAccent(c(12));
    const lvT = noAccent(c(14));
    const lv = lvT ? lvList.find((x) => noAccent(x) === lvT) || lvList.find((x) => noAccent(x).includes(lvT) || lvT.includes(noAccent(x))) : undefined;
    if (lvT && !lv) errs.push(`Dòng ${n}: lĩnh vực “${c(14)}” không có trong danh mục.`);
    rows.push({
      ten,
      nhom: c(3) || "Kinh tế",
      nguon: c(4) || "Nghị quyết HĐND xã",
      don_vi_tinh: c(5) || "%",
      loai,
      chieu_tot: noAccent(c(7)).startsWith("thap") ? "thap" : "cao",
      ke_hoach_nam: loai === "dat_khong" ? 1 : kh,
      gia_tri_dau_nam: dauS ? Number(dauS) : null,
      nam: Number(han.slice(0, 4)),
      han,
      id_don_vi_phu_trach: dv?.id ?? null,
      id_lanh_dao: ld?.id ?? null,
      ky_cap_nhat: kyT.startsWith("quy") ? "quy" : kyT.startsWith("tuan") ? "tuan" : "thang",
      linh_vuc: lv ?? null,
      thu_tu: n,
    });
  });
  if (!rows.length) return { error: "Không có dòng chỉ tiêu nào trong tệp." };
  if (errs.length) return { error: `Chưa nhập. Sửa các lỗi sau rồi tải lại:\n${errs.slice(0, 15).join("\n")}` };
  await sql.begin(async (tx) => {
    for (const r of rows) {
      const h = await tx`SELECT id FROM nguoi_dung WHERE id_don_vi = ${r.id_don_vi_phu_trach as number} AND vai_tro IN ('truong_don_vi','truong_thon') AND trang_thai = 'hoat_dong' LIMIT 1`;
      const [x] = await tx`INSERT INTO chi_tieu ${tx({ ...r, id_phu_trach: h[0]?.id ?? null } as never)} RETURNING id`;
      await notify(tx, [h[0]?.id], "giao_chi_tieu", `Được giao phụ trách chỉ tiêu: ${r.ten}`, null, "chi_tieu", x.id, `giaoct:${x.id}`, user.id);
    }
    await writeLog(tx, user.id, "nhap_chi_tieu_excel", "chi_tieu", null, null, { so_dong: rows.length, tep: f.name });
  });
  after(() => flushSms().catch(() => {}));
  return { ok: true, message: `Đã nhập ${rows.length} chỉ tiêu.`, redirect: `/chi-tieu?nam=${rows[0].nam}` };
}

/** Quản trị dữ liệu: xóa hẳn chỉ tiêu hoặc một dòng số liệu (vào thùng rác) */
export async function adminKpiAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getUser();
  if (!user || !user.quyen.includes("qt.du_lieu")) return { error: "Không có quyền." };
  const { trashKpi, trashSimple } = await import("@/lib/trash");
  const id = Number(str(fd, "id"));
  const sql = await db();
  if (str(fd, "op") === "xoa_so_lieu") {
    const r = (await sql`SELECT s.ky, s.gia_tri, c.ten, c.id AS id_ct FROM chi_tieu_so_lieu s JOIN chi_tieu c ON c.id = s.id_chi_tieu WHERE s.id = ${id}`)[0];
    if (!r) return { error: "Không tìm thấy số liệu." };
    await sql.begin(async (tx) => {
      await trashSimple(tx, "chi_tieu_so_lieu", "so_lieu", id, user.id, `Số liệu ${periodLabel(r.ky)} (${r.gia_tri}) — ${r.ten}`, null);
      // nếu xóa dòng đang hiệu lực thì dòng gần nhất cùng kỳ trở lại hiệu lực
      await tx`UPDATE chi_tieu_so_lieu SET hieu_luc = TRUE WHERE id = (SELECT id FROM chi_tieu_so_lieu WHERE id_chi_tieu = ${r.id_ct} AND ky = ${r.ky} ORDER BY thoi_gian DESC LIMIT 1)
               AND NOT EXISTS (SELECT 1 FROM chi_tieu_so_lieu WHERE id_chi_tieu = ${r.id_ct} AND ky = ${r.ky} AND hieu_luc)`;
    });
    return { ok: true, message: "Đã xóa số liệu." };
  }
  const k = (await sql`SELECT id_cha FROM chi_tieu WHERE id = ${id}`)[0];
  if (!k) return { error: "Không tìm thấy chỉ tiêu." };
  await sql.begin((tx) => trashKpi(tx, id, user.id, str(fd, "ly_do") || null));
  return { redirect: k.id_cha ? `/chi-tieu/${k.id_cha}` : "/chi-tieu" };
}
