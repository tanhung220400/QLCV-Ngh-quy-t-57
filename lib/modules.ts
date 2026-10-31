import type postgres from "postgres";
import type { User } from "./auth";

type Q = postgres.Sql | postgres.TransactionSql;

export type MoDun = {
  id: number;
  ma: string;
  ten: string;
  mo_ta: string | null;
  bieu_tuong: string;
  mau: string;
  loai: "he_thong" | "nhom" | "du_lieu" | "lien_ket";
  duong_dan: string | null;
  id_cha: number | null;
  thu_tu: number;
  hien: boolean;
  vai_tro_xem: string[];
  vai_tro_nhap: string[];
  pham_vi: "toan_xa" | "don_vi";
};

export type Truong = {
  id: number;
  id_mo_dun: number;
  khoa: string;
  ten: string;
  kieu: string;
  bat_buoc: boolean;
  tuy_chon: string[];
  goi_y: string | null;
  hien_danh_sach: boolean;
  thu_tu: number;
};

export const KIEU_TRUONG: Record<string, string> = {
  van_ban: "Văn bản ngắn",
  doan_van: "Đoạn văn (nhiều dòng)",
  so: "Số",
  ngay: "Ngày",
  lua_chon: "Chọn một trong danh sách",
  nhieu_lua_chon: "Chọn nhiều",
  co_khong: "Có / Không",
  so_dien_thoai: "Số điện thoại",
  email: "Email",
  don_vi: "Đơn vị, thôn (trong phần mềm)",
  nguoi: "Cán bộ (trong phần mềm)",
  linh_vuc: "Lĩnh vực (theo danh mục)",
  toa_do: "Vị trí GPS",
  lien_ket: "Đường dẫn web",
};

export const MAU_MODULE: Record<string, { bg: string; fg: string; ring: string; label: string }> = {
  blue: { bg: "bg-blue-50", fg: "text-blue-600", ring: "ring-blue-100", label: "Xanh dương" },
  sky: { bg: "bg-sky-50", fg: "text-sky-600", ring: "ring-sky-100", label: "Xanh da trời" },
  teal: { bg: "bg-teal-50", fg: "text-teal-600", ring: "ring-teal-100", label: "Xanh ngọc" },
  emerald: { bg: "bg-emerald-50", fg: "text-emerald-600", ring: "ring-emerald-100", label: "Xanh lá" },
  amber: { bg: "bg-amber-50", fg: "text-amber-600", ring: "ring-amber-100", label: "Vàng" },
  orange: { bg: "bg-orange-50", fg: "text-orange-600", ring: "ring-orange-100", label: "Cam" },
  rose: { bg: "bg-rose-50", fg: "text-rose-600", ring: "ring-rose-100", label: "Hồng" },
  violet: { bg: "bg-violet-50", fg: "text-violet-600", ring: "ring-violet-100", label: "Tím" },
  indigo: { bg: "bg-indigo-50", fg: "text-indigo-600", ring: "ring-indigo-100", label: "Chàm" },
  slate: { bg: "bg-slate-100", fg: "text-slate-600", ring: "ring-slate-200", label: "Xám" },
};

/** Quyền chức năng cần có để thấy module hệ thống */
export const QUYEN_HE_THONG: Record<string, string | string[] | null> = {
  tong_quan: null,
  cong_viec: null,
  giao_viec: ["cv.giao_cap1", "cv.giao_cap2"],
  chi_tieu: "ct.xem",
  bao_cao: "bc.xem",
  tra_cuu: "bc.tra_cuu",
  bieu_do: "bc.bieu_do",
  danh_gia_kpi: ["bc.kpi", "bc.kpi_don_vi"],
  thong_bao: null,
};

export const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50) || "module";

type TruongMau = { khoa: string; ten: string; kieu: string; bat_buoc?: boolean; tuy_chon?: string[]; goi_y?: string; hien_danh_sach?: boolean };
type ModuleMau = { ma: string; ten: string; mo_ta: string; bieu_tuong: string; mau: string; pham_vi?: "toan_xa" | "don_vi"; truong: TruongMau[] };

