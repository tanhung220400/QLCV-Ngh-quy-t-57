import type { User } from "./auth";
import { db } from "./db";
import { taskScope, kpiScope } from "./perm";
import { fromVN, vnDate, addDays, fmtDate, fmtDue } from "./time";
import { TRANG_THAI } from "./const";
import { loadKpis, fmtNum } from "./kpi";
import { getSettings } from "./settings";

export function weekRange(tu?: string, den?: string) {
  const today = vnDate();
  const wd = (new Date(today + "T00:00:00Z").getUTCDay() + 6) % 7;
  // mặc định: tuần trước (thứ Hai đến Chủ nhật) để dùng cho giao ban đầu tuần
  const monday = addDays(today, -wd - 7);
  const from = /^\d{4}-\d{2}-\d{2}$/.test(tu || "") ? tu! : monday;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(den || "") ? den! : addDays(monday, 6);
  return { tu: from, den: to };
}

export async function weeklyData(user: User, tu: string, den: string) {
  const sql = await db();
  const scope = (await taskScope(sql, user)).q;
  const from = fromVN(tu, "00:00");
  const to = fromVN(den, "23:59");
  const nextTo = fromVN(addDays(den, 7), "23:59");
  const base = sql`FROM cong_viec cv JOIN nguoi_dung ct ON ct.id = cv.id_chu_tri LEFT JOIN don_vi dv ON dv.id = cv.id_don_vi_chu_tri WHERE (${scope}) AND cv.trang_thai <> 'huy'`;
  const cols = sql`cv.id, cv.ten, cv.han, cv.han_co_gio, cv.trang_thai, cv.ngay_hoan_thanh, cv.phan_tram, ct.ho_ten AS chu_tri, COALESCE(dv.ten, '') AS don_vi`;
  const giaoMoi = (await sql`SELECT count(*)::int AS n ${base} AND cv.tao_luc BETWEEN ${from} AND ${to}`)[0].n as number;
  const done = await sql`SELECT ${cols} ${base} AND cv.trang_thai = 'hoan_thanh' AND cv.ngay_hoan_thanh BETWEEN ${from} AND ${to} ORDER BY dv.thu_tu NULLS LAST, cv.ngay_hoan_thanh`;
  const overdue = await sql`SELECT ${cols} ${base} AND cv.trang_thai IN ('moi_giao','da_nhan','dang_thuc_hien') AND cv.han < ${to} ORDER BY dv.thu_tu NULLS LAST, cv.han`;
  const dangLam = (await sql`SELECT count(*)::int AS n ${base} AND cv.trang_thai IN ('moi_giao','da_nhan','dang_thuc_hien','cho_duyet')`)[0].n as number;
  const upcoming = await sql`SELECT ${cols} ${base} AND cv.trang_thai IN ('moi_giao','da_nhan','dang_thuc_hien','cho_duyet') AND cv.han > ${to} AND cv.han <= ${nextTo} ORDER BY cv.han`;
  const onTime = done.filter((d) => new Date(d.ngay_hoan_thanh) <= new Date(d.han)).length;
  const daysLate = (h: Date) => Math.max(1, Math.ceil((to.getTime() - new Date(h).getTime()) / 86400000));
  return {
    tu,
    den,
    giaoMoi,
    dangLam,
    done: done.map((d) => ({ ...d, dung_han: new Date(d.ngay_hoan_thanh) <= new Date(d.han) })),
    onTime,
    overdue: overdue.map((d) => ({ ...d, so_ngay: daysLate(d.han) })),
    upcoming,
  } as {
    tu: string; den: string; giaoMoi: number; dangLam: number; onTime: number;
    done: { id: number; ten: string; han: Date; han_co_gio: boolean; chu_tri: string; don_vi: string; ngay_hoan_thanh: Date; dung_han: boolean }[];
    overdue: { id: number; ten: string; han: Date; han_co_gio: boolean; chu_tri: string; don_vi: string; so_ngay: number; phan_tram: number }[];
    upcoming: { id: number; ten: string; han: Date; han_co_gio: boolean; chu_tri: string; don_vi: string; trang_thai: string }[];
  };
}

