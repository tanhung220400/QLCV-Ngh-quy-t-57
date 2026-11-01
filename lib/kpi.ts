import type postgres from "postgres";
import { vnDate } from "./time";

export type KpiRow = {
  id: number;
  ten: string;
  nguon: string;
  nhom: string;
  don_vi_tinh: string;
  loai: string;
  chieu_tot: string;
  ke_hoach_nam: number;
  gia_tri_dau_nam: number | null;
  nam: number;
  han: Date | string;
  id_phu_trach: number | null;
  id_don_vi_phu_trach: number | null;
  id_lanh_dao: number | null;
  ky_cap_nhat: string;
  ngay_chot: number;
  id_cha: number | null;
  linh_vuc?: string | null;
  ten_phu_trach?: string | null;
  ten_don_vi?: string | null;
  ten_lanh_dao?: string | null;
};

export type KpiCalc = {
  thuc_hien: number | null;
  pct: number | null; // % hoàn thành so với kế hoạch năm
  pct_le_ra: number; // % lẽ ra phải đạt đến kỳ này
  chenh: number | null; // pct - pct_le_ra
  mau: "xanh" | "vang" | "do" | "xam";
  nguy_co: boolean;
  ky_moi_nhat: string | null;
  cho_xac_nhan: number;
  sap_het_han_chua_dat: boolean;
  /** Chỉ tiêu tỷ lệ hồ sơ: số hồ sơ toàn trình và tổng số hồ sơ (cộng các kỳ đã xác nhận) */
  ho_so?: { toan_trinh: number; mot_phan: number; truc_tiep: number; tong: number };
  /** Số đơn vị đã có số liệu / số đơn vị phụ trách (chỉ tiêu giao nhiều đơn vị) */
  don_vi_co_so_lieu?: number;
  /** Chỉ tiêu tỷ lệ nhập theo số phát sinh: tổng số đạt / tổng số phát sinh (cộng các tháng đã xác nhận) */
  dem?: { dat: number; phat_sinh: number };
};

export type SoLieu = { id_chi_tieu: number; ky: string; gia_tri: number; xac_nhan: boolean; so_toan_trinh?: number | null; so_mot_phan?: number | null; so_truc_tiep?: number | null; so_phat_sinh?: number | null; so_dat?: number | null };

/** Cộng số hồ sơ các dòng số liệu */
export function sumHoSo(rows: Pick<SoLieu, "so_toan_trinh" | "so_mot_phan" | "so_truc_tiep">[]) {
  const t = { toan_trinh: 0, mot_phan: 0, truc_tiep: 0, tong: 0 };
  for (const r of rows) {
    t.toan_trinh += Number(r.so_toan_trinh || 0);
    t.mot_phan += Number(r.so_mot_phan || 0);
    t.truc_tiep += Number(r.so_truc_tiep || 0);
  }
  t.tong = t.toan_trinh + t.mot_phan + t.truc_tiep;
  return t;
}
export type KeHoachKy = { id_chi_tieu: number; ky: string; gia_tri: number };

/** Số tháng đã qua tính đến hạn chốt số liệu gần nhất */
export function monthsPassed(nam: number, ngayChot: number, now = new Date()): number {
  const d = vnDate(now);
  const y = Number(d.slice(0, 4));
  const m = Number(d.slice(5, 7));
  const day = Number(d.slice(8, 10));
  if (y > nam) return 12;
  if (y < nam) return 0;
  return Math.min(12, m - 1 + (day >= ngayChot ? 1 : 0));
}

function periodEndMonth(ky: string): number {
  // '2026-03' -> 3 ; '2026-Q2' -> 6 ; '2026-03-09' (tuần) -> 3
  if (/Q\d$/.test(ky)) return Number(ky.slice(-1)) * 3;
  return Number(ky.slice(5, 7));
}

/** % hoàn thành theo mục 5.3 */
export function pctOf(k: Pick<KpiRow, "loai" | "chieu_tot" | "ke_hoach_nam" | "gia_tri_dau_nam">, th: number | null): number | null {
  if (th == null) return null;
  if (k.loai === "dat_khong") return th >= 1 ? 100 : 0;
  const kh = Number(k.ke_hoach_nam);
  if (k.chieu_tot === "thap") {
    const dau = k.gia_tri_dau_nam;
    if (dau != null && Number(dau) !== kh) return ((Number(dau) - th) / (Number(dau) - kh)) * 100; // theo mức giảm so với đầu năm
    if (th <= 0) return 100;
    return (kh / th) * 100;
  }
  if (kh === 0) return th >= 0 ? 100 : 0;
  return (th / kh) * 100;
}