/** Mẫu module nhập liệu phục vụ Nghị quyết 57 và quản lý địa bàn */
export const MAU_MODULE_NQ57: ModuleMau[] = [
  {
    ma: "to-cong-nghe-so",
    ten: "Tổ công nghệ số cộng đồng",
    mo_ta: "Danh sách Tổ công nghệ số cộng đồng ở các khu phố và kết quả hỗ trợ người dân",
    bieu_tuong: "users",
    mau: "teal",
    pham_vi: "don_vi",
    truong: [
      { khoa: "ten_to", ten: "Tên tổ", kieu: "van_ban", bat_buoc: true },
      { khoa: "thon", ten: "Khu phố", kieu: "don_vi", bat_buoc: true },
      { khoa: "to_truong", ten: "Tổ trưởng", kieu: "van_ban", bat_buoc: true },
      { khoa: "sdt", ten: "Số điện thoại tổ trưởng", kieu: "so_dien_thoai" },
      { khoa: "so_thanh_vien", ten: "Số thành viên", kieu: "so" },
      { khoa: "so_luot_ho_tro", ten: "Số lượt hỗ trợ người dân (lũy kế)", kieu: "so" },
      { khoa: "trang_thai", ten: "Tình trạng hoạt động", kieu: "lua_chon", tuy_chon: ["Hoạt động tốt", "Hoạt động", "Chưa hiệu quả", "Ngừng hoạt động"] },
      { khoa: "ghi_chu", ten: "Ghi chú", kieu: "doan_van", hien_danh_sach: false },
    ],
  },
  {
    ma: "binh-dan-hoc-vu-so",
    ten: "Lớp Bình dân học vụ số",
    mo_ta: "Các lớp phổ cập kỹ năng số cho người dân theo phong trào “Bình dân học vụ số”",
    bieu_tuong: "book",
    mau: "indigo",
    truong: [
      { khoa: "ten_lop", ten: "Tên lớp, nội dung", kieu: "van_ban", bat_buoc: true },
      { khoa: "ngay", ten: "Ngày tổ chức", kieu: "ngay", bat_buoc: true },
      { khoa: "dia_diem", ten: "Địa điểm (thôn)", kieu: "don_vi" },
      { khoa: "doi_tuong", ten: "Đối tượng", kieu: "nhieu_lua_chon", tuy_chon: ["Cán bộ, công chức", "Người dân", "Người cao tuổi", "Hộ kinh doanh", "Học sinh, thanh niên", "Phụ nữ"] },
      { khoa: "chu_de", ten: "Chủ đề", kieu: "nhieu_lua_chon", tuy_chon: ["Dịch vụ công trực tuyến", "VNeID", "Thanh toán không dùng tiền mặt", "An toàn trên mạng", "Thương mại điện tử", "Trí tuệ nhân tạo cơ bản", "Kỹ năng số cơ bản"] },
      { khoa: "so_nguoi", ten: "Số người tham gia", kieu: "so", bat_buoc: true },
      { khoa: "giang_vien", ten: "Người hướng dẫn", kieu: "van_ban" },
    ],
  },
  {
    ma: "ha-tang-so-thon",
    ten: "Hạ tầng số tại thôn",
    mo_ta: "Hiện trạng sóng di động, cáp quang, wifi công cộng, camera an ninh ở từng thôn (mô hình Thôn số)",
    bieu_tuong: "wifi",
    mau: "sky",
    truong: [
      { khoa: "thon", ten: "Khu phố", kieu: "don_vi", bat_buoc: true },
      { khoa: "song_4g5g", ten: "Phủ sóng di động", kieu: "lua_chon", tuy_chon: ["5G", "4G toàn thôn", "4G một phần", "Chưa ổn định"] },
      { khoa: "cap_quang", ten: "Tỷ lệ hộ có cáp quang (%)", kieu: "so" },
      { khoa: "wifi_cong_cong", ten: "Có điểm wifi công cộng", kieu: "co_khong" },
      { khoa: "camera", ten: "Số camera an ninh", kieu: "so" },
      { khoa: "nha_van_hoa_so", ten: "Nhà văn hóa có thiết bị họp trực tuyến", kieu: "co_khong" },
      { khoa: "danh_gia", ten: "Đánh giá Thôn số", kieu: "lua_chon", tuy_chon: ["Đạt", "Đang xây dựng", "Chưa đạt"] },
      { khoa: "vi_tri", ten: "Vị trí", kieu: "toa_do", hien_danh_sach: false },
    ],
  },
  {
    ma: "sang-kien-doi-moi",
    ten: "Sáng kiến, đổi mới sáng tạo",
    mo_ta: "Sáng kiến, giải pháp cải tiến, ứng dụng công nghệ của cán bộ, người dân, doanh nghiệp",
    bieu_tuong: "lightbulb",
    mau: "amber",
    truong: [
      { khoa: "ten", ten: "Tên sáng kiến", kieu: "van_ban", bat_buoc: true },
      { khoa: "tac_gia", ten: "Tác giả", kieu: "van_ban", bat_buoc: true },
      { khoa: "don_vi", ten: "Đơn vị", kieu: "don_vi" },
      { khoa: "linh_vuc", ten: "Lĩnh vực", kieu: "linh_vuc" },
      { khoa: "nam", ten: "Năm", kieu: "so" },
      { khoa: "cap_cong_nhan", ten: "Cấp công nhận", kieu: "lua_chon", tuy_chon: ["Cấp xã", "Cấp tỉnh", "Chưa công nhận"] },
      { khoa: "hieu_qua", ten: "Hiệu quả mang lại", kieu: "doan_van", hien_danh_sach: false },
    ],
  },
  {
    ma: "san-pham-so-ocop",
    ten: "Sản phẩm lên sàn thương mại điện tử",
    mo_ta: "Sản phẩm OCOP, nông sản của hộ, hợp tác xã được đưa lên sàn thương mại điện tử",
    bieu_tuong: "store",
    mau: "emerald",
    truong: [
      { khoa: "san_pham", ten: "Sản phẩm", kieu: "van_ban", bat_buoc: true },
      { khoa: "chu_the", ten: "Chủ thể (hộ, HTX, doanh nghiệp)", kieu: "van_ban", bat_buoc: true },
      { khoa: "thon", ten: "Thôn", kieu: "don_vi" },
      { khoa: "ocop", ten: "Hạng OCOP", kieu: "lua_chon", tuy_chon: ["5 sao", "4 sao", "3 sao", "Chưa xếp hạng"] },
      { khoa: "san_tmdt", ten: "Sàn thương mại điện tử", kieu: "nhieu_lua_chon", tuy_chon: ["Postmart", "Voso", "Shopee", "TikTok Shop", "Lazada", "Zalo OA", "Khác"] },
      { khoa: "ma_qr", ten: "Có mã QR truy xuất nguồn gốc", kieu: "co_khong" },
      { khoa: "lien_ket", ten: "Đường dẫn gian hàng", kieu: "lien_ket", hien_danh_sach: false },
    ],
  },
  {
    ma: "phan-anh-kien-nghi",
    ten: "Phản ánh, kiến nghị của người dân",
    mo_ta: "Tiếp nhận và theo dõi xử lý phản ánh, kiến nghị (trực tiếp, qua Zalo, tổng đài, ứng dụng)",
    bieu_tuong: "megaphone",
    mau: "rose",
    truong: [
      { khoa: "nguoi_phan_anh", ten: "Người phản ánh", kieu: "van_ban", bat_buoc: true },
      { khoa: "sdt", ten: "Số điện thoại", kieu: "so_dien_thoai" },
      { khoa: "thon", ten: "Thôn", kieu: "don_vi" },
      { khoa: "noi_dung", ten: "Nội dung phản ánh", kieu: "doan_van", bat_buoc: true },
      { khoa: "kenh", ten: "Kênh tiếp nhận", kieu: "lua_chon", tuy_chon: ["Trực tiếp", "Điện thoại", "Zalo", "Ứng dụng phản ánh", "Cổng dịch vụ công"] },
      { khoa: "linh_vuc", ten: "Lĩnh vực", kieu: "linh_vuc" },
      { khoa: "ngay_nhan", ten: "Ngày tiếp nhận", kieu: "ngay", bat_buoc: true },
      { khoa: "can_bo", ten: "Cán bộ xử lý", kieu: "nguoi" },
      { khoa: "trang_thai", ten: "Tình trạng", kieu: "lua_chon", tuy_chon: ["Mới tiếp nhận", "Đang xử lý", "Đã xử lý", "Chuyển cấp trên"], bat_buoc: true },
      { khoa: "ket_qua", ten: "Kết quả xử lý", kieu: "doan_van", hien_danh_sach: false },
    ],
  },
];