export async function meetingList(user: User) {
  const sql = await db();
  const scope = (await taskScope(sql, user)).q;
  return (await sql`SELECT cv.cuoc_hop, count(*)::int AS n, min(cv.tao_luc) AS ngay,
      count(*) FILTER (WHERE cv.trang_thai = 'hoan_thanh')::int AS xong
    FROM cong_viec cv WHERE (${scope}) AND cv.cuoc_hop IS NOT NULL AND cv.cuoc_hop <> '' AND cv.trang_thai <> 'huy'
    GROUP BY cv.cuoc_hop ORDER BY min(cv.tao_luc) DESC LIMIT 100`) as unknown as { cuoc_hop: string; n: number; ngay: Date; xong: number }[];
}

export async function meetingData(user: User, ten: string) {
  const sql = await db();
  const scope = (await taskScope(sql, user)).q;
  return (await sql`SELECT cv.id, cv.ten, cv.han, cv.han_co_gio, cv.trang_thai, cv.ngay_hoan_thanh, cv.phan_tram, cv.so_hieu_vb, cv.ket_qua,
      ct.ho_ten AS chu_tri, COALESCE(dv.ten, '') AS don_vi, ng.ho_ten AS nguoi_giao
    FROM cong_viec cv JOIN nguoi_dung ct ON ct.id = cv.id_chu_tri JOIN nguoi_dung ng ON ng.id = cv.id_nguoi_giao LEFT JOIN don_vi dv ON dv.id = cv.id_don_vi_chu_tri
    WHERE (${scope}) AND cv.cuoc_hop = ${ten} AND cv.trang_thai <> 'huy' ORDER BY cv.id`) as unknown as {
    id: number; ten: string; han: Date; han_co_gio: boolean; trang_thai: string; ngay_hoan_thanh: Date | null; phan_tram: number; so_hieu_vb: string | null; ket_qua: string | null; chu_tri: string; don_vi: string; nguoi_giao: string;
  }[];
}

export function taskStatusText(t: { trang_thai: string; han: Date; ngay_hoan_thanh: Date | null; phan_tram?: number }) {
  if (t.trang_thai === "hoan_thanh") return `Hoàn thành ${fmtDate(t.ngay_hoan_thanh)} (${new Date(t.ngay_hoan_thanh!) <= new Date(t.han) ? "đúng hạn" : "trễ hạn"})`;
  const qua = new Date(t.han) < new Date() && ["moi_giao", "da_nhan", "dang_thuc_hien"].includes(t.trang_thai);
  return `${TRANG_THAI[t.trang_thai]}${t.phan_tram ? ` ${t.phan_tram}%` : ""}${qua ? " — QUÁ HẠN" : ""}`;
}

export async function kpiReportData(user: User, nam: number) {
  const sql = await db();
  const cfg = await getSettings();
  const kpis = await loadKpis(sql, (await kpiScope(sql, user)).q, cfg.nguong_nguy_co, nam);
  return kpis.filter((k) => !k.id_cha);
}

export const kpiRowText = (k: Awaited<ReturnType<typeof kpiReportData>>[number]) => ({
  ten: k.ten,
  dvt: k.don_vi_tinh,
  kh: fmtNum(k.ke_hoach_nam),
  th: k.loai === "dat_khong" ? (k.thuc_hien != null && k.thuc_hien >= 1 ? "Đạt" : "Chưa đạt") : fmtNum(k.thuc_hien),
  pct: k.pct == null ? "–" : `${fmtNum(k.pct, 1)}%`,
  le_ra: `${fmtNum(k.pct_le_ra, 0)}%`,
  danh_gia: k.mau === "xanh" ? (k.pct != null && k.pct >= 100 ? "Đạt" : "Đúng tiến độ") : k.mau === "vang" ? "Chậm" : k.mau === "do" ? "Nguy cơ không đạt" : "Chưa có số liệu",
  phu_trach: k.ten_don_vi || k.ten_phu_trach || "",
});

export { fmtDue, fmtDate };
