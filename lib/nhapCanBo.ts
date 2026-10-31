// Nhập / cập nhật danh sách cán bộ từ bảng (Excel): chức vụ Đảng, chính quyền, kiêm nhiệm, Ban chỉ đạo, Tổ giúp việc.
import type postgres from "postgres";
import { VAI_TRO } from "./const";
import { QUYEN_MAC_DINH } from "./quyen";
import { chuanChucVu, chuanChucVuDang, khongDau, linhVucTheoDonVi, loaiDonVi, taoTenDangNhap, vaiTroTheoChucVu } from "./canBo";

type Q = postgres.Sql | postgres.TransactionSql;

export type DongCanBo = {
  dong: number;
  ho_ten: string;
  ten_dang_nhap?: string;
  chuc_vu_dang?: string;
  chuc_vu?: string;
  don_vi?: string;
  chuc_vu_kiem_nhiem?: string;
  don_vi_kiem_nhiem?: string;
  chuc_danh_bcd?: string;
  chuc_danh_tgv?: string;
  sdt?: string;
  vai_tro?: string;
  linh_vuc?: string;
  giao_viec?: string;
};

const COT: [keyof DongCanBo, RegExp][] = [
  ["ho_ten", /^ho (va )?ten/],
  ["ten_dang_nhap", /^ten dang nhap/],
  ["chuc_vu_dang", /^chuc vu (trong )?dang/],
  ["chuc_vu_kiem_nhiem", /^chuc vu kiem nhiem/],
  ["don_vi_kiem_nhiem", /^don vi kiem nhiem/],
  ["chuc_vu", /^chuc vu/],
  ["don_vi", /^don vi/],
  ["chuc_danh_bcd", /ban chi dao|^bcd/],
  ["chuc_danh_tgv", /to giup viec|^tgv/],
  ["sdt", /dien thoai|^sdt/],
  ["vai_tro", /^vai tro/],
  ["linh_vuc", /^linh vuc/],
  ["giao_viec", /^(quyen |cap )?giao viec/],
];

/** Đọc bảng (dòng đầu là tiêu đề) theo tên cột, không phụ thuộc thứ tự cột */
export function docBang(rows: string[][]): { dong: DongCanBo[]; loi: string[] } {
  const loi: string[] = [];
  if (!rows.length) return { dong: [], loi: ["Tệp trống."] };
  const head = rows[0].map((h) => khongDau(String(h || "")));
  const map = new Map<number, keyof DongCanBo>();
  head.forEach((h, i) => {
    const hit = COT.find(([k, re]) => re.test(h) && ![...map.values()].includes(k));
    if (hit) map.set(i, hit[0]);
  });
  if (![...map.values()].includes("ho_ten")) return { dong: [], loi: ["Không thấy cột “Họ và tên” ở dòng tiêu đề."] };
  const dong: DongCanBo[] = [];
  rows.slice(1).forEach((r, j) => {
    const d: DongCanBo = { dong: j + 2, ho_ten: "" };
    for (const [i, k] of map) {
      const v = String(r[i] ?? "").replace(/\s+/g, " ").trim();
      if (v) (d as Record<string, unknown>)[k] = v;
    }
    if (d.ho_ten) dong.push(d);
  });
  return { dong, loi };
}