export function calcKpi(
  k: KpiRow,
  data: SoLieu[],
  plans: KeHoachKy[],
  nguong: number,
  children: KpiCalc[] = [],
  now = new Date(),
): KpiCalc {
  const mine = data.filter((d) => d.id_chi_tieu === k.id);
  const confirmed = mine.filter((d) => d.xac_nhan).sort((a, b) => (a.ky < b.ky ? -1 : 1));
  const pending = mine.filter((d) => !d.xac_nhan).length + children.reduce((s, c) => s + c.cho_xac_nhan, 0);
  let th: number | null = null;
  let hoSo: KpiCalc["ho_so"];
  let dem: KpiCalc["dem"];
  const kidVals = children.filter((c) => c.thuc_hien != null);
  if (k.loai === "ho_so") {
    // tỷ lệ hồ sơ toàn trình = tổng hồ sơ toàn trình ÷ tổng hồ sơ tiếp nhận (của đơn vị, hoặc của toàn phường khi giao nhiều đơn vị)
    const own = sumHoSo(confirmed);
    hoSo = { ...own };
    for (const c of children) if (c.ho_so) for (const f of ["toan_trinh", "mot_phan", "truc_tiep", "tong"] as const) hoSo[f] += c.ho_so[f];
    th = hoSo.tong > 0 ? (hoSo.toan_trinh / hoSo.tong) * 100 : null;
  } else if (k.loai === "ty_le" && (confirmed.some((d) => d.so_phat_sinh != null) || children.some((c) => c.dem))) {
    // tỷ lệ = tổng số đạt ÷ tổng số phát sinh của các tháng (đơn vị, hoặc toàn phường khi giao nhiều đơn vị)
    dem = { dat: 0, phat_sinh: 0 };
    for (const d of confirmed) if (d.so_phat_sinh != null) { dem.dat += Number(d.so_dat || 0); dem.phat_sinh += Number(d.so_phat_sinh); }
    for (const c of children) if (c.dem) { dem.dat += c.dem.dat; dem.phat_sinh += c.dem.phat_sinh; }
    th = dem.phat_sinh > 0 ? (dem.dat / dem.phat_sinh) * 100 : null;
  } else if (confirmed.length) {
    th = k.loai === "cong_don" ? confirmed.reduce((s, d) => s + Number(d.gia_tri), 0) : Number(confirmed[confirmed.length - 1].gia_tri);
  } else if (kidVals.length) {
    const v = kidVals.map((c) => c.thuc_hien as number);
    if (k.loai === "cong_don") th = v.reduce((s, x) => s + x, 0);
    else if (k.loai === "ty_le") th = v.reduce((s, x) => s + x, 0) / v.length; // trung bình các đơn vị
    else if (k.loai === "dat_khong") th = v.length === children.length && v.every((x) => x >= 1) ? 1 : 0;
  }
  const pct = pctOf(k, th);
  const mp = monthsPassed(k.nam, k.ngay_chot, now);
  const kh = Number(k.ke_hoach_nam);
  const myPlans = plans.filter((p) => p.id_chi_tieu === k.id);
  let leRa: number;
  if (k.loai === "dat_khong") {
    leRa = 0;
  } else if (myPlans.length && kh !== 0 && k.chieu_tot !== "thap") {
    const due = myPlans.filter((p) => periodEndMonth(p.ky) <= mp);
    if (k.loai === "cong_don") leRa = (due.reduce((s, p) => s + Number(p.gia_tri), 0) / kh) * 100;
    else leRa = due.length ? (Number(due.sort((a, b) => (a.ky < b.ky ? -1 : 1))[due.length - 1].gia_tri) / kh) * 100 : 0;
  } else {
    leRa = (mp / 12) * 100;
  }
  const hanStr = typeof k.han === "string" ? k.han.slice(0, 10) : vnDate(k.han);
  const daysLeft = (new Date(hanStr + "T23:59:59+07:00").getTime() - now.getTime()) / 86400000;
  const sapHet = daysLeft <= 30 && (pct == null || pct < 100);
  const chenh = pct == null ? null : pct - leRa;
  let mau: KpiCalc["mau"] = "xam";
  if (pct != null) {
    if (pct >= 100 || (chenh != null && chenh >= 0)) mau = "xanh";
    else if (chenh != null && chenh >= -nguong) mau = "vang";
    else mau = "do";
  } else if (mp > 0 && k.loai !== "dat_khong") {
    mau = "do"; // đã đến kỳ mà chưa có số liệu
  }
  if (k.loai === "dat_khong" && pct !== 100 && sapHet) mau = "do";
  return {
    thuc_hien: th,
    pct,
    pct_le_ra: Math.min(100, leRa),
    chenh,
    mau,
    nguy_co: mau === "do",
    ky_moi_nhat: confirmed.length ? confirmed[confirmed.length - 1].ky : null,
    cho_xac_nhan: pending,
    sap_het_han_chua_dat: sapHet,
    ho_so: hoSo,
    don_vi_co_so_lieu: children.length ? kidVals.length : undefined,
    dem,
  };
}

