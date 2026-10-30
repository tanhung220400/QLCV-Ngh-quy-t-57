import type postgres from "postgres";
import { workingDaysUntil, vnDate, fromVN, vnTime, addDays } from "./time";
import { DANG_MO } from "./const";

export type Mau = "xanh" | "vang" | "do" | "xam";

export type TaskListItem = {
  id: number;
  ten: string;
  trang_thai: string;
  uu_tien: string;
  han: Date;
  han_co_gio: boolean;
  phan_tram: number;
  linh_vuc: string;
  nguon_giao: string;
  san_pham: string;
  id_cha: number | null;
  ngay_hoan_thanh: Date | null;
  ten_chu_tri: string;
  ten_don_vi: string | null;
  ten_nguoi_giao: string;
  ten_thuc_hien: string | null;
  so_viec_con: number;
  cho_gia_han: boolean;
};

/** Màu cảnh báo hạn theo mục 4.2 */
export function dueColor(
  t: { trang_thai: string; han: Date | string },
  holidays: Set<string>,
  nguongVang: number,
): { mau: Mau; nhan: string; quaHan: boolean; con: number } {
  if (t.trang_thai === "hoan_thanh" || t.trang_thai === "huy") {
    return { mau: "xam", nhan: t.trang_thai === "huy" ? "Đã hủy" : "Hoàn thành", quaHan: false, con: 0 };
  }
  const now = new Date();
  const con = workingDaysUntil(t.han, holidays, now);
  const qua = new Date(t.han).getTime() < now.getTime();
  if (qua) {
    const n = Math.max(1, -con);
    return { mau: "do", nhan: vnDate(t.han) === vnDate(now) ? "Quá hạn hôm nay" : `Quá hạn ${n} ngày`, quaHan: true, con };
  }
  if (con <= nguongVang) return { mau: "vang", nhan: con === 0 ? "Hết hạn hôm nay" : `Còn ${con} ngày`, quaHan: false, con };
  return { mau: "xanh", nhan: `Còn ${con} ngày`, quaHan: false, con };
}

export function onTime(t: { han: Date | string; ngay_hoan_thanh: Date | string | null }) {
  if (!t.ngay_hoan_thanh) return null;
  return new Date(t.ngay_hoan_thanh).getTime() <= new Date(t.han).getTime();
}

export const MAU_CLASS: Record<Mau, string> = {
  xanh: "bg-emerald-100 text-emerald-800 border-emerald-300",
  vang: "bg-amber-100 text-amber-900 border-amber-300",
  do: "bg-red-100 text-red-800 border-red-300",
  xam: "bg-slate-100 text-slate-600 border-slate-300",
};
export const MAU_VIEN: Record<Mau, string> = {
  xanh: "border-l-emerald-500",
  vang: "border-l-amber-500",
  do: "border-l-red-600",
  xam: "border-l-slate-400",
};

type Q = postgres.Sql | postgres.TransactionSql;

/** Tính lại % tiến độ từ việc con / checklist (nếu không nhập tay) */
export async function recomputePercent(sql: Q, id: number) {
  const t = (await sql`SELECT phan_tram_tay, trang_thai FROM cong_viec WHERE id = ${id}`)[0];
  if (!t) return;
  if (t.trang_thai === "hoan_thanh") {
    await sql`UPDATE cong_viec SET phan_tram = 100 WHERE id = ${id}`;
    return;
  }
  const sub = (await sql`SELECT count(*)::int AS n, count(*) FILTER (WHERE trang_thai = 'hoan_thanh')::int AS xong
                         FROM cong_viec WHERE id_cha = ${id} AND trang_thai <> 'huy'`)[0];
  const ck = (await sql`SELECT count(*)::int AS n, count(*) FILTER (WHERE da_xong)::int AS xong FROM checklist WHERE id_cong_viec = ${id}`)[0];
  const n = sub.n + ck.n;
  if (n > 0) {
    const p = Math.round(((sub.xong + ck.xong) * 100) / n);
    await sql`UPDATE cong_viec SET phan_tram = ${p}, phan_tram_tay = FALSE WHERE id = ${id}`;
  }
  const parent = (await sql`SELECT id_cha FROM cong_viec WHERE id = ${id}`)[0];
  if (parent?.id_cha) await recomputePercent(sql, parent.id_cha);
}

/** Hạn của kỳ sau cho việc định kỳ */
export function nextDue(han: Date, dinhKy: string): Date {
  const d = vnDate(han);
  const time = vnTime(han);
  let next: string;
  if (dinhKy === "tuan") next = addDays(d, 7);
  else {
    const months = dinhKy === "quy" ? 3 : 1;
    const y = Number(d.slice(0, 4));
    const m = Number(d.slice(5, 7)) - 1 + months;
    const day = Number(d.slice(8, 10));
    const ny = y + Math.floor(m / 12);
    const nm = (m % 12) + 1;
    const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
    next = `${ny}-${String(nm).padStart(2, "0")}-${String(Math.min(day, last)).padStart(2, "0")}`;
  }
  return fromVN(next, time);
}

export const OPEN_STATES = DANG_MO;

export const TASK_LIST_SELECT = `
  cv.id, cv.ten, cv.trang_thai, cv.uu_tien, cv.han, cv.han_co_gio, cv.phan_tram, cv.linh_vuc, cv.nguon_giao, cv.san_pham,
  cv.id_cha, cv.ngay_hoan_thanh,
  ct.ho_ten AS ten_chu_tri, dv.ten AS ten_don_vi, ng.ho_ten AS ten_nguoi_giao, th.ho_ten AS ten_thuc_hien,
  (SELECT count(*)::int FROM cong_viec c2 WHERE c2.id_cha = cv.id AND c2.trang_thai <> 'huy') AS so_viec_con,
  EXISTS (SELECT 1 FROM gia_han g WHERE g.id_cong_viec = cv.id AND g.trang_thai_duyet = 'cho_duyet') AS cho_gia_han
`;
export const TASK_LIST_FROM = `
  cong_viec cv
  JOIN nguoi_dung ct ON ct.id = cv.id_chu_tri
  JOIN nguoi_dung ng ON ng.id = cv.id_nguoi_giao
  LEFT JOIN nguoi_dung th ON th.id = cv.id_nguoi_thuc_hien
  LEFT JOIN don_vi dv ON dv.id = cv.id_don_vi_chu_tri
`;
