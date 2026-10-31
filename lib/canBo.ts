// Chức vụ, cấp bậc và quy tắc giao việc theo cấp (cấp 1 / cấp 2), chặn giao ngược lên cấp trên.
import { tinhQuyen } from "./quyen";

export const khongDau = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();

/** Bậc của chức vụ trong một đơn vị: 1 cấp trưởng, 2 cấp phó, 3 cán bộ, công chức, nhân viên */
export function bacChucVu(cv: string | null | undefined): 1 | 2 | 3 {
  const s = khongDau(cv || "");
  if (!s) return 3;
  if (/^pho |^pho$|^chi huy pho/.test(s)) return 2;
  if (/^(chu tich|bi thu|truong |giam doc|chanh van phong|chu nhiem|chi huy truong|to truong)/.test(s) || s === "truong ban" || s === "truong phong") return 1;
  return 3;
}
export const TEN_BAC: Record<number, string> = { 1: "Cấp trưởng", 2: "Cấp phó", 3: "Cán bộ, nhân viên" };

/** Thứ bậc chức vụ Đảng (số nhỏ là cao hơn); 99 = không có */
export function bacDang(cv: string | null | undefined): number {
  const s = khongDau(cv || "");
  if (!s) return 99;
  if (/^bi thu dang uy|^btdu$/.test(s)) return 1;
  if (/^pho bi thu thuong truc|^pbt tt/.test(s)) return 2;
  if (/^pho bi thu dang uy|^pbt du|^pbt$/.test(s)) return 3;
  if (/ban thuong vu|^uv btv/.test(s)) return 4;
  if (/^dang uy vien|^duv$/.test(s)) return 5;
  if (/^bi thu chi bo/.test(s)) return 6;
  if (/^pho bi thu chi bo/.test(s)) return 7;
  if (/^chi uy vien/.test(s)) return 8;
  return 50;
}

/** Chuẩn hóa chữ viết tắt hay dùng trong danh sách cán bộ */
const VIET_TAT_DANG: [RegExp, string][] = [
  [/^btdu$/, "Bí thư Đảng ủy"],
  [/^pbt ?tt ?du$/, "Phó Bí thư thường trực Đảng ủy"],
  [/^pbt ?du$/, "Phó Bí thư Đảng ủy"],
  [/^uv ?btv ?du$/, "Ủy viên Ban Thường vụ Đảng ủy"],
  [/^duv$/, "Đảng ủy viên"],
];
export function chuanChucVuDang(s: string | null | undefined): string | null {
  const t = (s || "").trim();
  if (!t) return null;
  const k = khongDau(t);
  for (const [re, v] of VIET_TAT_DANG) if (re.test(k)) return v;
  return t;
}
export function chuanChucVu(s: string | null | undefined): string | null {
  let t = (s || "").replace(/\s+/g, " ").trim();
  if (!t) return null;
  t = t.replace(/\bCAP\b/, "Công an phường").replace(/Trường Phòng/i, "Trưởng phòng").replace(/Trưởng Phòng/, "Trưởng phòng");
  return t;
}

/** Vai trò mặc định suy ra từ chức vụ chính quyền */
export function vaiTroTheoChucVu(cv: string | null, tenDonVi: string | null, cvDang: string | null): string {
  const dv = khongDau(tenDonVi || "");
  const c = khongDau(cv || "");
  if (!c && bacDang(cvDang) <= 3) return "lanh_dao";
  if (/uy ban nhan dan|^ubnd/.test(dv) && /chu tich/.test(c)) return "lanh_dao";
  if (bacChucVu(cv) <= 2) return "truong_don_vi";
  return "cong_chuc";
}