type Q = postgres.Sql | postgres.TransactionSql;

/** Lấy và tính toàn bộ chỉ tiêu theo điều kiện */
export async function loadKpis(sql: Q, where: postgres.PendingQuery<postgres.Row[]>, nguong: number, nam?: number) {
  const rows = (await sql`
    SELECT ct.*, p.ho_ten AS ten_phu_trach, d.ten AS ten_don_vi, l.ho_ten AS ten_lanh_dao
    FROM chi_tieu ct
    LEFT JOIN nguoi_dung p ON p.id = ct.id_phu_trach
    LEFT JOIN don_vi d ON d.id = ct.id_don_vi_phu_trach
    LEFT JOIN nguoi_dung l ON l.id = ct.id_lanh_dao
    WHERE NOT ct.huy AND (${where}) ${nam ? sql`AND ct.nam = ${nam}` : sql``}
    ORDER BY ct.nhom, ct.thu_tu, ct.id`) as unknown as KpiRow[];
  if (!rows.length) return [];
  const all = (await sql`SELECT id, id_cha FROM chi_tieu WHERE NOT huy`) as unknown as { id: number; id_cha: number | null }[];
  const ids = [...new Set([...rows.map((r) => r.id), ...all.filter((a) => a.id_cha && rows.some((r) => r.id === a.id_cha)).map((a) => a.id)])];
  const data = (await sql`SELECT id_chi_tieu, ky, gia_tri, xac_nhan, so_toan_trinh, so_mot_phan, so_truc_tiep, so_phat_sinh, so_dat FROM chi_tieu_so_lieu WHERE hieu_luc AND id_chi_tieu IN ${sql(ids)}`) as unknown as SoLieu[];
  const plans = (await sql`SELECT id_chi_tieu, ky, gia_tri FROM chi_tieu_ke_hoach_ky WHERE id_chi_tieu IN ${sql(ids)}`) as unknown as KeHoachKy[];
  const childRows = (await sql`SELECT * FROM chi_tieu WHERE NOT huy AND id_cha IN ${sql(rows.map((r) => r.id))}`) as unknown as KpiRow[];
  return rows.map((k) => {
    const kids = childRows.filter((c) => c.id_cha === k.id);
    const childCalcs = kids.map((c) => calcKpi(c, data, plans, nguong));
    return { ...k, ...calcKpi(k, data, plans, nguong, childCalcs), so_phan_ra: kids.length, tong_ke_hoach_con: kids.reduce((s, c) => s + Number(c.ke_hoach_nam), 0) };
  });
}

export function currentPeriod(ky: string, now = new Date()): string {
  const d = vnDate(now);
  if (ky === "quy") return `${d.slice(0, 4)}-Q${Math.floor((Number(d.slice(5, 7)) - 1) / 3) + 1}`;
  if (ky === "tuan") {
    const t = new Date(d + "T00:00:00Z");
    const w = (t.getUTCDay() + 6) % 7;
    t.setUTCDate(t.getUTCDate() - w);
    return t.toISOString().slice(0, 10);
  }
  return d.slice(0, 7);
}

export function periodLabel(ky: string): string {
  if (/Q\d$/.test(ky)) return `Quý ${ky.slice(-1)}/${ky.slice(0, 4)}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(ky)) return `Tuần từ ${ky.slice(8, 10)}/${ky.slice(5, 7)}/${ky.slice(0, 4)}`;
  return `Tháng ${Number(ky.slice(5, 7))}/${ky.slice(0, 4)}`;
}

export function fmtNum(n: number | null | undefined, digits = 2): string {
  if (n == null || Number.isNaN(n)) return "–";
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: digits }).format(n);
}
