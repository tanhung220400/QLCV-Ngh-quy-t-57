import type postgres from "postgres";
import { db } from "./db";
import { hashPassword } from "./auth";
import { seedCatalogs, NGAY_NGHI_MAC_DINH, saveSettings } from "./settings";
import { writeLog } from "./log";
import { seedDemoNQ57 } from "./seedNq57";
import { addWorkingDays, fromVN, vnDate, addDays } from "./time";

export const DEMO_PASSWORD = "Demo@2026";

export async function seedAll(o: { ten_xa: string; ho_ten: string; username: string; password: string; demo: boolean }) {
  const sql = await db();
  await sql.begin(async (tx) => {
    await seedCatalogs(tx);
    for (const [d, t] of NGAY_NGHI_MAC_DINH) await tx`INSERT INTO ngay_nghi (ngay, ten) VALUES (${d}, ${t}) ON CONFLICT DO NOTHING`;
    const [ld] = await tx`INSERT INTO don_vi (ten, loai, thu_tu) VALUES ('Lãnh đạo xã', 'lanh_dao', 0) RETURNING id`;
    const [vp] = await tx`INSERT INTO don_vi (ten, loai, thu_tu) VALUES ('Văn phòng HĐND và UBND', 'phong', 1) RETURNING id`;
    const [admin] = await tx`INSERT INTO nguoi_dung (ho_ten, ten_dang_nhap, mat_khau, id_don_vi, chuc_vu, vai_tro)
      VALUES (${o.ho_ten}, ${o.username}, ${await hashPassword(o.password)}, ${vp.id}, 'Cán bộ CNTT', 'quan_tri') RETURNING id`;
    await writeLog(tx, admin.id, "khoi_tao", "he_thong", null, null, { ten_xa: o.ten_xa, du_lieu_mau: o.demo });
    if (o.demo) {
      await seedDemo(tx, ld.id, vp.id);
      await seedDemoNQ57(tx, admin.id);
    }
  });
  await saveSettings({ ten_don_vi: o.ten_xa.toUpperCase().startsWith("UBND") ? o.ten_xa : `UBND ${o.ten_xa}` });
}

type Tx = postgres.TransactionSql;