/** Lĩnh vực phụ trách gợi ý theo đơn vị (cơ cấu tổ chức cấp xã theo Nghị định 150/2025/NĐ-CP) */
export function linhVucTheoDonVi(tenDonVi: string | null, co: string[]): string[] {
  const d = khongDau(tenDonVi || "");
  const pick = (...xs: string[]) => xs.filter((x) => co.includes(x));
  if (/van phong hdnd|van phong hoi dong nhan dan/.test(d)) return pick("Nội vụ, xây dựng chính quyền", "Tư pháp, hộ tịch", "Thanh tra, tiếp công dân, khiếu nại tố cáo", "Cải cách hành chính", "Chuyển đổi số, chính quyền số");
  if (/phong kinh te/.test(d)) return pick("Kinh tế, tài chính", "Đất đai", "Xây dựng, giao thông", "Nông nghiệp, môi trường", "Tài nguyên nước, khoáng sản", "Phòng chống thiên tai, tìm kiếm cứu nạn", "Khoa học, công nghệ, chuyển đổi số", "Kinh tế số, thương mại điện tử");
  if (/phong van hoa/.test(d)) return pick("Văn hóa - xã hội", "Văn hóa, thể thao, du lịch", "Giáo dục, y tế", "Lao động, thương binh và xã hội", "Dân tộc, tôn giáo", "Thông tin, truyền thông", "Thi đua, khen thưởng", "Xã hội số, kỹ năng số");
  if (/ban van hoa/.test(d)) return pick("Văn hóa - xã hội");
  if (/hanh chinh cong/.test(d)) return pick("Cải cách hành chính", "Chuyển đổi số, chính quyền số", "Dữ liệu số, Đề án 06");
  if (/cung ung dich vu|dich vu su nghiep/.test(d)) return pick("Văn hóa, thể thao, du lịch", "Nông nghiệp, môi trường", "Thông tin, truyền thông");
  if (/quan ly du an/.test(d)) return pick("Xây dựng, giao thông");
  if (/tram y te/.test(d)) return pick("Giáo dục, y tế");
  if (/cong an/.test(d)) return pick("An ninh, quốc phòng", "Dữ liệu số, Đề án 06", "Hạ tầng số, an toàn thông tin");
  if (/quan su/.test(d)) return pick("An ninh, quốc phòng", "Phòng chống thiên tai, tìm kiếm cứu nạn");
  if (/kiem tra dang/.test(d)) return pick("Công tác Đảng, đoàn thể", "Thanh tra, tiếp công dân, khiếu nại tố cáo");
  if (/xay dung dang|van phong dang|dang uy/.test(d)) return pick("Công tác Đảng, đoàn thể");
  if (/mttq|mat tran/.test(d)) return pick("Công tác Đảng, đoàn thể", "Dân tộc, tôn giáo");
  if (/doan|phu nu|cuu chien binh|nong dan/.test(d)) return pick("Công tác Đảng, đoàn thể");
  return [];
}

/** Loại đơn vị suy ra từ tên */
export function loaiDonVi(ten: string): string {
  const d = khongDau(ten);
  if (/^dang uy|^uy ban nhan dan|^hoi dong nhan dan|^ubnd|^hdnd/.test(d)) return "lanh_dao";
  if (/kiem tra dang|xay dung dang|van phong dang/.test(d)) return "khoi_dang";
  if (/mttq|mat tran|^doan |hoi lien hiep|phu nu|cuu chien binh|nong dan/.test(d)) return "doan_the";
  if (/cong an|quan su/.test(d)) return "luc_luong";
  if (/trung tam|tram y te|quan ly du an/.test(d)) return "trung_tam";
  if (/khu pho|^thon|^ap /.test(d)) return "thon";
  return "phong";
}

/** Tên đăng nhập: chữ cái đầu họ, đệm + tên (không dấu), ví dụ Nguyễn Văn Lam → nvlam */
export function taoTenDangNhap(hoTen: string, daCo: Set<string>): string {
  const w = khongDau(hoTen).replace(/[^a-z ]/g, "").split(" ").filter(Boolean);
  const base = (w.slice(0, -1).map((x) => x[0]).join("") + (w[w.length - 1] || "canbo")).slice(0, 30) || "canbo";
  let u = base;
  for (let i = 2; daCo.has(u) || u.length < 3; i++) u = `${base}${i}`;
  daCo.add(u);
  return u;
}

// ===================== Quy tắc giao việc =====================

export type NguoiGiaoViec = {
  id: number;
  ho_ten?: string;
  vai_tro: string;
  quyen: unknown;
  id_don_vi: number | null;
  chuc_vu: string | null;
  id_don_vi_kiem_nhiem: number | null;
  chuc_vu_kiem_nhiem: string | null;
  chuc_vu_dang: string | null;
  pham_vi?: { loai?: string; don_vi?: number[] } | null;
};
type DonVi = { id: number; id_cha: number | null };

export const capGiao = (q: Set<string> | string[]) => {
  const s = q instanceof Set ? q : new Set(q);
  return s.has("cv.giao_cap1") ? 1 : s.has("cv.giao_cap2") ? 2 : 0;
};

