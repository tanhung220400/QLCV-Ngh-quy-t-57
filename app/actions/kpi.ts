"use server";
import { after } from "next/server";
import { db } from "@/lib/db";
import { flushSms } from "@/lib/sms";
import { getUser, type User } from "@/lib/auth";
import { canManageKpi, canSeeKpi } from "@/lib/perm";
import { kpiRights } from "@/lib/kpiRights";
import { notify, writeLog } from "@/lib/log";
import { periodLabel, currentPeriod } from "@/lib/kpi";
import { tinhQuyen } from "@/lib/quyen";
import { truongDonVi as dauDonVi } from "@/lib/giaoViec";
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
  // chỉ tiêu không giao trước: tỷ lệ mặc định 100% số phát sinh; cộng dồn để 0 (tính 100% trên tổng số phát sinh)
  if (!str(fd, "ke_hoach_nam") && (v.loai === "ty_le" || v.loai === "ho_so")) v.ke_hoach_nam = 100;
  if (v.loai === "ty_le") v.don_vi_tinh = "%";
  v.ky_cap_nhat = "thang"; // số liệu nhập theo tháng phát sinh
  const miss = [!v.ten && "tên", !v.nguon && "nguồn", !v.nhom && "nhóm", !v.don_vi_tinh && "đơn vị tính", Number.isNaN(kh) && "kế hoạch năm", !v.nam && "năm", !/^\d{4}-\d{2}-\d{2}$/.test(v.han) && "ngày hết hạn", !v.id_phu_trach && !v.id_don_vi_phu_trach && nhieu.length < 2 && "người hoặc đơn vị phụ trách"].filter(Boolean);
  if (miss.length) return { error: `Còn thiếu: ${miss.join(", ")}.` };
  if (v.loai === "dat_khong") v.ke_hoach_nam = 1;
  if (v.id_phu_trach && v.id_don_vi_phu_trach) {
    const thuoc = await sql`SELECT 1 FROM nguoi_dung WHERE id = ${v.id_phu_trach as number} AND (id_don_vi = ${v.id_don_vi_phu_trach as number} OR id_don_vi_kiem_nhiem = ${v.id_don_vi_phu_trach as number})`;
    if (!thuoc.length) v.id_phu_trach = null;
  }
  if (!v.id_phu_trach && v.id_don_vi_phu_trach) {
    v.id_phu_trach = await dauDonVi(sql, v.id_don_vi_phu_trach as number);
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
      const pt = await dauDonVi(sql, dv);
      const h = pt ? [{ id: pt }] : [];
      const con = { ...v, ten: `${v.ten} — ${ten.get(dv) ?? ""}`, ke_hoach_nam: khCon, id_don_vi_phu_trach: dv, id_phu_trach: h[0]?.id ?? null, id_cha: newId, thu_tu: ++i };
      const [r] = await sql`INSERT INTO chi_tieu ${sql(con as never)} RETURNING id`;
      await writeLog(sql, user.id, "tao_chi_tieu", "chi_tieu", r.id, null, con);
      if (h[0]) await notify(sql, [h[0].id], "giao_chi_tieu", `Được giao phụ trách chỉ tiêu: ${con.ten}`, `Kế hoạch năm ${v.nam}: ${khCon} ${v.don_vi_tinh}`, "chi_tieu", r.id, `giaoct:${r.id}`, user.id);
    }
  }
  after(() => flushSms().catch(() => {}));
  return { redirect: `/chi-tieu/${idCha && !id ? idCha : newId}` };
}

type Q = Awaited<ReturnType<typeof db>>;

/** Trưởng (hoặc người đứng đầu) đơn vị để giao phụ trách phần chỉ tiêu */
const truongDonVi = (sql: Q, dv: number) => dauDonVi(sql, dv);

/**
 * Cập nhật đơn vị phụ trách của chỉ tiêu: thêm, bỏ, đổi đơn vị.
 *  - 1 đơn vị, chỉ tiêu chưa chia phần: đổi đơn vị (số liệu đã nhập giữ nguyên).
 *  - Nhiều đơn vị: mỗi đơn vị một phần; chỉ tiêu đang giao 1 đơn vị thì phần số liệu cũ chuyển sang phần của đơn vị đó.
 *  - Đơn vị bị bỏ: phần của đơn vị chuyển sang “đã hủy” (lịch sử, số liệu vẫn lưu, không tính vào toàn phường).
 */
