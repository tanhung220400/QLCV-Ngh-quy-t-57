import type postgres from "postgres";
import type { User } from "./auth";
import { identities, scopeSets, seesAll, subtree, allUnits, type Scope } from "./perm";
import { canEnterModule, canSeeModule, type MoDun, type Truong } from "./modules";
import { fmtDate } from "./time";

type Q = postgres.Sql | postgres.TransactionSql;

export async function loadModule(sql: Q, ma: string) {
  const m = (await sql`SELECT * FROM mo_dun WHERE ma = ${ma}`)[0] as unknown as MoDun | undefined;
  if (!m) return null;
  const fields = (await sql`SELECT * FROM mo_dun_truong WHERE id_mo_dun = ${m.id} ORDER BY thu_tu, id`) as unknown as Truong[];
  return { m, fields };
}

/** Dòng dữ liệu nào người dùng được xem trong module (alias bg) */
export async function recordScope(sql: postgres.Sql, user: User, m: MoDun): Promise<Scope> {
  if (m.pham_vi === "toan_xa" || user.quyen.includes("qt.du_lieu")) return { q: sql`TRUE` };
  const ids = await identities(user);
  if (ids.some(seesAll) || ids.some((i) => i.pham_vi.loai === "linh_vuc")) return { q: sql`TRUE` };
  const { donVi, units } = await scopeSets(ids);
  const all = [...new Set([...donVi, ...ids.flatMap((i) => subtree(units, i.id_don_vi))])];
  const pid = ids.map((i) => i.id);
  return { q: all.length ? sql`(bg.id_nguoi_tao IN ${sql(pid)} OR bg.id_don_vi IN ${sql(all)})` : sql`bg.id_nguoi_tao IN ${sql(pid)}` };
}

export type BanGhi = {
  id: number;
  id_mo_dun: number;
  du_lieu: Record<string, unknown>;
  id_don_vi: number | null;
  id_nguoi_tao: number | null;
  tao_luc: Date;
  cap_nhat_luc: Date;
  nguoi_tao?: string;
  nguoi_sua?: string;
};

/** Quyền trên một bản ghi */
export function recordRights(user: User, m: MoDun, r?: Pick<BanGhi, "id_nguoi_tao" | "id_don_vi"> | null) {
  const admin = user.quyen.includes("qt.du_lieu");
  const enter = canEnterModule(user, m);
  const see = admin || canSeeModule(user, m);
  if (!r) return { xem: see, them: enter, sua: false, xoa: false };
  const mine = r.id_nguoi_tao === user.id;
  const sameUnit = r.id_don_vi != null && r.id_don_vi === user.id_don_vi;
  const lead = user.vai_tro === "lanh_dao" || user.vai_tro === "tong_hop";
  return {
    xem: see,
    them: enter,
    sua: admin || (enter && (mine || sameUnit || lead || m.pham_vi === "toan_xa")),
    xoa: admin || (enter && (mine || lead)),
  };
}

/** Tham chiếu tên để hiển thị giá trị đơn vị, cán bộ */
export async function lookups(sql: Q) {
  const units = (await sql`SELECT id, ten, loai FROM don_vi WHERE hoat_dong ORDER BY thu_tu, ten`) as unknown as { id: number; ten: string; loai: string }[];
  const people = (await sql`SELECT n.id, n.ho_ten, d.ten AS don_vi FROM nguoi_dung n LEFT JOIN don_vi d ON d.id = n.id_don_vi WHERE n.trang_thai = 'hoat_dong' ORDER BY n.ho_ten`) as unknown as { id: number; ho_ten: string; don_vi: string | null }[];
  const lv = (await sql`SELECT ten FROM danh_muc WHERE loai = 'linh_vuc' ORDER BY thu_tu, id`).map((r) => r.ten as string);
  return { units, people, linhVuc: lv };
}
export type Lookups = Awaited<ReturnType<typeof lookups>>;

/** Hiển thị một giá trị theo kiểu trường */
export function showValue(f: Pick<Truong, "kieu">, v: unknown, lk?: Lookups): string {
  if (v === null || v === undefined || v === "") return "";
  switch (f.kieu) {
    case "co_khong":
      return v === true || v === "1" || v === "co" ? "Có" : "Không";
    case "ngay":
      return /^\d{4}-\d{2}-\d{2}/.test(String(v)) ? fmtDate(String(v) + "T00:00:00+07:00") : String(v);
    case "so":
      return typeof v === "number" ? v.toLocaleString("vi-VN") : String(v);
    case "nhieu_lua_chon":
      return Array.isArray(v) ? v.join(", ") : String(v);
    case "don_vi":
      return lk?.units.find((u) => u.id === Number(v))?.ten || String(v);
    case "nguoi":
      return lk?.people.find((u) => u.id === Number(v))?.ho_ten || String(v);
    default:
      return String(v);
  }
}