/** Thêm các chức năng hệ thống mới (khi nâng cấp phiên bản) vào menu đã có */
export async function ensureSystemModules(tx: Q) {
  if (!(await tx`SELECT 1 FROM mo_dun WHERE ma = 'bieu_do'`).length) {
    const g = (await tx`SELECT id FROM mo_dun WHERE ma = 'chi-tieu-bao-cao'`)[0]?.id ?? null;
    const after = (await tx`SELECT thu_tu FROM mo_dun WHERE ma = 'bao_cao'`)[0]?.thu_tu ?? 2;
    await tx`UPDATE mo_dun SET thu_tu = thu_tu + 1 WHERE id_cha IS NOT DISTINCT FROM ${g} AND thu_tu > ${after}`;
    await tx`INSERT INTO mo_dun (ma, ten, mo_ta, bieu_tuong, mau, loai, duong_dan, id_cha, thu_tu)
      VALUES ('bieu_do', 'Biểu đồ tiến độ đơn vị', 'So sánh tiến độ thực hiện công việc giữa các đơn vị', 'chart', 'sky', 'he_thong', '/bieu-do', ${g}, ${after + 1})`;
  }
  if (!(await tx`SELECT 1 FROM mo_dun WHERE ma = 'danh_gia_kpi'`).length) {
    const g = (await tx`SELECT id FROM mo_dun WHERE ma = 'chi-tieu-bao-cao'`)[0]?.id ?? null;
    const after = (await tx`SELECT thu_tu FROM mo_dun WHERE ma = 'bieu_do'`)[0]?.thu_tu ?? 3;
    await tx`UPDATE mo_dun SET thu_tu = thu_tu + 1 WHERE id_cha IS NOT DISTINCT FROM ${g} AND thu_tu > ${after}`;
    await tx`INSERT INTO mo_dun (ma, ten, mo_ta, bieu_tuong, mau, loai, duong_dan, id_cha, thu_tu)
      VALUES ('danh_gia_kpi', 'Đánh giá KPI', 'Kết quả thực hiện công việc của cán bộ và đơn vị: vượt tiến độ, đúng hạn, trễ hạn, quá hạn, tồn việc', 'flag', 'amber', 'he_thong', '/danh-gia-kpi', ${g}, ${after + 1})`;
  }
}