export async function updateKpiUnitsAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getUser();
  if (!user) return { redirect: "/dang-nhap" };
  if (!canManageKpi(user)) return { error: "Bạn không có quyền cập nhật đơn vị phụ trách." };
  const id = Number(str(fd, "id"));
  const sql = await db();
  const k = (await sql`SELECT * FROM chi_tieu WHERE id = ${id} AND NOT huy`)[0];
  if (!k) return { error: "Không tìm thấy chỉ tiêu." };
  if (k.id_cha) return { error: "Đây là phần chỉ tiêu của một đơn vị. Cập nhật đơn vị phụ trách ở chỉ tiêu chung." };
  const chon = [...new Set(fd.getAll("don_vi_nhieu").map(Number).filter(Boolean))];
  if (!chon.length) return { error: "Chọn ít nhất một đơn vị phụ trách." };
  const kids = await sql`SELECT id, id_don_vi_phu_trach AS dv, ten FROM chi_tieu WHERE id_cha = ${id} AND NOT huy ORDER BY thu_tu, id`;
  const tenDv = new Map((await sql`SELECT id, ten FROM don_vi`).map((r) => [r.id as number, r.ten as string]));
  const them: string[] = [];
  const bo: string[] = [];
  const thongBao: { uid: number; ten: string; idCt: number }[] = [];
  await sql.begin(async (tx) => {
    // chỉ tiêu một đơn vị, chưa chia phần, chọn một đơn vị: đổi đơn vị
    if (!kids.length && chon.length === 1) {
      if (chon[0] === k.id_don_vi_phu_trach) return;
      const pt = await truongDonVi(tx as never, chon[0]);
      await tx`UPDATE chi_tieu SET id_don_vi_phu_trach = ${chon[0]}, id_phu_trach = ${pt} WHERE id = ${id}`;
      if (k.id_don_vi_phu_trach) bo.push(tenDv.get(k.id_don_vi_phu_trach) || "");
      them.push(tenDv.get(chon[0]) || "");
      if (pt) thongBao.push({ uid: pt, ten: k.ten, idCt: id });
      await writeLog(tx, user.id, "doi_don_vi_chi_tieu", "chi_tieu", id, { don_vi: k.id_don_vi_phu_trach }, { don_vi: chon[0] });
      return;
    }
    const n = chon.length;
    const khCon = k.loai === "cong_don" ? Math.round((Number(k.ke_hoach_nam) / n) * 100) / 100 : Number(k.ke_hoach_nam);
    let thuTu = kids.length;
    const coPhan = new Map<number, number>(kids.map((c) => [c.dv as number, c.id as number]));
    const taoPhan = async (dv: number) => {
      const pt = await truongDonVi(tx as never, dv);
      const { id: _id, tao_luc: _t, ...goc } = k;
      void _id;
      void _t;
      const con = { ...goc, ten: `${k.ten} — ${tenDv.get(dv) ?? ""}`, ke_hoach_nam: khCon, id_don_vi_phu_trach: dv, id_phu_trach: pt, id_cha: id, thu_tu: ++thuTu, huy: false };
      const [r] = await tx`INSERT INTO chi_tieu ${tx(con as never)} RETURNING id`;
      them.push(tenDv.get(dv) || "");
      if (pt) thongBao.push({ uid: pt, ten: con.ten, idCt: r.id });
      return r.id as number;
    };
    // chỉ tiêu đang giao 1 đơn vị (chưa chia phần): tạo phần cho đơn vị cũ và chuyển số liệu đã nhập sang phần đó
    if (!kids.length && k.id_don_vi_phu_trach) {
      const cu = k.id_don_vi_phu_trach as number;
      const nTb = thongBao.length;
      const pid = await taoPhan(cu);
      them.pop();
      thongBao.length = nTb; // đơn vị cũ không cần báo “được giao”
      await tx`UPDATE chi_tieu_so_lieu SET id_chi_tieu = ${pid} WHERE id_chi_tieu = ${id}`;
      await tx`UPDATE chi_tieu SET id_don_vi_phu_trach = NULL, id_phu_trach = NULL WHERE id = ${id}`;
      coPhan.set(cu, pid);
      if (!chon.includes(cu)) {
        await tx`UPDATE chi_tieu SET huy = TRUE WHERE id = ${pid}`;
        bo.push(tenDv.get(cu) || "");
      }
    }
    for (const dv of chon) if (!coPhan.has(dv)) await taoPhan(dv);
    for (const [dv, cid] of coPhan)
      if (!chon.includes(dv) && kids.some((c) => c.id === cid)) {
        await tx`UPDATE chi_tieu SET huy = TRUE WHERE id = ${cid}`;
        bo.push(tenDv.get(dv) || "");
      }
    // chỉ tiêu cộng dồn: chia đều lại kế hoạch cho các phần khi đổi số đơn vị
    if (k.loai === "cong_don" && (them.length || bo.length)) await tx`UPDATE chi_tieu SET ke_hoach_nam = ${khCon} WHERE id_cha = ${id} AND NOT huy`;
    await writeLog(tx, user.id, "cap_nhat_don_vi_chi_tieu", "chi_tieu", id, { don_vi: [...coPhan.keys()] }, { don_vi: chon, them, bo });
  });
  for (const t of thongBao)
    await notify(sql, [t.uid], "giao_chi_tieu", `Được giao phụ trách chỉ tiêu: ${t.ten}`, `Năm ${k.nam}`, "chi_tieu", t.idCt, `giaoct:${t.idCt}`, user.id);
  after(() => flushSms().catch(() => {}));
  if (!them.length && !bo.length) return { ok: true, message: "Không có thay đổi." };
  return {
    ok: true,
    message: [them.length && `Đã giao thêm: ${them.join(", ")}.`, bo.length && `Đã bỏ: ${bo.join(", ")} (số liệu cũ vẫn lưu trong lịch sử).`, k.loai === "cong_don" && "Kế hoạch năm đã chia đều lại cho các đơn vị, sửa từng phần nếu cần."].filter(Boolean).join(" "),
  };
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

