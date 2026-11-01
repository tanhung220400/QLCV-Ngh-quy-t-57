import type postgres from "postgres";
import type { User } from "./auth";
import { db } from "./db";
import { taskScope, kpiScope, allUnits, subtree } from "./perm";
import { TASK_LIST_FROM, TASK_LIST_SELECT, type TaskListItem } from "./tasks";
import { getCatalog, getHolidays, getSettings } from "./settings";
import { addWorkingDays, fromVN, vnDate } from "./time";
import { loadKpis } from "./kpi";
import { hieuCauHoi, type BoLoc } from "./tracuu";

type Frag = postgres.PendingQuery<postgres.Row[]>;

export async function danhMuc() {
  const sql = await db();
  return {
    don_vi: (await sql`SELECT id, ten FROM don_vi WHERE hoat_dong`) as unknown as { id: number; ten: string }[],
    nguoi: (await sql`SELECT id, ho_ten FROM nguoi_dung WHERE trang_thai = 'hoat_dong'`) as unknown as { id: number; ho_ten: string }[],
    linh_vuc: await getCatalog("linh_vuc"),
  };
}

export type KetQuaCV = {
  loai: "cong_viec";
  bo_loc: BoLoc;
  ds: TaskListItem[];
  tong: { tong: number; qua_han: number; dang_lam: number; hoan_thanh: number; dung_han: number; tre_han: number; cho_duyet: number };
  nhom: { ten: string; tong: number; qua_han: number; dang_lam: number; hoan_thanh: number; dung_han: number }[];
};

export type KetQuaCT = {
  loai: "chi_tieu";
  bo_loc: BoLoc;
  nam: number;
  ds: Awaited<ReturnType<typeof loadKpis>>;
  tong: { tong: number; xanh: number; vang: number; do: number; xam: number; dat: number };
  nhom: { ten: string; tong: number; xanh: number; vang: number; do: number; xam: number }[];
};

function likeAny(sql: postgres.Sql, expr: Frag, words: string[]): Frag {
  return sql`${expr} LIKE ANY (${words.map((w) => `%${w}%`)}::text[])`;
}