/** Đổi tên gọi "Thôn, tổ dân phố" → "Khu phố" trong dữ liệu đã có (chạy một lần khi nâng cấp) */
export async function renameKhuPho(tx: Q) {
  await tx`UPDATE mo_dun_truong SET ten = 'Khu phố' WHERE ten IN ('Thôn, tổ dân phố', 'Thôn/tổ dân phố')`;
  await tx`UPDATE mo_dun SET mo_ta = replace(replace(mo_ta, 'thôn, tổ dân phố', 'khu phố'), 'Thôn, tổ dân phố', 'Khu phố') WHERE mo_ta ILIKE '%thôn, tổ dân phố%'`;
  await tx`UPDATE nguoi_dung SET chuc_vu = 'Trưởng khu phố' WHERE chuc_vu IN ('Trưởng thôn', 'Trưởng thôn, tổ dân phố')`;
}

/** Tạo menu mặc định: module hệ thống, nhóm, module mẫu Nghị quyết 57 (chạy một lần khi nâng cấp) */
export async function seedModules(tx: Q) {
  const has = await tx`SELECT count(*)::int AS n FROM mo_dun`;
  if (has[0].n > 0) return;
  const grp = async (ma: string, ten: string, icon: string, mau: string, thu_tu: number, mo_ta: string) =>
    (await tx`INSERT INTO mo_dun (ma, ten, mo_ta, bieu_tuong, mau, loai, thu_tu) VALUES (${ma}, ${ten}, ${mo_ta}, ${icon}, ${mau}, 'nhom', ${thu_tu}) RETURNING id`)[0].id as number;
  const sys = async (ma: string, ten: string, path: string, icon: string, mau: string, cha: number, thu_tu: number, mo_ta: string) =>
    tx`INSERT INTO mo_dun (ma, ten, mo_ta, bieu_tuong, mau, loai, duong_dan, id_cha, thu_tu) VALUES (${ma}, ${ten}, ${mo_ta}, ${icon}, ${mau}, 'he_thong', ${path}, ${cha}, ${thu_tu})`;
  const g1 = await grp("dieu-hanh", "Điều hành", "layers", "blue", 1, "Giao việc, theo dõi tiến độ, thông báo");
  await sys("tong_quan", "Tổng quan", "/", "home", "blue", g1, 1, "Tình hình chung, việc cần làm");
  await sys("cong_viec", "Công việc", "/viec", "list", "indigo", g1, 2, "Danh sách, Kanban, lịch công việc");
  await sys("giao_viec", "Giao việc", "/viec/moi", "plus", "blue", g1, 3, "Giao nhiệm vụ mới");
  await sys("thong_bao", "Thông báo", "/thong-bao", "bell", "amber", g1, 4, "Nhắc việc, trao đổi, duyệt");
  const g2 = await grp("chi-tieu-bao-cao", "Chỉ tiêu & báo cáo", "target", "emerald", 2, "Chỉ tiêu Nghị quyết, báo cáo, tra cứu");
  await sys("chi_tieu", "Chỉ tiêu", "/chi-tieu", "target", "emerald", g2, 1, "Chỉ tiêu Nghị quyết HĐND, chỉ tiêu tỉnh giao");
  await sys("bao_cao", "Báo cáo", "/bao-cao", "chart", "teal", g2, 2, "Báo cáo tuần, chỉ tiêu, kết luận họp");
  await sys("tra_cuu", "Tra cứu, tổng hợp", "/tra-cuu", "search", "violet", g2, 3, "Hỏi bằng câu tiếng Việt hoặc giọng nói");
  const g3 = await grp("nghi-quyet-57", "Nghị quyết 57", "cpu", "violet", 3, "Khoa học, công nghệ, đổi mới sáng tạo, chuyển đổi số");
  const g4 = await grp("quan-ly-dia-ban", "Quản lý địa bàn", "map", "orange", 4, "Thông tin, phản ánh trên địa bàn xã");
  let i = 0;
  for (const m of MAU_MODULE_NQ57) {
    const parent = m.ma === "phan-anh-kien-nghi" ? g4 : g3;
    await createModuleFromTemplate(tx, m, parent, ++i);
  }
}