/** Người nhận thông báo xác nhận số liệu: Giao việc cấp 2 của đơn vị phụ trách, Giao việc cấp 1 của đơn vị hoặc lãnh đạo phụ trách */
async function nguoiXacNhan(sql: Q, k: { id_don_vi_phu_trach: number | null; id_lanh_dao: number | null }): Promise<number[]> {
  const dv = k.id_don_vi_phu_trach ?? -1;
  const rows = await sql`SELECT id, vai_tro, quyen, id_don_vi, id_don_vi_kiem_nhiem FROM nguoi_dung WHERE trang_thai = 'hoat_dong'
                         AND (id_don_vi = ${dv} OR id_don_vi_kiem_nhiem = ${dv} OR id = ${k.id_lanh_dao ?? -1})`;
  const out = rows
    .filter((u) => {
      const q = tinhQuyen(u.vai_tro, u.quyen);
      return q.has("cv.giao_cap1") || (q.has("cv.giao_cap2") && u.id !== k.id_lanh_dao);
    })
    .map((u) => u.id as number);
  if (out.length) return out;
  const all = await sql`SELECT id, vai_tro, quyen FROM nguoi_dung WHERE trang_thai = 'hoat_dong' AND vai_tro = 'lanh_dao'`;
  return all.filter((u) => tinhQuyen(u.vai_tro, u.quyen).has("cv.giao_cap1")).map((u) => u.id as number);
}