export async function traCuu(user: User, q: string): Promise<KetQuaCV | KetQuaCT> {
  const sql = await db();
  const dm = await danhMuc();
  const f = hieuCauHoi(q, dm);
  const units = await allUnits();
  const unitIds = [...new Set(f.don_vi.flatMap((d) => subtree(units, d)))];

  if (f.doi_tuong === "chi_tieu") {
    const nam = f.tu ? Number(f.tu.slice(0, 4)) : Number(vnDate().slice(0, 4));
    const cfg = await getSettings();
    const conds: Frag[] = [(await kpiScope(sql, user)).q];
    if (f.linh_vuc.length) conds.push(sql`ct.linh_vuc IN ${sql(f.linh_vuc)}`);
    if (unitIds.length) conds.push(sql`ct.id_don_vi_phu_trach IN ${sql(unitIds)}`);
    if (f.nguoi.length) conds.push(sql`(ct.id_phu_trach IN ${sql(f.nguoi)} OR ct.id_lanh_dao IN ${sql(f.nguoi)})`);
    if (f.nguon.length) conds.push(sql`ct.nguon IN ${sql(f.nguon)}`);
    for (const g of f.tu_khoa) conds.push(likeAny(sql, sql`bo_dau(ct.ten || ' ' || ct.nhom || ' ' || coalesce(ct.linh_vuc, ''))`, g));
    let ds = await loadKpis(sql, conds.reduce((a, b) => sql`${a} AND ${b}`), cfg.nguong_nguy_co, nam);
    if (f.kpi.length)
      ds = ds.filter((k) =>
        f.kpi.some(
          (s) =>
            (s === "nguy_co" && k.mau === "do") ||
            (s === "cham" && k.mau === "vang") ||
            (s === "dung_tien_do" && k.mau === "xanh") ||
            (s === "dat" && k.pct != null && k.pct >= 100) ||
            (s === "chua_co_so_lieu" && k.thuc_hien == null) ||
            (s === "cho_xac_nhan" && k.cho_xac_nhan > 0),
        ),
      );
    const count = (list: typeof ds) => ({
      tong: list.length,
      xanh: list.filter((k) => k.mau === "xanh").length,
      vang: list.filter((k) => k.mau === "vang").length,
      do: list.filter((k) => k.mau === "do").length,
      xam: list.filter((k) => k.mau === "xam").length,
    });
    const key = (k: (typeof ds)[number]) =>
      f.nhom_theo === "don_vi" ? k.ten_don_vi || "Chưa giao đơn vị" : f.nhom_theo === "nguoi" ? k.ten_phu_trach || "Chưa có người phụ trách" : k.linh_vuc || "Chưa phân lĩnh vực";
    const groups = [...new Set(ds.map(key))];
    return {
      loai: "chi_tieu",
      bo_loc: f,
      nam,
      ds,
      tong: { ...count(ds), dat: ds.filter((k) => k.pct != null && k.pct >= 100).length },
      nhom: groups.map((g) => ({ ten: g, ...count(ds.filter((k) => key(k) === g)) })),
    };
  }

  // ---- Công việc ----
  const conds: Frag[] = [(await taskScope(sql, user)).q];
  const WORK = sql`cv.trang_thai IN ('moi_giao','da_nhan','dang_thuc_hien')`;
  if (f.trang_thai.length) {
    const cfg = await getSettings();
    const hol = await getHolidays();
    const lim = fromVN(addWorkingDays(vnDate(), cfg.nguong_vang, hol), "23:59");
    const ors: Frag[] = f.trang_thai.map((s) => {
      switch (s) {
        case "qua_han":
          return sql`(${WORK} AND cv.han < now())`;
        case "sap_han":
          return sql`(${WORK} AND cv.han >= now() AND cv.han <= ${lim})`;
        case "dang_lam":
          return sql`cv.trang_thai IN ('moi_giao','da_nhan','dang_thuc_hien','cho_duyet')`;
        case "hoan_thanh":
          return sql`cv.trang_thai = 'hoan_thanh'`;
        case "dung_han":
          return sql`(cv.trang_thai = 'hoan_thanh' AND cv.ngay_hoan_thanh <= cv.han)`;
        case "tre_han":
          return sql`(cv.trang_thai = 'hoan_thanh' AND cv.ngay_hoan_thanh > cv.han)`;
        case "gia_han":
          return sql`(cv.so_lan_gia_han > 0 OR EXISTS (SELECT 1 FROM gia_han g WHERE g.id_cong_viec = cv.id))`;
        case "lam_lai":
          return sql`cv.so_lan_lam_lai > 0`;
        default:
          return sql`cv.trang_thai = ${s}`;
      }
    });
    // "quá hạn" + "đang làm" cùng lúc nghĩa là việc đang làm mà đã quá hạn
    if (f.trang_thai.includes("qua_han") && f.trang_thai.includes("dang_lam")) conds.push(sql`(${WORK} AND cv.han < now())`);
    else conds.push(sql`(${ors.reduce((a, b) => sql`${a} OR ${b}`)})`);
  } else conds.push(sql`cv.trang_thai <> 'huy'`);
  const col = f.moc === "hoan_thanh" ? sql`cv.ngay_hoan_thanh` : f.moc === "giao" ? sql`cv.tao_luc` : sql`cv.han`;
  if (f.tu) conds.push(sql`${col} >= ${fromVN(f.tu, "00:00")}`);
  if (f.den) conds.push(sql`${col} <= ${fromVN(f.den, "23:59")}`);
  if (unitIds.length) conds.push(sql`cv.id_don_vi_chu_tri IN ${sql(unitIds)}`);
  if (f.linh_vuc.length) conds.push(sql`cv.linh_vuc IN ${sql(f.linh_vuc)}`);
  if (f.nguoi.length) conds.push(sql`(cv.id_chu_tri IN ${sql(f.nguoi)} OR cv.id_nguoi_thuc_hien IN ${sql(f.nguoi)})`);
  if (f.nguon.length) conds.push(sql`cv.nguon_giao IN ${sql(f.nguon)}`);
  if (f.uu_tien.length) conds.push(sql`cv.uu_tien IN ${sql(f.uu_tien)}`);
  for (const g of f.tu_khoa)
    conds.push(
      likeAny(
        sql,
        sql`bo_dau(cv.ten || ' ' || coalesce(cv.mo_ta, '') || ' ' || coalesce(cv.ket_qua, '') || ' ' || coalesce(cv.so_hieu_vb, '') || ' ' || coalesce(cv.cuoc_hop, '') || ' ' || cv.san_pham)`,
        g,
      ),
    );
  const where = conds.reduce((a, b) => sql`${a} AND ${b}`);
  const ds = (await sql`SELECT ${sql.unsafe(TASK_LIST_SELECT)}, cv.tao_luc FROM ${sql.unsafe(TASK_LIST_FROM)} WHERE ${where}
    ORDER BY CASE WHEN cv.trang_thai IN ('hoan_thanh','huy') THEN 1 ELSE 0 END, cv.han LIMIT 1000`) as unknown as (TaskListItem & { tao_luc: Date })[];
  const now = Date.now();
  const isQua = (t: TaskListItem) => ["moi_giao", "da_nhan", "dang_thuc_hien"].includes(t.trang_thai) && new Date(t.han).getTime() < now;
  const count = (list: TaskListItem[]) => ({
    tong: list.length,
    qua_han: list.filter(isQua).length,
    dang_lam: list.filter((t) => ["moi_giao", "da_nhan", "dang_thuc_hien", "cho_duyet"].includes(t.trang_thai)).length,
    hoan_thanh: list.filter((t) => t.trang_thai === "hoan_thanh").length,
    dung_han: list.filter((t) => t.trang_thai === "hoan_thanh" && t.ngay_hoan_thanh && new Date(t.ngay_hoan_thanh) <= new Date(t.han)).length,
    tre_han: list.filter((t) => t.trang_thai === "hoan_thanh" && t.ngay_hoan_thanh && new Date(t.ngay_hoan_thanh) > new Date(t.han)).length,
    cho_duyet: list.filter((t) => t.trang_thai === "cho_duyet").length,
  });
  const TT: Record<string, string> = { moi_giao: "Mới giao", da_nhan: "Đã nhận", dang_thuc_hien: "Đang thực hiện", cho_duyet: "Chờ xác nhận", hoan_thanh: "Hoàn thành", tra_lai: "Trả lại", tam_dung: "Tạm dừng", huy: "Hủy" };
  const key = (t: TaskListItem & { tao_luc: Date }) => {
    switch (f.nhom_theo) {
      case "don_vi":
        return t.ten_don_vi || "Không thuộc đơn vị";
      case "linh_vuc":
        return t.linh_vuc;
      case "nguoi":
        return t.ten_thuc_hien || t.ten_chu_tri;
      case "thang": {
        const d = vnDate(f.moc === "hoan_thanh" && t.ngay_hoan_thanh ? t.ngay_hoan_thanh : f.moc === "giao" ? t.tao_luc : t.han);
        return `Tháng ${Number(d.slice(5, 7))}/${d.slice(0, 4)}`;
      }
      case "trang_thai":
        return isQua(t) ? "Quá hạn" : TT[t.trang_thai];
      default:
        return "";
    }
  };
  const groups = f.nhom_theo ? [...new Set(ds.map(key))] : [];
  return {
    loai: "cong_viec",
    bo_loc: f,
    ds,
    tong: count(ds),
    nhom: groups.map((g) => ({ ten: g, ...count(ds.filter((t) => key(t) === g)) })).sort((a, b) => b.tong - a.tong),
  };
}