async function seedDemo(tx: Tx, ld: number, vp: number) {
  const pw = await hashPassword(DEMO_PASSWORD);
  const unit = async (ten: string, loai: string, thu_tu: number) => (await tx`INSERT INTO don_vi (ten, loai, thu_tu) VALUES (${ten}, ${loai}, ${thu_tu}) RETURNING id`)[0].id as number;
  const kt = await unit("Phòng Kinh tế", "phong", 2);
  const vh = await unit("Phòng Văn hóa - Xã hội", "phong", 3);
  const hcc = await unit("Trung tâm Phục vụ hành chính công", "trung_tam", 4);
  const th1 = await unit("Thôn Đông", "thon", 5);
  const th2 = await unit("Thôn Tây", "thon", 6);
  const user = async (ho_ten: string, u: string, dv: number, chuc_vu: string, vai_tro: string, lv: string[] = []) =>
    (await tx`INSERT INTO nguoi_dung (ho_ten, ten_dang_nhap, mat_khau, id_don_vi, chuc_vu, vai_tro, linh_vuc_phu_trach, sdt)
      VALUES (${ho_ten}, ${u}, ${pw}, ${dv}, ${chuc_vu}, ${vai_tro}, ${lv}, ${"09" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}) RETURNING id`)[0].id as number;
  const bt = await user("Nguyễn Văn Bình", "bithu", ld, "Bí thư Đảng ủy", "lanh_dao");
  const ctx = await user("Trần Thị Châu", "chutich", ld, "Chủ tịch UBND", "lanh_dao");
  const pkt = await user("Lê Văn Phúc", "pct.kinhte", ld, "Phó Chủ tịch UBND", "lanh_dao", ["Đất đai", "Xây dựng, giao thông", "Nông nghiệp, môi trường", "Kinh tế, tài chính"]);
  const pvx = await user("Phạm Thị Hoa", "pct.vanhoa", ld, "Phó Chủ tịch UBND", "lanh_dao", ["Văn hóa - xã hội", "Giáo dục, y tế", "Cải cách hành chính"]);
  const vph = await user("Đỗ Minh Tâm", "vanphong", vp, "Chánh Văn phòng", "tong_hop");
  const tkt = await user("Hoàng Văn Khánh", "tp.kinhte", kt, "Trưởng phòng Kinh tế", "truong_don_vi");
  const k1 = await user("Vũ Thị Lan", "cv.kinhte1", kt, "Chuyên viên địa chính", "cong_chuc");
  const k2 = await user("Ngô Văn Hùng", "cv.kinhte2", kt, "Chuyên viên nông nghiệp", "cong_chuc");
  const tvh = await user("Bùi Thị Mai", "tp.vanhoa", vh, "Trưởng phòng Văn hóa - Xã hội", "truong_don_vi");
  const v1 = await user("Đặng Văn Nam", "cv.vanhoa1", vh, "Chuyên viên y tế, BHXH", "cong_chuc");
  const thc = await user("Lý Thị Ngọc", "gd.hcc", hcc, "Giám đốc Trung tâm", "truong_don_vi");
  const t1 = await user("Mai Văn Quang", "thon.dong", th1, "Trưởng khu phố", "truong_thon");
  await user("Cao Thị Sen", "thon.tay", th2, "Trưởng khu phố", "truong_thon");
  void bt;

  const today = vnDate();
  const H = new Set<string>();
  const wd = (n: number) => (n >= 0 ? addWorkingDays(today, n, H) : addDays(today, Math.floor(n * 1.4)));
  type T = {
    ten: string; nguon: string; lv: string; uu?: string; han: number; sp: string; giao: number; chu: number; dv: number | null;
    st: string; pct?: number; thuc?: number; hop?: string; vb?: string; ph?: number[]; dk?: string; xong?: number;
  };
  const tasks: T[] = [
    { ten: "Rà soát, thống kê diện tích đất công do xã quản lý", nguon: "Văn bản của tỉnh", vb: "125/UBND-TNMT", lv: "Đất đai", uu: "khan", han: -4, sp: "Báo cáo", giao: pkt, chu: tkt, dv: kt, st: "dang_thuc_hien", pct: 60, thuc: k1 },
    { ten: "Lập kế hoạch giải phóng mặt bằng tuyến đường liên thôn", nguon: "Kết luận họp", hop: "Giao ban UBND tuần 42", lv: "Xây dựng, giao thông", han: 12, sp: "Kế hoạch", giao: ctx, chu: tkt, dv: kt, st: "dang_thuc_hien", pct: 30, ph: [t1] },
    { ten: "Báo cáo tình hình sản xuất vụ Đông", nguon: "Kế hoạch năm", lv: "Nông nghiệp, môi trường", han: 2, sp: "Báo cáo", giao: pkt, chu: k2, dv: kt, st: "da_nhan", dk: "thang" },
    { ten: "Kiểm tra công trình xây dựng không phép tại thôn Đông", nguon: "Chỉ đạo trực tiếp", lv: "Xây dựng, giao thông", uu: "hoa_toc", han: 1, sp: "Biên bản", giao: ctx, chu: k1, dv: kt, st: "moi_giao", ph: [t1] },
    { ten: "Tổng hợp số liệu thu ngân sách quý III", nguon: "Văn bản của tỉnh", vb: "88/STC-NS", lv: "Kinh tế, tài chính", han: -12, sp: "Số liệu", giao: pkt, chu: tkt, dv: kt, st: "hoan_thanh", xong: -14 },
    { ten: "Tuyên truyền vận động người dân tham gia BHYT hộ gia đình", nguon: "Nghị quyết HĐND xã", lv: "Giáo dục, y tế", han: 20, sp: "Báo cáo", giao: pvx, chu: tvh, dv: vh, st: "dang_thuc_hien", pct: 45, thuc: v1 },
    { ten: "Chuẩn bị hồ sơ công nhận xã đạt chuẩn văn hóa", nguon: "Kế hoạch năm", lv: "Văn hóa - xã hội", han: -2, sp: "Tờ trình", giao: pvx, chu: tvh, dv: vh, st: "cho_duyet", pct: 100 },
    { ten: "Rà soát danh sách hộ nghèo, cận nghèo năm 2026", nguon: "Văn bản của tỉnh", vb: "210/SLĐTBXH", lv: "Văn hóa - xã hội", han: 8, sp: "Số liệu", giao: pvx, chu: v1, dv: vh, st: "dang_thuc_hien", pct: 20, ph: [t1] },
    { ten: "Báo cáo tỷ lệ hồ sơ thủ tục hành chính giải quyết đúng hạn", nguon: "Kế hoạch năm", lv: "Cải cách hành chính", han: 4, sp: "Báo cáo", giao: ctx, chu: thc, dv: hcc, st: "da_nhan", dk: "thang" },
    { ten: "Triển khai thanh toán không dùng tiền mặt tại Trung tâm HCC", nguon: "Nghị quyết HĐND xã", lv: "Khoa học, công nghệ, chuyển đổi số", han: -7, sp: "Báo cáo", giao: ctx, chu: thc, dv: hcc, st: "dang_thuc_hien", pct: 70 },
    { ten: "Xây dựng báo cáo kết quả thực hiện Nghị quyết 57 quý IV", nguon: "Văn bản của tỉnh", vb: "57-NQ/TW", lv: "Khoa học, công nghệ, chuyển đổi số", han: 25, sp: "Báo cáo", giao: bt, chu: vph, dv: vp, st: "moi_giao" },
    { ten: "Chuẩn bị nội dung kỳ họp HĐND xã cuối năm", nguon: "Kết luận họp", hop: "Họp Thường trực HĐND tháng 10", lv: "Nội vụ, xây dựng chính quyền", han: 15, sp: "Tờ trình", giao: bt, chu: vph, dv: vp, st: "dang_thuc_hien", pct: 25 },
    { ten: "Xử lý điểm tập kết rác tự phát ven kênh thôn Tây", nguon: "Chỉ đạo trực tiếp", lv: "Nông nghiệp, môi trường", uu: "khan", han: -1, sp: "Báo cáo", giao: pkt, chu: k2, dv: kt, st: "dang_thuc_hien", pct: 50 },
    { ten: "Cập nhật số liệu dân số, lao động trên hệ thống của tỉnh", nguon: "Văn bản của tỉnh", vb: "301/UBND-VX", lv: "Văn hóa - xã hội", han: -20, sp: "Số liệu", giao: pvx, chu: v1, dv: vh, st: "hoan_thanh", xong: -18 },
    { ten: "Kiểm tra an toàn phòng cháy tại chợ xã", nguon: "Kết luận họp", hop: "Giao ban UBND tuần 42", lv: "An ninh, quốc phòng", han: 6, sp: "Biên bản", giao: ctx, chu: tkt, dv: kt, st: "tra_lai" },
  ];
  const ids: number[] = [];
  for (const t of tasks) {
    const hanDay = wd(t.han);
    const han = fromVN(hanDay, "17:00");
    const created = fromVN(addDays(today, -Math.max(5, Math.abs(t.han) + 7)), "08:00");
    const xong = t.xong != null ? fromVN(addDays(today, t.xong), "15:00") : null;
    const [r] = await tx`
      INSERT INTO cong_viec (ten, nguon_giao, so_hieu_vb, cuoc_hop, linh_vuc, uu_tien, han, han_goc, san_pham, trang_thai, phan_tram,
        id_nguoi_giao, id_nguoi_tao, id_chu_tri, id_don_vi_chu_tri, id_nguoi_thuc_hien, dinh_ky, ngay_nhan, ngay_hoan_thanh, tao_luc,
        ly_do_tra_lai, ngay_bao_cao)
      VALUES (${t.ten}, ${t.nguon}, ${t.vb || null}, ${t.hop || null}, ${t.lv}, ${t.uu || "thuong"}, ${han}, ${han}, ${t.sp}, ${t.st},
        ${t.st === "hoan_thanh" ? 100 : t.pct || 0}, ${t.giao}, ${t.hop ? vph : t.giao}, ${t.chu}, ${t.dv}, ${t.thuc || null}, ${t.dk || null},
        ${t.st === "moi_giao" || t.st === "tra_lai" ? null : created}, ${xong}, ${created},
        ${t.st === "tra_lai" ? "Nội dung thuộc thẩm quyền Công an xã, đề nghị giao Công an xã chủ trì" : null},
        ${t.st === "cho_duyet" ? new Date() : null})
      RETURNING id`;
    ids.push(r.id);
    for (const p of t.ph || []) await tx`INSERT INTO cong_viec_thanh_vien VALUES (${r.id}, ${p}, 'phoi_hop')`;
    await writeLog(tx, t.giao, "giao_viec", "cong_viec", r.id, null, { ten: t.ten, du_lieu_mau: true });
  }
  // Việc con và checklist cho việc giải phóng mặt bằng
  const gpmb = ids[1];
  const subs = [
    ["Đo đạc, cắm mốc giới phạm vi giải phóng mặt bằng", k1, 5, "hoan_thanh"],
    ["Kiểm đếm tài sản, vật kiến trúc trên đất", k1, 9, "dang_thuc_hien"],
    ["Họp dân lấy ý kiến phương án bồi thường", t1, 11, "da_nhan"],
  ] as const;
  for (const [ten, chu, n, st] of subs) {
    const han = fromVN(wd(n), "17:00");
    await tx`INSERT INTO cong_viec (ten, nguon_giao, linh_vuc, han, han_goc, san_pham, trang_thai, phan_tram, id_nguoi_giao, id_nguoi_tao, id_chu_tri, id_don_vi_chu_tri, id_cha, ngay_nhan, ngay_hoan_thanh)
      VALUES (${ten}, 'Kết luận họp', 'Xây dựng, giao thông', ${han}, ${han}, 'Biên bản', ${st}, ${st === "hoan_thanh" ? 100 : 0}, ${tkt}, ${tkt}, ${chu}, ${null}, ${gpmb},
        now(), ${st === "hoan_thanh" ? new Date() : null})`;
  }
  for (const [i, nd] of ["Thu thập bản đồ địa chính", "Lập danh sách hộ bị ảnh hưởng", "Dự thảo kế hoạch trình UBND"].entries())
    await tx`INSERT INTO checklist (id_cong_viec, noi_dung, da_xong, thu_tu) VALUES (${gpmb}, ${nd}, ${i < 2}, ${i})`;
  await tx`UPDATE cong_viec SET phan_tram = 50 WHERE id = ${gpmb}`;
  await tx`INSERT INTO binh_luan (id_cong_viec, id_nguoi_dung, noi_dung) VALUES
    (${ids[0]}, ${pkt}, 'Đề nghị phòng khẩn trương hoàn thành, tỉnh đang đôn đốc.'),
    (${ids[0]}, ${tkt}, 'Đã giao đồng chí Lan rà soát, dự kiến xong trong tuần.')`;
  await tx`INSERT INTO gia_han (id_cong_viec, han_cu, han_moi, ly_do, id_nguoi_xin)
    SELECT id, han, han + interval '5 days', 'Chờ số liệu đo đạc từ Văn phòng đăng ký đất đai', ${tkt} FROM cong_viec WHERE id = ${ids[0]}`;

  // Chỉ tiêu Nghị quyết HĐND xã
  const nam = Number(today.slice(0, 4));
  const curMonth = Number(today.slice(5, 7));
  type K = { ten: string; lv: string; nhom: string; dvt: string; loai: string; chieu?: string; kh: number; dau?: number; pt: number; dv: number; ld: number; monthly: (m: number) => number; nguon?: string };
  const kpis: K[] = [
    { ten: "Tổng thu ngân sách nhà nước trên địa bàn", lv: "Kinh tế, tài chính", nhom: "Kinh tế", dvt: "triệu đồng", loai: "cong_don", kh: 12000, pt: tkt, dv: kt, ld: pkt, monthly: () => 900 },
    { ten: "Diện tích gieo trồng cây hằng năm", lv: "Nông nghiệp, môi trường", nhom: "Kinh tế", dvt: "ha", loai: "cong_don", kh: 850, pt: k2, dv: kt, ld: pkt, monthly: (m) => (m === 2 || m === 7 ? 380 : 0) },
    { ten: "Tỷ lệ người dân tham gia bảo hiểm y tế", lv: "Giáo dục, y tế", nhom: "Văn hóa - xã hội", dvt: "%", loai: "ty_le", kh: 95, pt: v1, dv: vh, ld: pvx, monthly: (m) => 88 + m * 0.4, nguon: "Chỉ tiêu tỉnh giao" },
    { ten: "Tỷ lệ hộ nghèo", lv: "Văn hóa - xã hội", nhom: "Văn hóa - xã hội", dvt: "%", loai: "ty_le", chieu: "thap", kh: 2.5, dau: 3.4, pt: v1, dv: vh, ld: pvx, monthly: (m) => 3.4 - m * 0.04 },
    { ten: "Tỷ lệ hồ sơ thủ tục hành chính giải quyết đúng hạn", lv: "Cải cách hành chính", nhom: "Xây dựng chính quyền", dvt: "%", loai: "ty_le", kh: 98, pt: thc, dv: hcc, ld: ctx, monthly: () => 98.6 },
    { ten: "Tỷ lệ hồ sơ thủ tục hành chính nộp trực tuyến", lv: "Khoa học, công nghệ, chuyển đổi số", nhom: "Xây dựng chính quyền", dvt: "%", loai: "ty_le", kh: 80, pt: thc, dv: hcc, ld: ctx, monthly: (m) => 50 + m * 2, nguon: "Chỉ tiêu tỉnh giao" },
    { ten: "Xã đạt chuẩn văn hóa nông thôn mới", lv: "Văn hóa - xã hội", nhom: "Văn hóa - xã hội", dvt: "tiêu chí", loai: "dat_khong", kh: 1, pt: tvh, dv: vh, ld: pvx, monthly: () => 0 },
    { ten: "Số thanh niên nhập ngũ", lv: "An ninh, quốc phòng", nhom: "Quốc phòng - an ninh", dvt: "người", loai: "cong_don", kh: 25, pt: vph, dv: vp, ld: ctx, monthly: (m) => (m === 2 ? 25 : 0) },
    { ten: "Đường giao thông nông thôn được cứng hóa", lv: "Xây dựng, giao thông", nhom: "Kinh tế", dvt: "km", loai: "cong_don", kh: 6, pt: tkt, dv: kt, ld: pkt, monthly: (m) => (m >= 4 && m <= 8 ? 0.45 : 0) },
  ];
  const kpiIds: number[] = [];
  for (const [i, k] of kpis.entries()) {
    const [r] = await tx`INSERT INTO chi_tieu (ten, linh_vuc, nguon, nhom, don_vi_tinh, loai, chieu_tot, ke_hoach_nam, gia_tri_dau_nam, nam, han, id_phu_trach, id_don_vi_phu_trach, id_lanh_dao, ky_cap_nhat, thu_tu)
      VALUES (${k.ten}, ${k.lv}, ${k.nguon || "Nghị quyết HĐND xã"}, ${k.nhom}, ${k.dvt}, ${k.loai}, ${k.chieu || "cao"}, ${k.kh}, ${k.dau ?? null}, ${nam}, ${`${nam}-12-31`},
        ${k.pt}, ${k.dv}, ${k.ld}, 'thang', ${i}) RETURNING id`;
    kpiIds.push(r.id);
    for (let m = 1; m < curMonth; m++) {
      const v = Math.round(k.monthly(m) * 100) / 100;
      if (k.loai === "cong_don" && v === 0) continue;
      await tx`INSERT INTO chi_tieu_so_lieu (id_chi_tieu, ky, gia_tri, id_nguoi_nhap, xac_nhan, id_nguoi_xac_nhan, thoi_gian)
        VALUES (${r.id}, ${`${nam}-${String(m).padStart(2, "0")}`}, ${v}, ${k.pt}, TRUE, ${k.pt === v1 ? tvh : k.pt}, ${fromVN(`${nam}-${String(m).padStart(2, "0")}-25`, "10:00")})`;
    }
  }
  // Phân rã chỉ tiêu thu ngân sách xuống thôn
  for (const [ten, dv, kh] of [["Thu ngân sách - Thôn Đông", th1, 4000], ["Thu ngân sách - Thôn Tây", th2, 3000]] as const) {
    await tx`INSERT INTO chi_tieu (ten, linh_vuc, nguon, nhom, don_vi_tinh, loai, chieu_tot, ke_hoach_nam, nam, han, id_phu_trach, id_don_vi_phu_trach, id_lanh_dao, ky_cap_nhat, id_cha)
      VALUES (${ten}, 'Kinh tế, tài chính', 'Nghị quyết HĐND xã', 'Kinh tế', 'triệu đồng', 'cong_don', 'cao', ${kh}, ${nam}, ${`${nam}-12-31`}, ${dv === th1 ? t1 : null}, ${dv}, ${pkt}, 'thang', ${kpiIds[0]})`;
  }
  await tx`INSERT INTO cong_viec_chi_tieu VALUES (${ids[4]}, ${kpiIds[0]}), (${ids[5]}, ${kpiIds[2]}), (${ids[7]}, ${kpiIds[3]}), (${ids[8]}, ${kpiIds[4]}), (${ids[9]}, ${kpiIds[5]}), (${ids[6]}, ${kpiIds[6]})`;
  // Số liệu tháng trước chưa xác nhận (để thấy luồng xác nhận)
  await tx`INSERT INTO chi_tieu_so_lieu (id_chi_tieu, ky, gia_tri, id_nguoi_nhap, xac_nhan)
    VALUES (${kpiIds[2]}, ${`${nam}-${String(curMonth).padStart(2, "0")}`}, 92.5, ${v1}, FALSE)`;
}