/** Tiêu đề bản ghi = giá trị trường đầu tiên */
export function recordTitle(fields: Truong[], r: Pick<BanGhi, "du_lieu" | "id">, lk?: Lookups) {
  const f = fields.find((x) => x.hien_danh_sach) || fields[0];
  return (f && showValue(f, r.du_lieu[f.khoa], lk)) || `Bản ghi #${r.id}`;
}

const NUM = (s: string) => Number(s.replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));

/** Đọc giá trị từ form / Excel theo kiểu trường, trả về [giá trị, lỗi] */
export function parseValue(f: Truong, raw: string | string[], lk: Lookups): [unknown, string | null] {
  const s = Array.isArray(raw) ? "" : raw.trim();
  const empty = Array.isArray(raw) ? raw.filter(Boolean).length === 0 : !s;
  if (empty) return [null, f.bat_buoc ? `Nhập “${f.ten}”.` : null];
  switch (f.kieu) {
    case "so": {
      const n = NUM(s);
      return Number.isFinite(n) ? [n, null] : [null, `“${f.ten}” phải là số.`];
    }
    case "ngay": {
      let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (m) return [`${m[1]}-${m[2]}-${m[3]}`, null];
      m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (m) return [`${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`, null];
      return [null, `“${f.ten}” phải là ngày (dd/mm/yyyy).`];
    }
    case "co_khong":
      return [["1", "co", "có", "x", "true", "yes"].includes(s.toLowerCase()), null];
    case "nhieu_lua_chon": {
      const arr = Array.isArray(raw) ? raw.map(String).filter(Boolean) : s.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean);
      return [arr, null];
    }
    case "lua_chon":
      if (f.tuy_chon.length && !f.tuy_chon.includes(s)) {
        const hit = f.tuy_chon.find((o) => o.toLowerCase() === s.toLowerCase());
        return hit ? [hit, null] : [null, `“${f.ten}”: “${s}” không có trong danh sách.`];
      }
      return [s, null];
    case "don_vi": {
      const u = lk.units.find((x) => String(x.id) === s) || lk.units.find((x) => x.ten.toLowerCase() === s.toLowerCase());
      return u ? [u.id, null] : [null, `“${f.ten}”: không tìm thấy “${s}”.`];
    }
    case "nguoi": {
      const u = lk.people.find((x) => String(x.id) === s) || lk.people.find((x) => x.ho_ten.toLowerCase() === s.toLowerCase());
      return u ? [u.id, null] : [null, `“${f.ten}”: không tìm thấy cán bộ “${s}”.`];
    }
    case "so_dien_thoai":
      return /^[+\d][\d\s.-]{7,15}$/.test(s) ? [s.replace(/[\s.-]/g, ""), null] : [null, `“${f.ten}” không đúng số điện thoại.`];
    case "email":
      return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s) ? [s, null] : [null, `“${f.ten}” không đúng email.`];
    case "toa_do":
      return /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(s) ? [s.replace(/\s/g, ""), null] : [null, `“${f.ten}”: nhập dạng vĩ độ,kinh độ.`];
    case "lien_ket":
      return /^https?:\/\//i.test(s) ? [s, null] : [`https://${s}`, null];
    default:
      return [s, null];
  }
}

export function readForm(fields: Truong[], fd: FormData, lk: Lookups) {
  const data: Record<string, unknown> = {};
  const errs: string[] = [];
  for (const f of fields) {
    const raw = f.kieu === "nhieu_lua_chon" ? fd.getAll(`f_${f.khoa}`).map(String) : f.kieu === "co_khong" ? (fd.get(`f_${f.khoa}`) ? "1" : "0") : String(fd.get(`f_${f.khoa}`) ?? "");
    const [v, e] = parseValue(f, raw, lk);
    if (e) errs.push(e);
    if (v !== null) data[f.khoa] = v;
  }
  return { data, errs };
}

/** Thống kê nhanh cho trang danh sách: đếm theo trường lựa chọn đầu tiên, tổng trường số */
export function quickStats(fields: Truong[], rows: BanGhi[]) {
  const pick = fields.find((f) => f.kieu === "lua_chon");
  const counts: [string, number][] = [];
  if (pick) {
    const m = new Map<string, number>();
    for (const r of rows) {
      const v = String(r.du_lieu[pick.khoa] ?? "Chưa nhập");
      m.set(v, (m.get(v) || 0) + 1);
    }
    for (const o of [...pick.tuy_chon, "Chưa nhập"]) if (m.has(o)) counts.push([o, m.get(o)!]);
  }
  const sums = fields
    .filter((f) => f.kieu === "so" && !/nam|năm/i.test(f.khoa))
    .slice(0, 2)
    .map((f) => [f.ten, rows.reduce((a, r) => a + (Number(r.du_lieu[f.khoa]) || 0), 0)] as [string, number]);
  return { pick: pick?.ten, counts, sums };
}

export { allUnits };