const khoaDonVi = (s: string) =>
  khongDau(s)
    .replace(/\bphuong\b|\bxa\b/g, " ")
    .replace(/\bva\b|[-–,&.]/g, " ")
    .replace(/\bviet nam\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Gợi ý đơn vị cấp trên cho đơn vị mới (theo hệ thống chính trị cấp xã) */
function goiYCha(ten: string, units: { id: number; ten: string }[]): number | null {
  const d = khongDau(ten);
  const find = (re: RegExp) => units.find((u) => re.test(khongDau(u.ten)))?.id ?? null;
  if (/xay dung dang|kiem tra dang|van phong dang/.test(d)) return find(/^dang uy/);
  if (/^van phong hdnd|^phong |^trung tam|quan ly du an/.test(d)) return find(/^uy ban nhan dan|^ubnd/);
  if (/^ban (van hoa|kinh te|phap che)/.test(d)) return find(/^hoi dong nhan dan|^hdnd/);
  if (/^doan |hoi lien hiep|phu nu|cuu chien binh|hoi nong dan/.test(d)) return find(/mttq|mat tran/);
  return null;
}

export type KetQuaNhap = {
  tao: { ho_ten: string; ten_dang_nhap: string; mat_khau: string; don_vi: string; chuc_vu: string; vai_tro: string; giao_viec: string }[];
  capNhat: { ho_ten: string; ten_dang_nhap: string; don_vi: string; chuc_vu: string }[];
  donViMoi: string[];
  loi: string[];
};

export async function nhapCanBo(
  tx: Q,
  dong: DongCanBo[],
  opt: { hash: (pw: string) => Promise<string>; matKhau: () => string; linhVucCo: string[] },
): Promise<KetQuaNhap> {
  const kq: KetQuaNhap = { tao: [], capNhat: [], donViMoi: [], loi: [] };
  const units = (await tx`SELECT id, ten FROM don_vi`) as unknown as { id: number; ten: string }[];
  const users = (await tx`SELECT id, ho_ten, ten_dang_nhap FROM nguoi_dung`) as unknown as { id: number; ho_ten: string; ten_dang_nhap: string }[];
  const names = new Set(users.map((u) => u.ten_dang_nhap));
  const roleBy: Record<string, string> = {};
  for (const [k, v] of Object.entries(VAI_TRO)) (roleBy[khongDau(v)] = k), (roleBy[k] = k);

  const donVi = async (ten?: string): Promise<{ id: number; ten: string } | null> => {
    if (!ten) return null;
    const k = khoaDonVi(ten);
    let u = units.find((x) => khoaDonVi(x.ten) === k);
    if (!u) {
      const cha = goiYCha(ten, units);
      const [r] = await tx`INSERT INTO don_vi (ten, loai, id_cha, thu_tu) VALUES (${ten}, ${loaiDonVi(ten)}, ${cha}, ${units.length + 1}) RETURNING id`;
      u = { id: r.id as number, ten };
      units.push(u);
      kq.donViMoi.push(ten);
    }
    return u;
  };

  for (const d of dong) {
    const dv = await donVi(d.don_vi);
    const kn = await donVi(d.don_vi_kiem_nhiem);
    const cvDang = chuanChucVuDang(d.chuc_vu_dang);
    const cv = chuanChucVu(d.chuc_vu);
    const v: Record<string, unknown> = {
      ho_ten: d.ho_ten,
      chuc_vu_dang: cvDang,
      chuc_vu: cv,
      id_don_vi: dv?.id ?? null,
      chuc_vu_kiem_nhiem: chuanChucVu(d.chuc_vu_kiem_nhiem),
      id_don_vi_kiem_nhiem: kn?.id ?? null,
      chuc_danh_bcd: d.chuc_danh_bcd || null,
      chuc_danh_tgv: d.chuc_danh_tgv || null,
    };
    if (d.sdt) v.sdt = d.sdt.replace(/[^\d+]/g, "");
    const role = d.vai_tro ? roleBy[khongDau(d.vai_tro)] : undefined;
    if (d.vai_tro && !role) kq.loi.push(`Dòng ${d.dong}: vai trò “${d.vai_tro}” không có; dùng vai trò theo chức vụ.`);
    const lv = d.linh_vuc ? d.linh_vuc.split(/[;\n]/).map((s) => s.trim()).filter((s) => opt.linhVucCo.includes(s)) : undefined;
    const cap = /1/.test(d.giao_viec || "") ? 1 : /2/.test(d.giao_viec || "") ? 2 : 0;

    // cán bộ đã có tài khoản: theo tên đăng nhập, hoặc trùng họ tên (duy nhất)
    let ex = d.ten_dang_nhap ? users.find((u) => u.ten_dang_nhap === d.ten_dang_nhap!.toLowerCase()) : undefined;
    if (!ex) {
      const same = users.filter((u) => khongDau(u.ho_ten) === khongDau(d.ho_ten));
      if (same.length === 1) ex = same[0];
      else if (same.length > 1) {
        kq.loi.push(`Dòng ${d.dong}: có ${same.length} tài khoản trùng tên “${d.ho_ten}”; ghi tên đăng nhập để cập nhật đúng người. Đã bỏ qua.`);
        continue;
      }
    }
    if (ex) {
      if (role) v.vai_tro = role;
      if (lv) v.linh_vuc_phu_trach = lv;
      await tx`UPDATE nguoi_dung SET ${tx(v as never)} WHERE id = ${ex.id}`;
      if (cap) await datCapGiao(tx, ex.id, cap);
      kq.capNhat.push({ ho_ten: d.ho_ten, ten_dang_nhap: ex.ten_dang_nhap, don_vi: dv?.ten || "", chuc_vu: [cv, cvDang].filter(Boolean).join(" · ") });
      continue;
    }
    const vaiTro = role || vaiTroTheoChucVu(cv, dv?.ten || null, cvDang);
    let linhVuc = lv;
    if (!linhVuc) {
      linhVuc = vaiTro === "lanh_dao" ? [] : linhVucTheoDonVi(dv?.ten || null, opt.linhVucCo);
      if (vaiTro !== "lanh_dao" && (d.chuc_danh_bcd || d.chuc_danh_tgv) && opt.linhVucCo.includes("Khoa học, công nghệ, chuyển đổi số") && !linhVuc.includes("Khoa học, công nghệ, chuyển đổi số"))
        linhVuc.push("Khoa học, công nghệ, chuyển đổi số");
    }
    let user = (d.ten_dang_nhap || "").toLowerCase();
    if (!/^[a-z0-9._-]{3,40}$/.test(user) || names.has(user)) user = taoTenDangNhap(d.ho_ten, names);
    else names.add(user);
    const pw = opt.matKhau();
    const [r] = await tx`INSERT INTO nguoi_dung ${tx({ ...v, sdt: v.sdt ?? null, ten_dang_nhap: user, mat_khau: await opt.hash(pw), vai_tro: vaiTro, linh_vuc_phu_trach: linhVuc, doi_mat_khau: true } as never)} RETURNING id`;
    users.push({ id: r.id, ho_ten: d.ho_ten, ten_dang_nhap: user });
    if (cap) await datCapGiao(tx, r.id, cap);
    const q = new Set(QUYEN_MAC_DINH[vaiTro] || []);
    const capHt = cap || (q.has("cv.giao_cap1") ? 1 : q.has("cv.giao_cap2") ? 2 : 0);
    kq.tao.push({ ho_ten: d.ho_ten, ten_dang_nhap: user, mat_khau: pw, don_vi: dv?.ten || "", chuc_vu: [cv, cvDang].filter(Boolean).join(" · "), vai_tro: VAI_TRO[vaiTro], giao_viec: capHt ? `Cấp ${capHt}` : "" });
  }
  return kq;
}

/** Đặt quyền giao việc cấp 1 hoặc cấp 2 cho một tài khoản (ghi đè so với mặc định của vai trò) */
export async function datCapGiao(tx: Q, id: number, cap: 1 | 2) {
  const r = (await tx`SELECT vai_tro, quyen FROM nguoi_dung WHERE id = ${id}`)[0];
  const def = new Set(QUYEN_MAC_DINH[r.vai_tro] || []);
  const them = new Set<string>(((r.quyen?.them as string[]) || []).filter((x) => x !== "cv.giao" && x !== "cv.giao_cap1" && x !== "cv.giao_cap2"));
  const bo = new Set<string>(((r.quyen?.bo as string[]) || []).filter((x) => x !== "cv.giao" && x !== "cv.giao_cap1" && x !== "cv.giao_cap2"));
  const want = cap === 1 ? ["cv.giao_cap1"] : ["cv.giao_cap2"];
  for (const q of ["cv.giao_cap1", "cv.giao_cap2"]) {
    if (want.includes(q) && !def.has(q)) them.add(q);
    if (!want.includes(q) && def.has(q)) bo.add(q);
  }
  const v = them.size || bo.size ? { them: [...them], bo: [...bo] } : null;
  await tx`UPDATE nguoi_dung SET quyen = ${v ? tx.json(v) : null} WHERE id = ${id}`;
}
