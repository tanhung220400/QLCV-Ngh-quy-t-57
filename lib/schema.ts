// Mô hình dữ liệu theo mục 8 của đặc tả. Chạy lại nhiều lần không sao (IF NOT EXISTS).
export const SCHEMA_VERSION = 2;

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS don_vi (
  id SERIAL PRIMARY KEY,
  ten TEXT NOT NULL,
  loai TEXT NOT NULL DEFAULT 'phong',          -- lanh_dao / phong / trung_tam / thon
  id_cha INT REFERENCES don_vi(id),
  thu_tu INT NOT NULL DEFAULT 0,
  hoat_dong BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS nguoi_dung (
  id SERIAL PRIMARY KEY,
  ho_ten TEXT NOT NULL,
  ten_dang_nhap TEXT NOT NULL UNIQUE,
  mat_khau TEXT NOT NULL,
  sdt TEXT,
  email TEXT,
  id_don_vi INT REFERENCES don_vi(id),
  chuc_vu TEXT,
  vai_tro TEXT NOT NULL DEFAULT 'cong_chuc',  -- lanh_dao / truong_don_vi / cong_chuc / tong_hop / truong_thon / quan_tri
  linh_vuc_phu_trach TEXT[] NOT NULL DEFAULT '{}', -- rỗng = toàn bộ (Chủ tịch, Bí thư)
  trang_thai TEXT NOT NULL DEFAULT 'hoat_dong', -- hoat_dong / khoa
  otp_bi_mat TEXT,
  otp_bat BOOLEAN NOT NULL DEFAULT FALSE,
  doi_mat_khau BOOLEAN NOT NULL DEFAULT FALSE,
  phien INT NOT NULL DEFAULT 1,
  tao_luc TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS uy_quyen (
  id SERIAL PRIMARY KEY,
  id_nguoi_uy_quyen INT NOT NULL REFERENCES nguoi_dung(id),
  id_nguoi_duoc INT NOT NULL REFERENCES nguoi_dung(id),
  tu_ngay DATE NOT NULL,
  den_ngay DATE NOT NULL,
  ghi_chu TEXT,
  huy BOOLEAN NOT NULL DEFAULT FALSE,
  tao_luc TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS danh_muc (
  id SERIAL PRIMARY KEY,
  loai TEXT NOT NULL,      -- linh_vuc / nguon_giao / san_pham / nhom_chi_tieu / don_vi_tinh / nguon_chi_tieu
  ten TEXT NOT NULL,
  thu_tu INT NOT NULL DEFAULT 0,
  UNIQUE (loai, ten)
);

CREATE TABLE IF NOT EXISTS cong_viec (
  id SERIAL PRIMARY KEY,
  ten TEXT NOT NULL,
  mo_ta TEXT,
  nguon_giao TEXT NOT NULL,
  so_hieu_vb TEXT,
  cuoc_hop TEXT,
  linh_vuc TEXT NOT NULL,
  uu_tien TEXT NOT NULL DEFAULT 'thuong',       -- thuong / khan / hoa_toc
  han TIMESTAMPTZ NOT NULL,
  han_co_gio BOOLEAN NOT NULL DEFAULT FALSE,
  han_goc TIMESTAMPTZ NOT NULL,
  san_pham TEXT NOT NULL,
  trang_thai TEXT NOT NULL DEFAULT 'moi_giao',  -- moi_giao / da_nhan / dang_thuc_hien / cho_duyet / hoan_thanh / tra_lai / tam_dung / huy
  phan_tram INT NOT NULL DEFAULT 0,
  phan_tram_tay BOOLEAN NOT NULL DEFAULT FALSE,
  id_nguoi_giao INT NOT NULL REFERENCES nguoi_dung(id),
  id_nguoi_tao INT NOT NULL REFERENCES nguoi_dung(id),
  id_chu_tri INT NOT NULL REFERENCES nguoi_dung(id),
  id_don_vi_chu_tri INT REFERENCES don_vi(id),
  id_nguoi_thuc_hien INT REFERENCES nguoi_dung(id),
  id_cha INT REFERENCES cong_viec(id),
  nhom_giao TEXT,
  dinh_ky TEXT,                                 -- null / tuan / thang / quy
  id_goc_dinh_ky INT REFERENCES cong_viec(id),
  da_tao_ky_sau BOOLEAN NOT NULL DEFAULT FALSE,
  ly_do_tra_lai TEXT,
  ket_qua TEXT,
  so_lan_gia_han INT NOT NULL DEFAULT 0,
  so_lan_lam_lai INT NOT NULL DEFAULT 0,
  ngay_nhan TIMESTAMPTZ,
  ngay_bao_cao TIMESTAMPTZ,
  ngay_hoan_thanh TIMESTAMPTZ,
  tao_luc TIMESTAMPTZ NOT NULL DEFAULT now(),
  cap_nhat_luc TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cv_chu_tri ON cong_viec(id_chu_tri);
CREATE INDEX IF NOT EXISTS cv_giao ON cong_viec(id_nguoi_giao);
CREATE INDEX IF NOT EXISTS cv_don_vi ON cong_viec(id_don_vi_chu_tri);
CREATE INDEX IF NOT EXISTS cv_han ON cong_viec(han);
CREATE INDEX IF NOT EXISTS cv_cha ON cong_viec(id_cha);

CREATE TABLE IF NOT EXISTS cong_viec_thanh_vien (
  id_cong_viec INT NOT NULL REFERENCES cong_viec(id),
  id_nguoi_dung INT NOT NULL REFERENCES nguoi_dung(id),
  vai_tro TEXT NOT NULL,                        -- phoi_hop / theo_doi
  PRIMARY KEY (id_cong_viec, id_nguoi_dung, vai_tro)
);

CREATE TABLE IF NOT EXISTS checklist (
  id SERIAL PRIMARY KEY,
  id_cong_viec INT NOT NULL REFERENCES cong_viec(id),
  noi_dung TEXT NOT NULL,
  da_xong BOOLEAN NOT NULL DEFAULT FALSE,
  thu_tu INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS gia_han (
  id SERIAL PRIMARY KEY,
  id_cong_viec INT NOT NULL REFERENCES cong_viec(id),
  han_cu TIMESTAMPTZ NOT NULL,
  han_moi TIMESTAMPTZ NOT NULL,
  ly_do TEXT NOT NULL,
  trang_thai_duyet TEXT NOT NULL DEFAULT 'cho_duyet', -- cho_duyet / dong_y / tu_choi
  id_nguoi_xin INT NOT NULL REFERENCES nguoi_dung(id),
  id_nguoi_duyet INT REFERENCES nguoi_dung(id),
  y_kien_duyet TEXT,
  tao_luc TIMESTAMPTZ NOT NULL DEFAULT now(),
  duyet_luc TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS binh_luan (
  id SERIAL PRIMARY KEY,
  id_cong_viec INT NOT NULL REFERENCES cong_viec(id),
  id_nguoi_dung INT NOT NULL REFERENCES nguoi_dung(id),
  noi_dung TEXT NOT NULL,
  loai TEXT NOT NULL DEFAULT 'binh_luan',       -- binh_luan / tien_do / he_thong
  thoi_gian TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bl_cv ON binh_luan(id_cong_viec);

CREATE TABLE IF NOT EXISTS tep_dinh_kem (
  id SERIAL PRIMARY KEY,
  doi_tuong TEXT NOT NULL,                      -- cong_viec / so_lieu
  id_doi_tuong INT NOT NULL,
  ten_tep TEXT NOT NULL,
  duong_dan TEXT,
  du_lieu BYTEA,
  loai_mime TEXT,
  kich_thuoc INT,
  gps TEXT,
  thoi_gian_chup TIMESTAMPTZ,
  la_minh_chung BOOLEAN NOT NULL DEFAULT FALSE,
  id_nguoi_tai INT REFERENCES nguoi_dung(id),
  tao_luc TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tep_dt ON tep_dinh_kem(doi_tuong, id_doi_tuong);

CREATE TABLE IF NOT EXISTS chi_tieu (
  id SERIAL PRIMARY KEY,
  ten TEXT NOT NULL,
  nguon TEXT NOT NULL,
  nhom TEXT NOT NULL,
  don_vi_tinh TEXT NOT NULL,
  loai TEXT NOT NULL DEFAULT 'cong_don',        -- cong_don / ty_le / dat_khong
  chieu_tot TEXT NOT NULL DEFAULT 'cao',        -- cao / thap
  ke_hoach_nam NUMERIC NOT NULL,
  gia_tri_dau_nam NUMERIC,
  nam INT NOT NULL,
  han DATE NOT NULL,
  id_phu_trach INT REFERENCES nguoi_dung(id),
  id_don_vi_phu_trach INT REFERENCES don_vi(id),
  id_lanh_dao INT REFERENCES nguoi_dung(id),
  ky_cap_nhat TEXT NOT NULL DEFAULT 'thang',    -- tuan / thang / quy
  ngay_chot INT NOT NULL DEFAULT 25,
  id_cha INT REFERENCES chi_tieu(id),
  thu_tu INT NOT NULL DEFAULT 0,
  huy BOOLEAN NOT NULL DEFAULT FALSE,
  tao_luc TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chi_tieu_ke_hoach_ky (
  id_chi_tieu INT NOT NULL REFERENCES chi_tieu(id),
  ky TEXT NOT NULL,                             -- '2026-03' (tháng) hoặc '2026-Q1'
  gia_tri NUMERIC NOT NULL,
  PRIMARY KEY (id_chi_tieu, ky)
);

CREATE TABLE IF NOT EXISTS chi_tieu_so_lieu (
  id SERIAL PRIMARY KEY,
  id_chi_tieu INT NOT NULL REFERENCES chi_tieu(id),
  ky TEXT NOT NULL,
  gia_tri NUMERIC NOT NULL,
  ghi_chu TEXT,
  id_nguoi_nhap INT NOT NULL REFERENCES nguoi_dung(id),
  xac_nhan BOOLEAN NOT NULL DEFAULT FALSE,
  id_nguoi_xac_nhan INT REFERENCES nguoi_dung(id),
  thoi_gian TIMESTAMPTZ NOT NULL DEFAULT now(),
  hieu_luc BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS sl_ct ON chi_tieu_so_lieu(id_chi_tieu);

CREATE TABLE IF NOT EXISTS cong_viec_chi_tieu (
  id_cong_viec INT NOT NULL REFERENCES cong_viec(id),
  id_chi_tieu INT NOT NULL REFERENCES chi_tieu(id),
  PRIMARY KEY (id_cong_viec, id_chi_tieu)
);

CREATE TABLE IF NOT EXISTS nhat_ky (
  id BIGSERIAL PRIMARY KEY,
  id_nguoi_dung INT,
  hanh_dong TEXT NOT NULL,
  doi_tuong TEXT NOT NULL,
  id_doi_tuong INT,
  gia_tri_cu JSONB,
  gia_tri_moi JSONB,
  thoi_gian TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS nk_dt ON nhat_ky(doi_tuong, id_doi_tuong);

-- Nhật ký chỉ được ghi thêm: chặn sửa và xóa ở mức cơ sở dữ liệu.
CREATE OR REPLACE FUNCTION nhat_ky_chi_ghi_them() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Nhật ký thao tác không được sửa hoặc xóa';
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS nhat_ky_khoa ON nhat_ky;
CREATE TRIGGER nhat_ky_khoa BEFORE UPDATE OR DELETE ON nhat_ky
  FOR EACH ROW EXECUTE FUNCTION nhat_ky_chi_ghi_them();
DROP TRIGGER IF EXISTS nhat_ky_khoa_truncate ON nhat_ky;
CREATE TRIGGER nhat_ky_khoa_truncate BEFORE TRUNCATE ON nhat_ky
  FOR EACH STATEMENT EXECUTE FUNCTION nhat_ky_chi_ghi_them();

CREATE TABLE IF NOT EXISTS thong_bao (
  id SERIAL PRIMARY KEY,
  id_nguoi_nhan INT NOT NULL REFERENCES nguoi_dung(id),
  loai TEXT NOT NULL,
  tieu_de TEXT NOT NULL,
  noi_dung TEXT,
  doi_tuong TEXT,
  id_doi_tuong INT,
  da_doc BOOLEAN NOT NULL DEFAULT FALSE,
  kenh TEXT NOT NULL DEFAULT 'ung_dung',
  khoa TEXT UNIQUE,
  tao_luc TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tb_nhan ON thong_bao(id_nguoi_nhan, da_doc);

CREATE TABLE IF NOT EXISTS ngay_nghi (
  ngay DATE PRIMARY KEY,
  ten TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cai_dat (
  khoa TEXT PRIMARY KEY,
  gia_tri JSONB NOT NULL
);

-- ===== Phiên bản 2: phân quyền chi tiết, SMS, quên mật khẩu, lĩnh vực chỉ tiêu, tra cứu không dấu =====
ALTER TABLE nguoi_dung ADD COLUMN IF NOT EXISTS quyen JSONB;          -- {"them": [...], "bo": [...]} so với mặc định của vai trò
ALTER TABLE nguoi_dung ADD COLUMN IF NOT EXISTS pham_vi JSONB;        -- {"loai": "toan_xa|linh_vuc|don_vi|ca_nhan", "linh_vuc": [], "don_vi": []}
ALTER TABLE chi_tieu ADD COLUMN IF NOT EXISTS linh_vuc TEXT;
UPDATE chi_tieu SET linh_vuc = CASE nhom
    WHEN 'Kinh tế' THEN 'Kinh tế, tài chính'
    WHEN 'Văn hóa - xã hội' THEN 'Văn hóa - xã hội'
    WHEN 'Quốc phòng - an ninh' THEN 'An ninh, quốc phòng'
    WHEN 'Xây dựng chính quyền' THEN 'Nội vụ, xây dựng chính quyền'
    ELSE NULL END
  WHERE linh_vuc IS NULL;

CREATE TABLE IF NOT EXISTS sms_hang_doi (
  id SERIAL PRIMARY KEY,
  id_nguoi_nhan INT REFERENCES nguoi_dung(id),
  sdt TEXT NOT NULL,
  noi_dung TEXT NOT NULL,
  loai TEXT NOT NULL,
  trang_thai TEXT NOT NULL DEFAULT 'cho',   -- cho / da_gui / loi / bo_qua
  so_lan INT NOT NULL DEFAULT 0,
  loi TEXT,
  ma_nha_mang TEXT,
  khoa TEXT UNIQUE,
  tao_luc TIMESTAMPTZ NOT NULL DEFAULT now(),
  gui_luc TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS sms_cho ON sms_hang_doi(trang_thai, tao_luc);

CREATE TABLE IF NOT EXISTS dat_lai_mat_khau (
  id SERIAL PRIMARY KEY,
  id_nguoi_dung INT NOT NULL REFERENCES nguoi_dung(id),
  ma_hash TEXT NOT NULL,
  het_han TIMESTAMPTZ NOT NULL,
  so_lan_thu INT NOT NULL DEFAULT 0,
  da_dung BOOLEAN NOT NULL DEFAULT FALSE,
  tao_luc TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bỏ dấu tiếng Việt để tìm kiếm không phân biệt dấu (không cần extension unaccent)
CREATE OR REPLACE FUNCTION bo_dau(t TEXT) RETURNS TEXT AS $$
  SELECT translate(lower(coalesce(t, '')),
    'àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ',
    'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd')
$$ LANGUAGE sql IMMUTABLE;
`;