const viTri = (p: NguoiGiaoViec) =>
  [
    { dv: p.id_don_vi, bac: bacChucVu(p.chuc_vu) },
    { dv: p.id_don_vi_kiem_nhiem, bac: bacChucVu(p.chuc_vu_kiem_nhiem) },
  ].filter((x): x is { dv: number; bac: 1 | 2 | 3 } => !!x.dv);

function conCuaDonVi(units: DonVi[], root: number): Set<number> {
  const out = new Set([root]);
  const q = [root];
  while (q.length) {
    const x = q.shift()!;
    for (const u of units) if (u.id_cha === x && !out.has(u.id)) (out.add(u.id), q.push(u.id));
  }
  return out;
}

/** Người giao có cao hơn người nhận trong cùng một đơn vị (chức vụ cao hơn, hoặc người nhận thuộc đơn vị cấp dưới) */
function caoHonTrongDonVi(giao: NguoiGiaoViec, nhan: NguoiGiaoViec, units: DonVi[], dvThem: number[] = []): boolean {
  const vn = viTri(nhan);
  for (const g of viTri(giao)) {
    const sub = conCuaDonVi(units, g.dv);
    for (const n of vn) {
      if (n.dv === g.dv && n.bac > g.bac) return true;
      if (n.dv !== g.dv && sub.has(n.dv) && g.bac <= 2) return true;
    }
  }
  // đơn vị được quản trị phân công theo dõi thêm
  for (const d of dvThem) {
    const sub = conCuaDonVi(units, d);
    if (vn.some((n) => sub.has(n.dv) && !viTri(giao).some((g) => g.dv === n.dv && n.bac <= g.bac))) return true;
  }
  return false;
}

/**
 * Kiểm tra người giao có được giao việc cho người nhận không. Trả về null nếu được, hoặc lý do không được.
 *  - Không có quyền giao việc cấp 1 / cấp 2: không được giao cho người khác.
 *  - Không giao ngược lên những người đã giao việc này xuống (chuỗi giao việc).
 *  - Cấp 1: giao cho mọi cán bộ trong phạm vi; riêng người cũng có quyền cấp 1 thì chỉ khi
 *    chức vụ Đảng của người nhận thấp hơn, hoặc cùng đơn vị và chức vụ chính quyền thấp hơn.
 *  - Cấp 2: chỉ giao cho cán bộ thuộc đơn vị mình phụ trách (đơn vị chính, kiêm nhiệm, đơn vị con)
 *    có chức vụ thấp hơn; không giao cho người có quyền cấp 1.
 */
export function lyDoKhongGiao(
  giao: NguoiGiaoViec & { quyenHieuLuc: Set<string> },
  nhan: NguoiGiaoViec,
  units: DonVi[],
  chuoiTren: number[] = [],
): string | null {
  if (nhan.id === giao.id) return null;
  const ten = nhan.ho_ten || "người này";
  if (chuoiTren.includes(nhan.id)) return `Không giao ngược lại cho ${ten}: người này đã giao việc này xuống. Hãy thực hiện hoặc trả lại việc.`;
  if (giao.quyenHieuLuc.has("qt.du_lieu")) return null;
  const cap = capGiao(giao.quyenHieuLuc);
  if (!cap) return "Bạn không có quyền giao việc cho người khác.";
  const capNhan = capGiao(tinhQuyen(nhan.vai_tro, nhan.quyen as never));
  const dvThem = giao.pham_vi?.loai === "don_vi" ? (giao.pham_vi.don_vi || []).map(Number) : [];
  if (cap === 1) {
    if (capNhan !== 1) return null;
    if (bacDang(giao.chuc_vu_dang) < bacDang(nhan.chuc_vu_dang)) return null;
    if (caoHonTrongDonVi(giao, nhan, units)) return null;
    return `Không giao việc cho ${ten}: cùng cấp hoặc cấp trên (cùng có quyền giao việc cấp 1).`;
  }
  if (capNhan === 1) return `Không giao việc cho ${ten}: người này là cấp trên (có quyền giao việc cấp 1).`;
  if (caoHonTrongDonVi(giao, nhan, units, dvThem)) return null;
  return `Giao việc cấp 2 chỉ giao cho cán bộ cấp dưới thuộc đơn vị mình phụ trách; ${ten} không thuộc diện này.`;
}