export async function createModuleFromTemplate(tx: Q, m: ModuleMau, parent: number | null, thu_tu: number, ma?: string) {
  const [r] = await tx`INSERT INTO mo_dun (ma, ten, mo_ta, bieu_tuong, mau, loai, id_cha, thu_tu, pham_vi)
    VALUES (${ma || m.ma}, ${m.ten}, ${m.mo_ta}, ${m.bieu_tuong}, ${m.mau}, 'du_lieu', ${parent}, ${thu_tu}, ${m.pham_vi || "toan_xa"}) RETURNING id`;
  let j = 0;
  for (const f of m.truong) {
    await tx`INSERT INTO mo_dun_truong (id_mo_dun, khoa, ten, kieu, bat_buoc, tuy_chon, goi_y, hien_danh_sach, thu_tu)
      VALUES (${r.id}, ${f.khoa}, ${f.ten}, ${f.kieu}, ${!!f.bat_buoc}, ${f.tuy_chon || []}, ${f.goi_y || null}, ${f.hien_danh_sach !== false}, ${++j})`;
  }
  return r.id as number;
}

// ---------- Truy cập ----------
export function canSeeModule(user: User, m: MoDun): boolean {
  if (!m.hien && !user.quyen.includes("qt.mo_dun")) return false;
  if (m.loai === "he_thong") {
    const need = QUYEN_HE_THONG[m.ma];
    if (need && ![need].flat().some((q) => user.quyen.includes(q))) return false;
  }
  if (user.quyen.includes("qt.mo_dun") || user.quyen.includes("qt.du_lieu")) return true;
  return !m.vai_tro_xem.length || m.vai_tro_xem.includes(user.vai_tro);
}

export function canEnterModule(user: User, m: MoDun): boolean {
  if (m.loai !== "du_lieu") return false;
  if (user.quyen.includes("qt.du_lieu")) return true;
  if (!canSeeModule(user, m)) return false;
  return !m.vai_tro_nhap.length || m.vai_tro_nhap.includes(user.vai_tro);
}

export function moduleHref(m: Pick<MoDun, "loai" | "ma" | "duong_dan">): string {
  if (m.loai === "he_thong" || m.loai === "lien_ket") return m.duong_dan || "/";
  return `/m/${m.ma}`;
}

export type MenuNode = MoDun & { con: MenuNode[]; href: string };

/** Cây menu theo quyền của người dùng */
export async function menuTree(sql: Q, user: User): Promise<MenuNode[]> {
  const rows = (await sql`SELECT * FROM mo_dun ORDER BY thu_tu, id`) as unknown as MoDun[];
  const visible = rows.filter((m) => m.hien && canSeeModule(user, m));
  const node = (m: MoDun): MenuNode => ({
    ...m,
    href: moduleHref(m),
    con: visible.filter((c) => c.id_cha === m.id).map(node),
  });
  return visible
    .filter((m) => !m.id_cha || !visible.some((p) => p.id === m.id_cha))
    .map(node)
    .filter((n) => n.loai !== "nhom" || n.con.length > 0);
}