export async function addDataAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getUser();
  if (!user) return { redirect: "/dang-nhap" };
  const id = Number(str(fd, "id"));
  const r = await kpiRole(user, id);
  if (!r) return { error: "Không tìm thấy chỉ tiêu." };
  if (!r.enter) return { error: "Bạn không phụ trách chỉ tiêu này." };
  const ky = str(fd, "ky");
  if (!/^\d{4}-\d{2}$/.test(ky)) return { error: "Chọn tháng phát sinh số liệu." };
  if (Number(ky.slice(0, 4)) !== Number(r.k.nam)) return { error: `Chỉ nhập số liệu các tháng của năm ${r.k.nam}.` };
  if (ky > currentPeriod("thang")) return { error: "Chưa đến tháng này. Chỉ nhập số liệu đã phát sinh (đến tháng hiện tại)." };
  let hs: { tt: number; mp: number; tr: number } | null = null;
  let dem: { ps: number; dat: number } | null = null;
  let v: number;
  if (r.k.loai === "ho_so") {
    const n = (k: string) => (str(fd, k) === "" ? 0 : num(str(fd, k)));
    hs = { tt: n("so_toan_trinh"), mp: n("so_mot_phan"), tr: n("so_truc_tiep") };
    if ([hs.tt, hs.mp, hs.tr].some((x) => Number.isNaN(x) || x < 0 || !Number.isInteger(x))) return { error: "Số hồ sơ phải là số nguyên không âm." };
    const tong = hs.tt + hs.mp + hs.tr;
    if (!tong) return { error: "Nhập số hồ sơ phát sinh trong kỳ (toàn trình, một phần, trực tiếp)." };
    v = Math.round((hs.tt / tong) * 10000) / 100;
  } else if (r.k.loai === "ty_le") {
    dem = { ps: num(str(fd, "so_phat_sinh")), dat: num(str(fd, "so_dat")) };
    if ([dem.ps, dem.dat].some((x) => Number.isNaN(x) || x < 0) || str(fd, "so_phat_sinh") === "" || str(fd, "so_dat") === "") return { error: "Nhập tổng số phát sinh trong tháng và số đạt (số không âm)." };
    if (!dem.ps) return { error: "Tổng số phát sinh trong tháng phải lớn hơn 0." };
    if (dem.dat > dem.ps) return { error: "Số đạt không được lớn hơn tổng số phát sinh." };
    v = Math.round((dem.dat / dem.ps) * 10000) / 100;
  } else v = r.k.loai === "dat_khong" ? (str(fd, "gia_tri") === "1" ? 1 : 0) : num(str(fd, "gia_tri"));
  if (Number.isNaN(v)) return { error: "Nhập số thực hiện hợp lệ." };
  const sql = await db();
  // số liệu luôn phải được người có quyền Giao việc cấp 1/cấp 2 khác xác nhận (không tự xác nhận)
  const autoConfirm = false;
  let newId = 0;
  await sql.begin(async (tx) => {
    const old = await tx`UPDATE chi_tieu_so_lieu SET hieu_luc = FALSE WHERE id_chi_tieu = ${id} AND ky = ${ky} AND hieu_luc RETURNING gia_tri, xac_nhan`;
    const [row] = await tx`INSERT INTO chi_tieu_so_lieu (id_chi_tieu, ky, gia_tri, ghi_chu, id_nguoi_nhap, xac_nhan, id_nguoi_xac_nhan, so_toan_trinh, so_mot_phan, so_truc_tiep, so_phat_sinh, so_dat)
      VALUES (${id}, ${ky}, ${v}, ${str(fd, "ghi_chu") || null}, ${user.id}, ${autoConfirm}, ${autoConfirm ? user.id : null}, ${hs?.tt ?? null}, ${hs?.mp ?? null}, ${hs?.tr ?? null}, ${dem?.ps ?? null}, ${dem?.dat ?? null}) RETURNING id`;
    newId = row.id;
    await writeLog(tx, user.id, old.length ? "sua_so_lieu" : "nhap_so_lieu", "chi_tieu", id, old[0] ?? null, { ky, gia_tri: v, id_so_lieu: row.id, ...(hs ? { ho_so: hs } : {}), ...(dem ? { phat_sinh: dem.ps, dat: dem.dat } : {}) });
    if (!autoConfirm) {
      const nhan = await nguoiXacNhan(tx as never, r.k as never);
      await notify(tx, nhan.filter((x) => x !== user.id), "xac_nhan_so_lieu", `Chờ xác nhận số liệu: ${r.k.ten}`, `${periodLabel(ky)}: ${v} ${r.k.don_vi_tinh}`, "chi_tieu", id, undefined, user.id);
    }
  });
  const ve = Number(str(fd, "ve")) || id;
  return { ok: true, message: "Đã lưu số liệu, chờ người có quyền Giao việc cấp 1 hoặc cấp 2 xác nhận.", redirect: `/chi-tieu/${ve}?so_lieu=${newId}` };
}

export async function confirmDataAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getUser();
  if (!user) return { redirect: "/dang-nhap" };
  const sid = Number(str(fd, "id_so_lieu"));
  const sql = await db();
  const s = (await sql`SELECT * FROM chi_tieu_so_lieu WHERE id = ${sid} AND hieu_luc`)[0];
  if (!s) return { error: "Số liệu không còn hiệu lực." };
  const r = await kpiRole(user, s.id_chi_tieu);
  if (!r?.confirm) return { error: "Chỉ người có quyền Giao việc cấp 1 (trong phạm vi) hoặc Giao việc cấp 2 (của đơn vị) được xác nhận số liệu." };
  if (s.id_nguoi_nhap === user.id && !user.quyen.includes("qt.du_lieu")) return { error: "Không tự xác nhận số liệu do chính mình nhập." };
  if (s.xac_nhan) return { error: "Số liệu đã được xác nhận." };
  if (str(fd, "ket_luan") === "tra_lai" && !str(fd, "y_kien")) return { error: "Nêu lý do trả lại số liệu." };
  const ok = str(fd, "ket_luan") !== "tra_lai";
  if (ok) await sql`UPDATE chi_tieu_so_lieu SET xac_nhan = TRUE, id_nguoi_xac_nhan = ${user.id}, xac_nhan_luc = now() WHERE id = ${sid}`;
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
      ky_cap_nhat: "thang",
      linh_vuc: lv ?? null,
      thu_tu: n,
    });
  });
  if (!rows.length) return { error: "Không có dòng chỉ tiêu nào trong tệp." };
  if (errs.length) return { error: `Chưa nhập. Sửa các lỗi sau rồi tải lại:\n${errs.slice(0, 15).join("\n")}` };
  await sql.begin(async (tx) => {
    for (const r of rows) {
      const pt = await dauDonVi(tx, r.id_don_vi_phu_trach as number);
      const h = pt ? [{ id: pt }] : [];
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
