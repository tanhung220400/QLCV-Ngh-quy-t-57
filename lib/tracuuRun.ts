import type postgres from "postgres";
import type { User } from "./auth";
import { db } from "./db";
import { taskScope, kpiScope, allUnits, subtree } from "./perm";
import { TASK_LIST_FROM, TASK_LIST_SELECT, type TaskListItem } from "./tasks";
import { getCatalog, getHolidays, getSettings } from "./settings";
import { addWorkingDays, fromVN, vnDate } from "./time";
import { loadKpis } from "./kpi";
import { hieuCauHoi, type BoLoc } from "./tracuu";
import { moRong, chuanBi, xepHang, type KhaiNiemTim } from "./timKiem";
import { canSeeModule, type MoDun, type Truong as TruongMD } from "./modules";
import { recordScope, recordTitle, showValue, lookups } from "./records";

type Frag = postgres.PendingQuery<postgres.Row[]>;

export async function danhMuc() {
  const sql = await db();
  return {
    don_vi: (await sql`SELECT id, ten FROM don_vi WHERE hoat_dong`) as unknown as { id: number; ten: string }[],
    nguoi: (await sql`SELECT id, ho_ten FROM nguoi_dung WHERE trang_thai = 'hoat_dong'`) as unknown as { id: number; ho_ten: string }[],
    linh_vuc: await getCatalog("linh_vuc"),
  };
}

export type Khop = { diem: number; khop: string[]; trich: string };
export type ViecTim = TaskListItem &
  Khop & {
    tao_luc: Date;
    mo_ta: string | null;
    so_hieu_vb: string | null;
    cuoc_hop: string | null;
    ket_qua: string | null;
    ngay_bao_cao: Date | null;
    ten_nguoi_xac_nhan: string | null;
    xac_nhan_luc: Date | null;
    binh_luan: string | null;
    viec_nho: string | null;
    tep: string | null;
  };
type ChiTieuTim = Awaited<ReturnType<typeof loadKpis>>[number] & Khop & { ghi_chu_so_lieu: string | null };
export type BanGhiTim = Khop & { id: number; tieu_de: string; gia_tri: Record<string, string>; tao_luc: Date; nguoi_tao: string | null; don_vi: string | null };
export type CanBoTim = Khop & { id: number; ho_ten: string; chuc_vu: string | null; don_vi: string | null; chuc_vu_dang: string | null; kiem_nhiem: string | null; linh_vuc: string; sdt: string | null };
export type DonViTim = Khop & { id: number; ten: string; so_can_bo: number; nguoi_dung_dau: string | null };

export type TongCV = { tong: number; qua_han: number; dang_lam: number; hoan_thanh: number; dung_han: number; tre_han: number; cho_duyet: number };
export type TongCT = { tong: number; xanh: number; vang: number; do: number; xam: number; dat: number };

export type KetQuaTraCuu = {
  q: string;
  bo_loc: BoLoc;
  khai_niem: KhaiNiemTim[];
  cong_viec: { ds: ViecTim[]; tong: TongCV; nhom: ({ ten: string } & TongCV)[] } | null;
  chi_tieu: { ds: ChiTieuTim[]; nam: number; tong: TongCT; nhom: ({ ten: string } & Omit<TongCT, "dat">)[] } | null;
  ban_ghi: { mo_dun: { id: number; ma: string; ten: string }; truong: TruongMD[]; ds: BanGhiTim[] }[];
  can_bo: CanBoTim[];
  don_vi: DonViTim[];
  tong_so: number;
};

const jn = (...a: (string | null | undefined)[]) => a.filter(Boolean).join(" · ");

