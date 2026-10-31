export const VAI_TRO: Record<string, string> = {
  lanh_dao: "Lãnh đạo phường",
  truong_don_vi: "Trưởng đơn vị",
  cong_chuc: "Công chức, viên chức",
  tong_hop: "Thường trực tổng hợp",
  truong_thon: "Trưởng khu phố",
  quan_tri: "Quản trị hệ thống",
};

export const TRANG_THAI: Record<string, string> = {
  moi_giao: "Mới giao",
  da_nhan: "Đã nhận",
  dang_thuc_hien: "Đang thực hiện",
  cho_duyet: "Chờ duyệt",
  hoan_thanh: "Hoàn thành",
  tra_lai: "Trả lại",
  tam_dung: "Tạm dừng",
  huy: "Hủy",
};

/** Các trạng thái còn đang theo dõi (chưa kết thúc) */
export const DANG_MO = ["moi_giao", "da_nhan", "dang_thuc_hien", "cho_duyet", "tra_lai", "tam_dung"];
export const KANBAN_COT = ["moi_giao", "da_nhan", "dang_thuc_hien", "cho_duyet", "hoan_thanh"];

export const UU_TIEN: Record<string, string> = {
  thuong: "Thường",
  khan: "Khẩn",
  hoa_toc: "Hỏa tốc",
};

export const LOAI_DON_VI: Record<string, string> = {
  lanh_dao: "Lãnh đạo",
  phong: "Phòng",
  trung_tam: "Trung tâm",
  khoi_dang: "Cơ quan Đảng",
  doan_the: "Mặt trận, đoàn thể",
  luc_luong: "Công an, quân sự",
  thon: "Khu phố",
};

export const LOAI_CHI_TIEU: Record<string, string> = {
  cong_don: "Cộng dồn",
  ty_le: "Tỷ lệ",
  dat_khong: "Đạt / không đạt",
};

export const KY_CAP_NHAT: Record<string, string> = { tuan: "Tuần", thang: "Tháng", quy: "Quý" };
export const DINH_KY: Record<string, string> = { tuan: "Hằng tuần", thang: "Hằng tháng", quy: "Hằng quý" };

export const DANH_MUC_MAC_DINH: Record<string, string[]> = {
  linh_vuc: [
    "Đất đai",
    "Xây dựng, giao thông",
    "Nông nghiệp, môi trường",
    "Kinh tế, tài chính",
    "Văn hóa - xã hội",
    "Giáo dục, y tế",
    "An ninh, quốc phòng",
    "Nội vụ, xây dựng chính quyền",
    "Khoa học, công nghệ, chuyển đổi số",
    "Cải cách hành chính",
    "Chuyển đổi số, chính quyền số",
    "Hạ tầng số, an toàn thông tin",
    "Dữ liệu số, Đề án 06",
    "Kinh tế số, thương mại điện tử",
    "Xã hội số, kỹ năng số",
    "Đổi mới sáng tạo, sáng kiến",
    "Tư pháp, hộ tịch",
    "Lao động, thương binh và xã hội",
    "Văn hóa, thể thao, du lịch",
    "Thông tin, truyền thông",
    "Tài nguyên nước, khoáng sản",
    "Phòng chống thiên tai, tìm kiếm cứu nạn",
    "Dân tộc, tôn giáo",
    "Thanh tra, tiếp công dân, khiếu nại tố cáo",
    "Thi đua, khen thưởng",
    "Công tác Đảng, đoàn thể",
  ],
  nguon_giao: ["Chỉ đạo trực tiếp", "Kết luận họp", "Văn bản của tỉnh", "Kế hoạch năm", "Nghị quyết HĐND xã"],
  san_pham: ["Báo cáo", "Tờ trình", "Kế hoạch", "Biên bản", "Số liệu", "Quyết định", "Công văn"],
  nhom_chi_tieu: ["Kinh tế", "Văn hóa - xã hội", "Quốc phòng - an ninh", "Xây dựng chính quyền"],
  don_vi_tinh: ["%", "hộ", "người", "triệu đồng", "km", "ha", "công trình", "tiêu chí"],
  nguon_chi_tieu: ["Nghị quyết HĐND xã", "Chỉ tiêu tỉnh giao", "Kế hoạch UBND xã"],
  chuc_vu_dang: ["Bí thư Đảng ủy", "Phó Bí thư thường trực Đảng ủy", "Phó Bí thư Đảng ủy", "Ủy viên Ban Thường vụ Đảng ủy", "Đảng ủy viên", "Bí thư chi bộ", "Phó Bí thư chi bộ", "Chi ủy viên"],
  chuc_vu: [
    "Chủ tịch", "Phó Chủ tịch thường trực", "Phó Chủ tịch",
    "Bí thư", "Phó Bí thư",
    "Trưởng Công an phường", "Phó Trưởng Công an phường",
    "Chỉ huy trưởng", "Chỉ huy phó",
    "Trưởng ban", "Phó Trưởng ban", "Phó Trưởng ban chuyên trách",
    "Chủ nhiệm", "Phó Chủ nhiệm",
    "Chánh văn phòng", "Phó Chánh văn phòng",
    "Giám đốc", "Phó Giám đốc",
    "Trưởng phòng", "Phó Trưởng phòng",
    "Trưởng khu phố", "Phó Trưởng khu phố",
    "Chuyên viên", "Công chức", "Viên chức", "Nhân viên",
  ],
  chuc_danh_bcd: ["Trưởng ban", "Phó Trưởng ban thường trực", "Phó Trưởng ban", "Ủy viên"],
  chuc_danh_tgv: ["Tổ trưởng", "Tổ phó", "Thành viên"],
};

export const CAI_DAT_MAC_DINH = {
  ten_don_vi: "UBND xã",
  /** Tên hiện ở góc trên bên trái, màn hình chào, trang đăng nhập (để trống = dùng tên cơ quan ban hành) */
  ten_hien_thi: "",
  ten_cap_tren: "",
  dia_danh: "",
  chuc_vu_ky: "CHỦ TỊCH",
  nguoi_ky: "",
  noi_nhan: "- Thường trực Đảng ủy;\n- Thường trực HĐND xã;\n- Lãnh đạo UBND xã;\n- Lưu: VT.",
  nguong_vang: 3, // số ngày làm việc
  nhac_truoc: [3, 1], // ngày làm việc trước hạn
  bao_cap_tren_sau: 3, // quá hạn bao nhiêu ngày làm việc thì báo người giao + lãnh đạo lĩnh vực
  nhac_nhan_viec_gio: 24,
  nguong_nguy_co: 10, // điểm %
  gio_tom_tat: "07:30",
  bat_buoc_otp: false,
};
export type CaiDat = typeof CAI_DAT_MAC_DINH;
