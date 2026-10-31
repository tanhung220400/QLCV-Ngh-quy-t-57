// Danh mục quyền chức năng và phạm vi dữ liệu.
// Mỗi vai trò có bộ quyền mặc định; quản trị có thể thêm/bớt từng quyền cho từng tài khoản.

export const NHOM_QUYEN: { nhom: string; quyen: [string, string][] }[] = [
  {
    nhom: "Công việc",
    quyen: [
      ["cv.giao", "Giao việc mới"],
      ["cv.nhap_nhanh", "Giao nhanh từ kết luận họp"],
      ["cv.duyet", "Duyệt kết quả, duyệt gia hạn (trong phạm vi được xem)"],
      ["cv.quan_ly", "Sửa, đổi hạn, tạm dừng, hủy việc (trong phạm vi được xem)"],
      ["cv.xuat", "Xuất danh sách công việc ra Excel"],
    ],
  },
  {
    nhom: "Chỉ tiêu",
    quyen: [
      ["ct.xem", "Xem chỉ tiêu (trong phạm vi được xem)"],
      ["ct.quan_ly", "Thêm, sửa, phân rã, nhập chỉ tiêu từ Excel"],
      ["ct.nhap_so_lieu", "Cập nhật số liệu chỉ tiêu được phụ trách"],
      ["ct.xac_nhan", "Xác nhận số liệu của đơn vị"],
    ],
  },
  {
    nhom: "Báo cáo",
    quyen: [
      ["bc.xem", "Xem mục Báo cáo"],
      ["bc.xuat", "Xuất báo cáo Word, Excel, PDF"],
      ["bc.danh_gia", "Xem số liệu đánh giá cán bộ"],
      ["bc.tra_cuu", "Tra cứu, tổng hợp số liệu theo yêu cầu"],
      ["bc.dashboard", "Xem dashboard tổng hợp (đơn vị, xu hướng, chỉ tiêu)"],
      ["bc.bieu_do", "Xem biểu đồ so sánh tiến độ giữa các đơn vị"],
    ],
  },
  {
    nhom: "Quản trị",
    quyen: [
      ["qt.du_lieu", "Thêm, sửa, xóa mọi nội dung (công việc, chỉ tiêu, dữ liệu module), thùng rác"],
      ["qt.mo_dun", "Thiết kế module, menu, trường nhập liệu"],
      ["qt.nguoi_dung", "Quản lý tài khoản, phân quyền"],
      ["qt.co_cau", "Quản lý cơ cấu tổ chức, danh mục, ngày nghỉ"],
      ["qt.cai_dat", "Cài đặt hệ thống, mẫu báo cáo, SMS"],
      ["qt.nhat_ky", "Xem nhật ký thao tác"],
    ],
  },
];

export const TAT_CA_QUYEN = NHOM_QUYEN.flatMap((n) => n.quyen.map((q) => q[0]));

export const QUYEN_MAC_DINH: Record<string, string[]> = {
  lanh_dao: ["cv.giao", "cv.nhap_nhanh", "cv.duyet", "cv.quan_ly", "cv.xuat", "ct.xem", "ct.quan_ly", "ct.xac_nhan", "bc.xem", "bc.xuat", "bc.danh_gia", "bc.tra_cuu", "bc.dashboard", "bc.bieu_do"],
  tong_hop: ["cv.giao", "cv.nhap_nhanh", "cv.xuat", "ct.xem", "ct.quan_ly", "bc.xem", "bc.xuat", "bc.danh_gia", "bc.tra_cuu", "bc.dashboard", "bc.bieu_do", "qt.nhat_ky"],
  truong_don_vi: ["cv.giao", "cv.duyet", "cv.quan_ly", "cv.xuat", "ct.xem", "ct.nhap_so_lieu", "ct.xac_nhan", "bc.xem", "bc.xuat", "bc.tra_cuu", "bc.dashboard"],
  cong_chuc: ["ct.xem", "ct.nhap_so_lieu", "bc.xem", "bc.tra_cuu"],
  truong_thon: ["ct.xem", "ct.nhap_so_lieu"],
  quan_tri: [
    "cv.giao", "cv.nhap_nhanh", "cv.duyet", "cv.quan_ly", "cv.xuat",
    "ct.xem", "ct.quan_ly", "ct.nhap_so_lieu", "ct.xac_nhan",
    "bc.xem", "bc.xuat", "bc.danh_gia", "bc.tra_cuu", "bc.dashboard", "bc.bieu_do",
    "qt.du_lieu", "qt.mo_dun", "qt.nguoi_dung", "qt.co_cau", "qt.cai_dat", "qt.nhat_ky",
  ],
};

export type PhamVi = { loai: "toan_xa" | "linh_vuc" | "don_vi" | "ca_nhan"; linh_vuc: string[]; don_vi: number[] };

export const LOAI_PHAM_VI: Record<PhamVi["loai"], string> = {
  toan_xa: "Toàn xã",
  linh_vuc: "Theo lĩnh vực được phân công",
  don_vi: "Theo đơn vị được phân công",
  ca_nhan: "Chỉ việc của bản thân",
};

/** Phạm vi mặc định theo vai trò (chức vụ + đơn vị) */
export function phamViMacDinh(vai_tro: string, id_don_vi: number | null, linh_vuc: string[]): PhamVi {
  if (vai_tro === "tong_hop" || vai_tro === "quan_tri") return { loai: "toan_xa", linh_vuc: [], don_vi: [] };
  if (vai_tro === "lanh_dao") return linh_vuc.length ? { loai: "linh_vuc", linh_vuc, don_vi: [] } : { loai: "toan_xa", linh_vuc: [], don_vi: [] };
  if (vai_tro === "truong_don_vi" && id_don_vi) return { loai: "don_vi", linh_vuc: [], don_vi: [id_don_vi] };
  return { loai: "ca_nhan", linh_vuc: [], don_vi: [] };
}

export function tinhQuyen(vai_tro: string, ghi_de: { them?: string[]; bo?: string[] } | null | undefined): Set<string> {
  const s = new Set(QUYEN_MAC_DINH[vai_tro] || []);
  for (const q of ghi_de?.them || []) if (TAT_CA_QUYEN.includes(q)) s.add(q);
  for (const q of ghi_de?.bo || []) s.delete(q);
  return s;
}

export function tinhPhamVi(vai_tro: string, id_don_vi: number | null, linh_vuc: string[], ghi_de: Partial<PhamVi> | null | undefined): PhamVi {
  if (ghi_de?.loai && LOAI_PHAM_VI[ghi_de.loai]) {
    return {
      loai: ghi_de.loai,
      linh_vuc: ghi_de.loai === "linh_vuc" ? (ghi_de.linh_vuc?.length ? ghi_de.linh_vuc : linh_vuc) : [],
      don_vi: ghi_de.loai === "don_vi" ? (ghi_de.don_vi?.length ? ghi_de.don_vi.map(Number) : id_don_vi ? [id_don_vi] : []) : [],
    };
  }
  return phamViMacDinh(vai_tro, id_don_vi, linh_vuc);
}