/** Tra cứu trong toàn bộ dữ liệu được phép xem: hiểu câu hỏi, mở rộng đồng nghĩa / hàm ý, xếp hạng kết quả */
export async function traCuu(user: User, q: string): Promise<KetQuaTraCuu> {
  const sql = await db();
  const dm = await danhMuc();
  const f = hieuCauHoi(q, dm);
  const kn = moRong(f.con_lai, q);
  const units = await allUnits();
  const unitIds = [...new Set(f.don_vi.flatMap((d) => subtree(units, d)))];
  const coLocCauTruc = f.trang_thai.length + f.kpi.length + f.nguon.length + f.uu_tien.length > 0 || !!f.tu;
  // phạm vi tìm: nói rõ “chỉ tiêu” / “việc” thì chỉ tìm loại đó; còn lại tìm toàn bộ dữ liệu
  const timCT = f.doi_tuong === "chi_tieu" || (!f.chi_viec && (kn.length > 0 || !coLocCauTruc));
  const timCV = f.doi_tuong !== "chi_tieu";
  const timKhac = kn.length > 0 && f.doi_tuong !== "chi_tieu" && !f.chi_viec && f.trang_thai.length === 0 && f.kpi.length === 0;

  if (kn.length) f.hieu.push(...kn.map((k) => `Nội dung: “${k.goc}”${k.bien.length > 1 ? ` (cùng nghĩa, liên quan: ${k.bien.slice(1, 6).map((b) => b.t).join(", ")}${k.bien.length > 6 ? "…" : ""})` : ""}`));
  f.hieu = f.hieu.filter((h) => !h.startsWith("Nội dung có “"));
  if (timKhac) f.hieu.push("Tìm trong toàn bộ dữ liệu: công việc, chỉ tiêu, dữ liệu các module, cán bộ, đơn vị");

  // ---------------- Công việc ----------------
  let cong_viec: KetQuaTraCuu["cong_viec"] = null;
  if (timCV) {
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
      if (f.trang_thai.includes("qua_han") && f.trang_thai.includes("dang_lam")) conds.push(sql`(${WORK} AND cv.han < now())`);
      else conds.push(sql`(${ors.reduce((a, b) => sql`${a} OR ${b}`)})`);
    } else conds.push(sql`cv.trang_thai <> 'huy'`);
    const col = f.moc === "hoan_thanh" ? sql`cv.ngay_hoan_thanh` : f.moc === "giao" ? sql`cv.tao_luc` : sql`cv.han`;
    if (f.tu) conds.push(sql`${col} >= ${fromVN(f.tu, "00:00")}`);
    if (f.den) conds.push(sql`${col} <= ${fromVN(f.den, "23:59")}`);
    if (unitIds.length) conds.push(sql`cv.id_don_vi_chu_tri IN ${sql(unitIds)}`);
    if (f.linh_vuc.length) conds.push(sql`cv.linh_vuc IN ${sql(f.linh_vuc)}`);
    if (f.nguoi.length) conds.push(sql`(cv.id_chu_tri IN ${sql(f.nguoi)} OR cv.id_nguoi_thuc_hien IN ${sql(f.nguoi)} OR cv.id_nguoi_giao IN ${sql(f.nguoi)})`);
    if (f.nguon.length) conds.push(sql`cv.nguon_giao IN ${sql(f.nguon)}`);
    if (f.uu_tien.length) conds.push(sql`cv.uu_tien IN ${sql(f.uu_tien)}`);
    const where = conds.reduce((a, b) => sql`${a} AND ${b}`);
    let ds = (await sql`SELECT ${sql.unsafe(TASK_LIST_SELECT)}, cv.tao_luc, cv.mo_ta, cv.so_hieu_vb, cv.cuoc_hop, cv.ket_qua, cv.ngay_bao_cao, cv.xac_nhan_luc,
        (SELECT ho_ten FROM nguoi_dung x WHERE x.id = cv.id_nguoi_xac_nhan) AS ten_nguoi_xac_nhan
      FROM ${sql.unsafe(TASK_LIST_FROM)} WHERE ${where}
      ORDER BY CASE WHEN cv.trang_thai IN ('hoan_thanh','huy') THEN 1 ELSE 0 END, cv.han LIMIT ${kn.length ? 5000 : 1000}`) as unknown as ViecTim[];
    if (ds.length) {
      const ids = ds.map((t) => t.id);
      const gop = async (q: Frag) => new Map((await q).map((r) => [r.id as number, r.t as string]));
      const bl = await gop(sql`SELECT id_cong_viec AS id, string_agg(noi_dung, ' | ' ORDER BY thoi_gian) AS t FROM binh_luan WHERE id_cong_viec IN ${sql(ids)} AND loai <> 'he_thong' GROUP BY id_cong_viec`);
      const ck = await gop(sql`SELECT id_cong_viec AS id, string_agg(noi_dung, ' | ' ORDER BY thu_tu) AS t FROM checklist WHERE id_cong_viec IN ${sql(ids)} GROUP BY id_cong_viec`);
      const tp = await gop(sql`SELECT id_doi_tuong AS id, string_agg(ten_tep, ' | ') AS t FROM tep_dinh_kem WHERE doi_tuong = 'cong_viec' AND id_doi_tuong IN ${sql(ids)} GROUP BY id_doi_tuong`);
      for (const t of ds) {
        t.binh_luan = bl.get(t.id) || null;
        t.viec_nho = ck.get(t.id) || null;
        t.tep = tp.get(t.id) || null;
      }
    }
    if (kn.length)
      ds = xepHang(
        ds.map((t) => ({
          x: t,
          d: chuanBi({
            truong: [
              { ten: "Tên việc", text: t.ten, w: 3 },
              { ten: "Số hiệu", text: t.so_hieu_vb || "", w: 2 },
              { ten: "Mô tả", text: t.mo_ta || "", w: 1.5 },
              { ten: "Kết quả", text: t.ket_qua || "", w: 1.5 },
              { ten: "Cuộc họp", text: t.cuoc_hop || "", w: 1.2 },
              { ten: "Lĩnh vực", text: t.linh_vuc, w: 1.2 },
              { ten: "Việc nhỏ", text: t.viec_nho || "", w: 1 },
              { ten: "Sản phẩm", text: t.san_pham, w: 0.8 },
              { ten: "Người, đơn vị", text: jn(t.ten_don_vi, t.ten_chu_tri, t.ten_thuc_hien, t.ten_nguoi_giao), w: 0.8 },
              { ten: "Trao đổi", text: t.binh_luan || "", w: 0.8 },
              { ten: "Tệp", text: t.tep || "", w: 0.8 },
              { ten: "Nguồn", text: t.nguon_giao, w: 0.6 },
            ],
          }),
        })),
        kn,
      );
    const now = Date.now();
    const isQua = (t: TaskListItem) => ["moi_giao", "da_nhan", "dang_thuc_hien"].includes(t.trang_thai) && new Date(t.han).getTime() < now;
    const count = (list: TaskListItem[]): TongCV => ({
      tong: list.length,
      qua_han: list.filter(isQua).length,
      dang_lam: list.filter((t) => ["moi_giao", "da_nhan", "dang_thuc_hien", "cho_duyet"].includes(t.trang_thai)).length,
      hoan_thanh: list.filter((t) => t.trang_thai === "hoan_thanh").length,
      dung_han: list.filter((t) => t.trang_thai === "hoan_thanh" && t.ngay_hoan_thanh && new Date(t.ngay_hoan_thanh) <= new Date(t.han)).length,
      tre_han: list.filter((t) => t.trang_thai === "hoan_thanh" && t.ngay_hoan_thanh && new Date(t.ngay_hoan_thanh) > new Date(t.han)).length,
      cho_duyet: list.filter((t) => t.trang_thai === "cho_duyet").length,
    });
    const TT: Record<string, string> = { moi_giao: "Mới giao", da_nhan: "Đã nhận", dang_thuc_hien: "Đang thực hiện", cho_duyet: "Chờ xác nhận", hoan_thanh: "Hoàn thành", tra_lai: "Trả lại", tam_dung: "Tạm dừng", huy: "Hủy" };
    const key = (t: ViecTim) => {
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
    cong_viec = { ds, tong: count(ds), nhom: groups.map((g) => ({ ten: g, ...count(ds.filter((t) => key(t) === g)) })).sort((a, b) => b.tong - a.tong) };
  }

  // ---------------- Chỉ tiêu ----------------
  let chi_tieu: KetQuaTraCuu["chi_tieu"] = null;
  if (timCT) {
    const nam = f.tu ? Number(f.tu.slice(0, 4)) : Number(vnDate().slice(0, 4));
    const cfg = await getSettings();
    const conds: Frag[] = [(await kpiScope(sql, user)).q];
    if (f.linh_vuc.length) conds.push(sql`ct.linh_vuc IN ${sql(f.linh_vuc)}`);
    if (unitIds.length) conds.push(sql`(ct.id_don_vi_phu_trach IN ${sql(unitIds)} OR EXISTS (SELECT 1 FROM chi_tieu c2 WHERE c2.id_cha = ct.id AND NOT c2.huy AND c2.id_don_vi_phu_trach IN ${sql(unitIds)}))`);
    if (f.nguoi.length) conds.push(sql`(ct.id_phu_trach IN ${sql(f.nguoi)} OR ct.id_lanh_dao IN ${sql(f.nguoi)})`);
    if (f.nguon.length) conds.push(sql`ct.nguon IN ${sql(f.nguon)}`);
    let ds = (await loadKpis(sql, conds.reduce((a, b) => sql`${a} AND ${b}`), cfg.nguong_nguy_co, nam)) as unknown as ChiTieuTim[];
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
    if (ds.length) {
      const gc = new Map(
        (await sql`SELECT c.id, string_agg(DISTINCT s.ghi_chu, ' | ') AS t FROM chi_tieu c JOIN chi_tieu_so_lieu s ON s.id_chi_tieu = c.id OR s.id_chi_tieu IN (SELECT id FROM chi_tieu WHERE id_cha = c.id)
                   WHERE c.id IN ${sql(ds.map((k) => k.id))} AND s.hieu_luc AND s.ghi_chu IS NOT NULL GROUP BY c.id`).map((r) => [r.id as number, r.t as string]),
      );
      for (const k of ds) k.ghi_chu_so_lieu = gc.get(k.id) || null;
    }
    if (kn.length)
      ds = xepHang(
        ds.map((k) => ({
          x: k,
          d: chuanBi({
            truong: [
              { ten: "Tên chỉ tiêu", text: k.ten, w: 3 },
              { ten: "Nhóm", text: k.nhom, w: 1.2 },
              { ten: "Lĩnh vực", text: k.linh_vuc || "", w: 1.2 },
              { ten: "Nguồn", text: k.nguon, w: 0.8 },
              { ten: "Phụ trách", text: jn(k.ten_don_vi, k.ten_phu_trach, k.ten_lanh_dao), w: 0.8 },
              { ten: "Ghi chú số liệu", text: k.ghi_chu_so_lieu || "", w: 0.8 },
            ],
          }),
        })),
        kn,
      );
    else if (!coLocCauTruc && f.doi_tuong !== "chi_tieu" && !unitIds.length && !f.nguoi.length && !f.linh_vuc.length) ds = [];
    const count = (list: ChiTieuTim[]) => ({
      tong: list.length,
      xanh: list.filter((k) => k.mau === "xanh").length,
      vang: list.filter((k) => k.mau === "vang").length,
      do: list.filter((k) => k.mau === "do").length,
      xam: list.filter((k) => k.mau === "xam").length,
    });
    const key = (k: ChiTieuTim) => (f.nhom_theo === "don_vi" ? k.ten_don_vi || "Chưa giao đơn vị" : f.nhom_theo === "nguoi" ? k.ten_phu_trach || "Chưa có người phụ trách" : k.linh_vuc || "Chưa phân lĩnh vực");
    const groups = [...new Set(ds.map(key))];
    chi_tieu = { ds, nam, tong: { ...count(ds), dat: ds.filter((k) => k.pct != null && k.pct >= 100).length }, nhom: groups.map((g) => ({ ten: g, ...count(ds.filter((k) => key(k) === g)) })) };
  }

  // ---------------- Dữ liệu các module, cán bộ, đơn vị ----------------
  const ban_ghi: KetQuaTraCuu["ban_ghi"] = [];
  let can_bo: CanBoTim[] = [];
  let don_vi: DonViTim[] = [];
  if (timKhac) {
    const lk = await lookups(sql);
    const mods = ((await sql`SELECT * FROM mo_dun WHERE loai = 'du_lieu' ORDER BY thu_tu, id`) as unknown as MoDun[]).filter((m) => canSeeModule(user, m) || user.quyen.includes("qt.du_lieu"));
    for (const m of mods) {
      const fields = (await sql`SELECT * FROM mo_dun_truong WHERE id_mo_dun = ${m.id} ORDER BY thu_tu, id`) as unknown as TruongMD[];
      const scope = (await recordScope(sql, user, m)).q;
      const conds: Frag[] = [sql`bg.id_mo_dun = ${m.id}`, scope];
      if (unitIds.length) conds.push(sql`bg.id_don_vi IN ${sql(unitIds)}`);
      if (f.tu) conds.push(sql`bg.tao_luc >= ${fromVN(f.tu, "00:00")}`);
      if (f.den) conds.push(sql`bg.tao_luc <= ${fromVN(f.den, "23:59")}`);
      const rows = await sql`SELECT bg.*, n.ho_ten AS nguoi_tao, d.ten AS don_vi FROM mo_dun_ban_ghi bg LEFT JOIN nguoi_dung n ON n.id = bg.id_nguoi_tao LEFT JOIN don_vi d ON d.id = bg.id_don_vi
                             WHERE ${conds.reduce((a, b) => sql`${a} AND ${b}`)} ORDER BY bg.cap_nhat_luc DESC LIMIT 3000`;
      if (!rows.length) continue;
      const tieuDe = fields[0]?.khoa;
      const ds = xepHang(
        rows.map((r) => {
          const gia_tri: Record<string, string> = {};
          for (const fd of fields) gia_tri[fd.khoa] = showValue(fd, (r.du_lieu as Record<string, unknown>)?.[fd.khoa], lk);
          const x: BanGhiTim = { id: r.id, tieu_de: recordTitle(fields, r as never, lk), gia_tri, tao_luc: r.tao_luc, nguoi_tao: r.nguoi_tao, don_vi: r.don_vi, diem: 0, khop: [], trich: "" };
          return {
            x,
            d: chuanBi({
              truong: [
                ...fields.map((fd) => ({ ten: fd.ten, text: gia_tri[fd.khoa] || "", w: fd.khoa === tieuDe ? 2.5 : fd.kieu === "doan_van" ? 1.2 : 1 })),
                { ten: "Module", text: m.ten, w: 0.5 },
                { ten: "Đơn vị", text: r.don_vi || "", w: 0.6 },
              ],
            }),
          };
        }),
        kn,
      );
      if (ds.length) ban_ghi.push({ mo_dun: { id: m.id, ma: m.ma, ten: m.ten }, truong: fields, ds });
    }
    ban_ghi.sort((a, b) => (b.ds[0]?.diem ?? 0) - (a.ds[0]?.diem ?? 0));

    const xemSdt = user.quyen.includes("qt.nguoi_dung");
    const people = await sql`SELECT n.id, n.ho_ten, n.chuc_vu, n.chuc_vu_dang, n.chuc_vu_kiem_nhiem, n.chuc_danh_bcd, n.chuc_danh_tgv, n.sdt, n.linh_vuc_phu_trach, d.ten AS don_vi, k.ten AS don_vi_kn
      FROM nguoi_dung n LEFT JOIN don_vi d ON d.id = n.id_don_vi LEFT JOIN don_vi k ON k.id = n.id_don_vi_kiem_nhiem
      WHERE n.trang_thai = 'hoat_dong' AND n.ten_dang_nhap <> 'admin' ${unitIds.length ? sql`AND (n.id_don_vi IN ${sql(unitIds)} OR n.id_don_vi_kiem_nhiem IN ${sql(unitIds)})` : sql``}`;
    can_bo = xepHang(
      people.map((p) => {
        const x: CanBoTim = {
          id: p.id,
          ho_ten: p.ho_ten,
          chuc_vu: p.chuc_vu,
          don_vi: p.don_vi,
          chuc_vu_dang: p.chuc_vu_dang,
          kiem_nhiem: jn(p.chuc_vu_kiem_nhiem, p.don_vi_kn) || null,
          linh_vuc: (p.linh_vuc_phu_trach || []).join(", "),
          sdt: xemSdt ? p.sdt : null,
          diem: 0,
          khop: [],
          trich: "",
        };
        return {
          x,
          d: chuanBi({
            truong: [
              { ten: "Họ tên", text: p.ho_ten, w: 3 },
              { ten: "Chức vụ", text: jn(p.chuc_vu, p.chuc_vu_dang, p.chuc_vu_kiem_nhiem, p.chuc_danh_bcd && `BCĐ: ${p.chuc_danh_bcd}`, p.chuc_danh_tgv && `Tổ giúp việc: ${p.chuc_danh_tgv}`), w: 1.2 },
              { ten: "Đơn vị", text: jn(p.don_vi, p.don_vi_kn), w: 1 },
              { ten: "Lĩnh vực phụ trách", text: x.linh_vuc, w: 1 },
            ],
          }),
        };
      }),
      kn,
    ).slice(0, 50);

    const dvs = await sql`SELECT d.id, d.ten, (SELECT count(*)::int FROM nguoi_dung n WHERE n.id_don_vi = d.id AND n.trang_thai = 'hoat_dong') AS so_can_bo FROM don_vi d WHERE d.hoat_dong`;
    const { truongDonVi } = await import("./giaoViec");
    const dvKq = xepHang(
      dvs.map((d) => ({ x: { id: d.id, ten: d.ten, so_can_bo: d.so_can_bo, nguoi_dung_dau: null, diem: 0, khop: [], trich: "" } as DonViTim, d: chuanBi({ truong: [{ ten: "Tên đơn vị", text: d.ten, w: 3 }] }) })),
      kn,
    ).slice(0, 20);
    for (const d of dvKq) {
      const h = await truongDonVi(sql, d.id);
      d.nguoi_dung_dau = h ? lk.people.find((p) => p.id === h)?.ho_ten || null : null;
    }
    don_vi = dvKq;
  }

  const tong_so = (cong_viec?.ds.length || 0) + (chi_tieu?.ds.length || 0) + ban_ghi.reduce((s, b) => s + b.ds.length, 0) + can_bo.length + don_vi.length;
  return { q, bo_loc: f, khai_niem: kn, cong_viec, chi_tieu, ban_ghi, can_bo, don_vi, tong_so };
}
