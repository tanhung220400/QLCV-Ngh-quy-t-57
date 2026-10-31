import type postgres from "postgres";
import { addDays, addWorkingDays, fromVN, vnDate } from "./time";
import { writeLog } from "./log";

type Tx = postgres.TransactionSql;
type Marker = { luc: string; cong_viec: number[]; chi_tieu: number[]; ban_ghi: number[]; don_vi: number[] };

/**
 * Dữ liệu mẫu theo Nghị quyết 57-NQ/TW (khoa học, công nghệ, đổi mới sáng tạo, chuyển đổi số) ở cấp xã.
 * Chạy được trên cơ sở dữ liệu đang dùng: tự chọn cán bộ, đơn vị hiện có theo vai trò.
 * Mọi dòng tạo ra được ghi lại trong cai_dat 'demo_nq57' để xóa nhanh khi không cần nữa.
 */
export async function seedDemoNQ57(tx: Tx, uid: number) {
  const mk: Marker = { luc: new Date().toISOString(), cong_viec: [], chi_tieu: [], ban_ghi: [], don_vi: [] };
  const old = (await tx`SELECT gia_tri FROM cai_dat WHERE khoa = 'demo_nq57'`)[0]?.gia_tri as Marker | undefined;

  // ---------- Danh mục bổ sung ----------
  await tx`INSERT INTO danh_muc (loai, ten, thu_tu) VALUES ('nhom_chi_tieu', 'Khoa học, công nghệ, chuyển đổi số', 10), ('don_vi_tinh', 'lớp', 20), ('don_vi_tinh', 'sản phẩm', 21), ('don_vi_tinh', 'sáng kiến', 22), ('don_vi_tinh', 'tổ', 23), ('nguon_giao', 'Nghị quyết 57-NQ/TW', 10), ('nguon_chi_tieu', 'Kế hoạch thực hiện Nghị quyết 57', 10) ON CONFLICT DO NOTHING`;

  // ---------- Người, đơn vị ----------
  const people = (await tx`SELECT id, vai_tro, id_don_vi, chuc_vu FROM nguoi_dung WHERE trang_thai = 'hoat_dong' ORDER BY id`) as unknown as { id: number; vai_tro: string; id_don_vi: number | null; chuc_vu: string | null }[];
  const by = (...roles: string[]) => people.filter((p) => roles.includes(p.vai_tro));
  const pick = (list: { id: number }[], i: number, fb: number) => (list.length ? list[i % list.length].id : fb);
  const leaders = by("lanh_dao");
  const bithu = leaders.find((p) => /bí thư/i.test(p.chuc_vu || ""))?.id ?? pick(leaders, 0, uid);
  const chutich = leaders.find((p) => /chủ tịch/i.test(p.chuc_vu || "") && !/phó/i.test(p.chuc_vu || ""))?.id ?? pick(leaders, 1, uid);
  const pct = leaders.filter((p) => /phó/i.test(p.chuc_vu || ""));
  const vph = pick(by("tong_hop"), 0, uid);
  const heads = by("truong_don_vi");
  const staff = by("cong_chuc");
  const villageHeads = by("truong_thon");
  const S = (i: number) => pick(staff.length ? staff : heads.length ? heads : people, i, uid);
  const H = (i: number) => pick(heads.length ? heads : staff.length ? staff : people, i, uid);
  const unitOf = (id: number) => people.find((p) => p.id === id)?.id_don_vi ?? null;

  let thon = (await tx`SELECT id, ten FROM don_vi WHERE loai = 'thon' AND hoat_dong ORDER BY thu_tu, id`) as unknown as { id: number; ten: string }[];
  if (thon.length < 3) {
    const n = (await tx`SELECT coalesce(max(thu_tu), 0)::int AS n FROM don_vi`)[0].n as number;
    for (const [i, ten] of ["Thôn Bắc", "Thôn Nam", "Thôn Trung"].slice(0, 3 - thon.length).entries()) {
      if ((await tx`SELECT 1 FROM don_vi WHERE ten = ${ten}`).length) continue;
      const [r] = await tx`INSERT INTO don_vi (ten, loai, thu_tu) VALUES (${ten}, 'thon', ${n + i + 1}) RETURNING id, ten`;
      mk.don_vi.push(r.id);
      thon.push(r as never);
    }
  }
  thon = thon.slice(0, 6);
  const T = (i: number) => thon[i % thon.length];

  // ---------- Công việc ----------
  const today = vnDate();
  const hol = new Set<string>();
  const day = (n: number) => (n >= 0 ? addWorkingDays(today, n, hol) : addDays(today, Math.floor(n * 1.4)));
  type V = { ten: string; mo?: string; lv: string; ng?: string; vb?: string; hop?: string; uu?: string; han: number; sp: string; giao: number; chu: number; st: string; pc?: number; xong?: number; ph?: number[]; dk?: string; con?: [string, number, number, string][] };
  const L = {
    cds: "Chuyển đổi số, chính quyền số",
    hts: "Hạ tầng số, an toàn thông tin",
    dl: "Dữ liệu số, Đề án 06",
    kts: "Kinh tế số, thương mại điện tử",
    xhs: "Xã hội số, kỹ năng số",
    dmst: "Đổi mới sáng tạo, sáng kiến",
    cchc: "Cải cách hành chính",
  };
  const NQ = "Nghị quyết 57-NQ/TW";
  const tasks: V[] = [
    { ten: "Kiện toàn Ban Chỉ đạo phát triển khoa học, công nghệ, đổi mới sáng tạo và chuyển đổi số của xã", lv: L.cds, ng: NQ, vb: "57-NQ/TW", han: -25, sp: "Quyết định", giao: bithu, chu: vph, st: "hoan_thanh", xong: -28 },
    { ten: "Ban hành Kế hoạch thực hiện Nghị quyết 57-NQ/TW năm 2026 của xã", mo: "Cụ thể hóa nhiệm vụ, chỉ tiêu, phân công cơ quan chủ trì, thời hạn hoàn thành", lv: L.cds, ng: NQ, vb: "57-NQ/TW", han: -18, sp: "Kế hoạch", giao: bithu, chu: vph, st: "hoan_thanh", xong: -20 },
    { ten: "Báo cáo kết quả thực hiện Nghị quyết 57 theo Bộ chỉ số giám sát (định kỳ tháng)", lv: L.cds, ng: "Văn bản của tỉnh", vb: "3158-CV/VPTW", han: 5, sp: "Báo cáo", giao: chutich, chu: vph, st: "dang_thuc_hien", pc: 40, dk: "thang" },
    { ten: "Thành lập, kiện toàn Tổ công nghệ số cộng đồng ở 100% thôn", lv: L.xhs, ng: NQ, han: -6, sp: "Quyết định", giao: chutich, chu: H(1), st: "dang_thuc_hien", pc: 80, ph: villageHeads.map((v) => v.id).slice(0, 3) },
    { ten: "Tổ chức các lớp “Bình dân học vụ số” cho người dân tại thôn", mo: "Hướng dẫn cài đặt, sử dụng VNeID mức 2, dịch vụ công trực tuyến, thanh toán không dùng tiền mặt, nhận diện lừa đảo trên mạng", lv: L.xhs, ng: NQ, han: 15, sp: "Báo cáo", giao: pct[1]?.id ?? chutich, chu: H(1), st: "dang_thuc_hien", pc: 35, con: [["Lớp tại " + T(0).ten, S(2), 3, "hoan_thanh"], ["Lớp tại " + T(1).ten, S(2), 8, "dang_thuc_hien"], ["Lớp tại " + T(2).ten, S(3), 14, "da_nhan"]] },
    { ten: "Phổ cập kỹ năng số cho cán bộ, công chức xã (AI cơ bản, an toàn thông tin)", lv: L.xhs, ng: NQ, han: 22, sp: "Báo cáo", giao: chutich, chu: vph, st: "da_nhan" },
    { ten: "Số hóa hồ sơ, kết quả giải quyết thủ tục hành chính còn hiệu lực", mo: "Đạt 100% hồ sơ tiếp nhận mới được số hóa; số hóa lùi dữ liệu hộ tịch từ năm 2015", lv: L.dl, ng: NQ, han: 30, sp: "Số liệu", giao: chutich, chu: H(2), st: "dang_thuc_hien", pc: 55 },
    { ten: "Rà soát, làm sạch dữ liệu dân cư phục vụ Đề án 06", lv: L.dl, ng: "Văn bản của tỉnh", vb: "06/QĐ-TTg", han: -3, sp: "Số liệu", giao: chutich, chu: S(0), st: "dang_thuc_hien", pc: 70, uu: "khan" },
    { ten: "Vận động người dân kích hoạt tài khoản định danh điện tử VNeID mức 2", lv: L.dl, ng: NQ, han: 10, sp: "Báo cáo", giao: pct[0]?.id ?? chutich, chu: H(3), st: "dang_thuc_hien", pc: 60, ph: villageHeads.map((v) => v.id).slice(0, 2) },
    { ten: "Nâng tỷ lệ hồ sơ thủ tục hành chính nộp trực tuyến toàn trình", lv: L.cchc, ng: NQ, han: 40, sp: "Báo cáo", giao: chutich, chu: H(2), st: "dang_thuc_hien", pc: 45 },
    { ten: "Triển khai thanh toán không dùng tiền mặt tại chợ, trường học, trạm y tế", lv: L.kts, ng: NQ, han: 26, sp: "Báo cáo", giao: pct[0]?.id ?? chutich, chu: H(0), st: "dang_thuc_hien", pc: 30 },
    { ten: "Hỗ trợ hộ sản xuất, hợp tác xã đưa sản phẩm OCOP lên sàn thương mại điện tử", lv: L.kts, ng: NQ, han: 35, sp: "Báo cáo", giao: pct[0]?.id ?? chutich, chu: S(1), st: "da_nhan" },
    { ten: "Gắn mã QR truy xuất nguồn gốc cho nông sản chủ lực", lv: L.kts, ng: "Kế hoạch năm", han: -9, sp: "Báo cáo", giao: pct[0]?.id ?? chutich, chu: S(1), st: "hoan_thanh", xong: -10 },
    { ten: "Khảo sát hiện trạng sóng di động, cáp quang tại các thôn (mô hình Thôn số)", lv: L.hts, ng: NQ, han: 2, sp: "Báo cáo", giao: chutich, chu: S(4), st: "dang_thuc_hien", pc: 75 },
    { ten: "Lắp đặt camera an ninh tại các trục đường chính, điểm giao cắt", lv: L.hts, ng: "Nghị quyết HĐND xã", han: 45, sp: "Báo cáo", giao: chutich, chu: H(0), st: "moi_giao" },
    { ten: "Rà soát, bảo đảm an toàn thông tin cho máy tính, mạng nội bộ của UBND xã", lv: L.hts, ng: NQ, han: -1, sp: "Biên bản", giao: chutich, chu: S(4), st: "cho_duyet", pc: 100 },
    { ten: "Phát động phong trào thi đua sáng kiến, đổi mới sáng tạo năm 2026", lv: L.dmst, ng: NQ, han: -14, sp: "Kế hoạch", giao: bithu, chu: vph, st: "hoan_thanh", xong: -15 },
    { ten: "Tổng hợp, đánh giá sáng kiến cải tiến của cán bộ, người dân đề nghị công nhận", lv: L.dmst, ng: "Kế hoạch năm", han: 18, sp: "Tờ trình", giao: bithu, chu: vph, st: "moi_giao" },
    { ten: "Vận hành nhóm Zalo, trang thông tin điện tử tiếp nhận phản ánh của người dân", lv: L.cds, ng: "Chỉ đạo trực tiếp", han: 8, sp: "Báo cáo", giao: chutich, chu: S(3), st: "dang_thuc_hien", pc: 50, dk: "thang" },
    { ten: "Sử dụng phần mềm quản lý văn bản, chữ ký số cho 100% văn bản đi", lv: L.cds, ng: NQ, han: -4, sp: "Báo cáo", giao: chutich, chu: vph, st: "tra_lai" },
  ];
  for (const t of tasks) {
    const han = fromVN(day(t.han), "17:00");
    const tao = fromVN(addDays(today, -Math.max(6, Math.abs(t.han) + 10)), "08:00");
    const xong = t.xong != null ? fromVN(addDays(today, t.xong), "15:30") : null;
    const [r] = await tx`INSERT INTO cong_viec (ten, mo_ta, nguon_giao, so_hieu_vb, linh_vuc, uu_tien, han, han_goc, san_pham, trang_thai, phan_tram,
        id_nguoi_giao, id_nguoi_tao, id_chu_tri, id_don_vi_chu_tri, dinh_ky, ngay_nhan, ngay_hoan_thanh, ngay_bao_cao, tao_luc, ly_do_tra_lai)
      VALUES (${t.ten}, ${t.mo || null}, ${t.ng || NQ}, ${t.vb || null}, ${t.lv}, ${t.uu || "thuong"}, ${han}, ${han}, ${t.sp}, ${t.st}, ${t.st === "hoan_thanh" ? 100 : t.pc || 0},
        ${t.giao}, ${t.giao}, ${t.chu}, ${unitOf(t.chu)}, ${t.dk || null}, ${["moi_giao", "tra_lai"].includes(t.st) ? null : tao}, ${xong},
        ${t.st === "cho_duyet" ? new Date() : xong}, ${tao}, ${t.st === "tra_lai" ? "Đề nghị giao Văn phòng phối hợp với bộ phận CNTT của huyện cũ thực hiện" : null})
      RETURNING id`;
    mk.cong_viec.push(r.id);
    for (const p of t.ph || []) if (p !== t.chu) await tx`INSERT INTO cong_viec_thanh_vien VALUES (${r.id}, ${p}, 'phoi_hop') ON CONFLICT DO NOTHING`;
    for (const [ten, chu, n, st] of t.con || []) {
      const h = fromVN(day(n), "17:00");
      const [c] = await tx`INSERT INTO cong_viec (ten, nguon_giao, linh_vuc, han, han_goc, san_pham, trang_thai, phan_tram, id_nguoi_giao, id_nguoi_tao, id_chu_tri, id_don_vi_chu_tri, id_cha, ngay_nhan, ngay_hoan_thanh, tao_luc)
        VALUES (${ten}, ${t.ng || NQ}, ${t.lv}, ${h}, ${h}, 'Báo cáo', ${st}, ${st === "hoan_thanh" ? 100 : st === "dang_thuc_hien" ? 40 : 0}, ${t.chu}, ${t.chu}, ${chu}, ${unitOf(chu)}, ${r.id}, ${tao}, ${st === "hoan_thanh" ? new Date() : null}, ${tao}) RETURNING id`;
      mk.cong_viec.push(c.id);
    }
    if (t.st === "dang_thuc_hien" && t.pc)
      await tx`INSERT INTO binh_luan (id_cong_viec, id_nguoi_dung, noi_dung, loai, thoi_gian) VALUES (${r.id}, ${t.chu}, ${`Cập nhật tiến độ ${t.pc}%: đang triển khai theo kế hoạch.`}, 'tien_do', now() - interval '2 days')`;
    await writeLog(tx, t.giao, "giao_viec", "cong_viec", r.id, null, { ten: t.ten, du_lieu_mau: "nq57" });
  }
  // checklist cho kế hoạch Thôn số
  const ts = mk.cong_viec[tasks.findIndex((t) => t.ten.startsWith("Khảo sát hiện trạng sóng"))] ?? null;
  if (ts) for (const [i, nd] of ["Lập phiếu khảo sát", "Khảo sát thực địa từng thôn", "Tổng hợp, đề xuất nhà mạng bổ sung trạm BTS"].entries()) await tx`INSERT INTO checklist (id_cong_viec, noi_dung, da_xong, thu_tu) VALUES (${ts}, ${nd}, ${i < 2}, ${i})`;

  // ---------- Chỉ tiêu ----------
  const nam = Number(today.slice(0, 4));
  const cm = Number(today.slice(5, 7));
  const N = "Khoa học, công nghệ, chuyển đổi số";
  type K = { ten: string; lv: string; dvt: string; loai: string; kh: number; dau?: number; pt: number; ld: number; f: (m: number) => number; nguon?: string };
  const kpis: K[] = [
    { ten: "Tỷ lệ hồ sơ thủ tục hành chính nộp trực tuyến toàn trình", lv: L.cchc, dvt: "%", loai: "ty_le", kh: 80, pt: H(2), ld: chutich, f: (m) => 52 + m * 2.3, nguon: "Chỉ tiêu tỉnh giao" },
    { ten: "Tỷ lệ hồ sơ, kết quả giải quyết TTHC được số hóa", lv: L.dl, dvt: "%", loai: "ty_le", kh: 100, pt: H(2), ld: chutich, f: (m) => 70 + m * 2.6 },
    { ten: "Tỷ lệ người dân từ 14 tuổi có tài khoản VNeID mức 2", lv: L.dl, dvt: "%", loai: "ty_le", kh: 90, pt: H(3), ld: pct[0]?.id ?? chutich, f: (m) => 68 + m * 1.9 },
    { ten: "Tỷ lệ giao dịch thanh toán không dùng tiền mặt", lv: L.kts, dvt: "%", loai: "ty_le", kh: 80, pt: H(0), ld: pct[0]?.id ?? chutich, f: (m) => 45 + m * 1.8, nguon: "Kế hoạch thực hiện Nghị quyết 57" },
    { ten: "Số người dân được phổ cập kỹ năng số (Bình dân học vụ số)", lv: L.xhs, dvt: "người", loai: "cong_don", kh: 3000, pt: H(1), ld: pct[1]?.id ?? chutich, f: (m) => 180 + (m % 3) * 60 },
    { ten: "Số thôn có Tổ công nghệ số cộng đồng hoạt động hiệu quả", lv: L.xhs, dvt: "tổ", loai: "cong_don", kh: Math.max(3, thon.length), pt: H(1), ld: pct[1]?.id ?? chutich, f: (m) => (m <= 3 ? 1 : 0) },
    { ten: "Số sản phẩm OCOP, nông sản được đưa lên sàn thương mại điện tử", lv: L.kts, dvt: "sản phẩm", loai: "cong_don", kh: 15, pt: S(1), ld: pct[0]?.id ?? chutich, f: (m) => (m % 2 ? 1 : 2) },
    { ten: "Tỷ lệ hộ gia đình có đường truyền cáp quang", lv: L.hts, dvt: "%", loai: "ty_le", kh: 95, pt: S(4), ld: chutich, f: (m) => 82 + m * 0.9 },
    { ten: "Số sáng kiến, giải pháp đổi mới sáng tạo được công nhận", lv: L.dmst, dvt: "sáng kiến", loai: "cong_don", kh: 10, pt: vph, ld: bithu, f: (m) => (m % 3 === 0 ? 2 : 0) },
    { ten: "100% văn bản đi được ký số, gửi nhận trên môi trường điện tử", lv: L.cds, dvt: "tiêu chí", loai: "dat_khong", kh: 1, pt: vph, ld: chutich, f: () => 0 },
  ];
  for (const [i, k] of kpis.entries()) {
    const [r] = await tx`INSERT INTO chi_tieu (ten, linh_vuc, nguon, nhom, don_vi_tinh, loai, chieu_tot, ke_hoach_nam, gia_tri_dau_nam, nam, han, id_phu_trach, id_don_vi_phu_trach, id_lanh_dao, ky_cap_nhat, thu_tu)
      VALUES (${k.ten}, ${k.lv}, ${k.nguon || "Kế hoạch thực hiện Nghị quyết 57"}, ${N}, ${k.dvt}, ${k.loai}, 'cao', ${k.kh}, ${k.dau ?? null}, ${nam}, ${`${nam}-12-31`},
        ${k.pt}, ${unitOf(k.pt)}, ${k.ld}, 'thang', ${100 + i}) RETURNING id`;
    mk.chi_tieu.push(r.id);
    for (let m = 1; m < cm; m++) {
      const v = Math.round(Math.min(k.loai === "ty_le" ? 100 : 1e9, k.f(m)) * 100) / 100;
      if (k.loai === "cong_don" && v === 0) continue;
      const ky = `${nam}-${String(m).padStart(2, "0")}`;
      await tx`INSERT INTO chi_tieu_so_lieu (id_chi_tieu, ky, gia_tri, id_nguoi_nhap, xac_nhan, id_nguoi_xac_nhan, thoi_gian, ghi_chu)
        VALUES (${r.id}, ${ky}, ${v}, ${k.pt}, ${m < cm - 1}, ${m < cm - 1 ? k.ld : null}, ${fromVN(`${ky}-25`, "09:00")}, ${m === cm - 1 ? "Số liệu tạm tính, chờ xác nhận" : null})`;
    }
  }
  // gắn việc với chỉ tiêu
  const link = async (taskStart: string, kpiIdx: number) => {
    const i = tasks.findIndex((t) => t.ten.startsWith(taskStart));
    const tid = i >= 0 ? (await tx`SELECT id FROM cong_viec WHERE id IN ${tx(mk.cong_viec)} AND ten = ${tasks[i].ten}`)[0]?.id : null;
    if (tid) await tx`INSERT INTO cong_viec_chi_tieu VALUES (${tid}, ${mk.chi_tieu[kpiIdx]}) ON CONFLICT DO NOTHING`;
  };
  await link("Nâng tỷ lệ hồ sơ", 0);
  await link("Số hóa hồ sơ", 1);
  await link("Vận động người dân kích hoạt", 2);
  await link("Triển khai thanh toán", 3);
  await link("Tổ chức các lớp", 4);
  await link("Thành lập, kiện toàn Tổ", 5);
  await link("Hỗ trợ hộ sản xuất", 6);
  await link("Tổng hợp, đánh giá sáng kiến", 8);
  await link("Sử dụng phần mềm quản lý văn bản", 9);

  // ---------- Bản ghi các module ----------
  const mods = Object.fromEntries((await tx`SELECT id, ma FROM mo_dun WHERE loai = 'du_lieu'`).map((r) => [r.ma, r.id as number]));
  const add = async (ma: string, rows: Record<string, unknown>[]) => {
    if (!mods[ma]) return;
    for (const [i, d] of rows.entries()) {
      const who = S(i);
      const [r] = await tx`INSERT INTO mo_dun_ban_ghi (id_mo_dun, du_lieu, id_don_vi, id_nguoi_tao, id_nguoi_sua, tao_luc, cap_nhat_luc)
        VALUES (${mods[ma]}, ${tx.json(d as never)}, ${unitOf(who)}, ${who}, ${who}, now() - ${`${(rows.length - i) * 3} days`}::interval, now() - ${`${(rows.length - i) * 2} days`}::interval) RETURNING id`;
      mk.ban_ghi.push(r.id);
    }
  };
  const names = ["Nguyễn Văn An", "Trần Thị Bích", "Lê Văn Cường", "Phạm Thị Dung", "Hoàng Văn Đức", "Vũ Thị Hạnh", "Đỗ Văn Khoa", "Bùi Thị Liên"];
  const d = (n: number) => addDays(today, n);
  await add(
    "to-cong-nghe-so",
    thon.map((t, i) => ({
      ten_to: `Tổ công nghệ số cộng đồng ${t.ten}`,
      thon: t.id,
      to_truong: names[i % names.length],
      sdt: `09${String(12345678 + i * 1111111).slice(0, 8)}`,
      so_thanh_vien: 5 + (i % 3),
      so_luot_ho_tro: 120 + i * 37,
      trang_thai: ["Hoạt động tốt", "Hoạt động", "Hoạt động tốt", "Chưa hiệu quả"][i % 4],
      ghi_chu: "Gồm trưởng thôn, đoàn viên thanh niên, công an viên, hội viên phụ nữ.",
    })),
  );
  await add(
    "binh-dan-hoc-vu-so",
    [
      ["Hướng dẫn cài đặt, kích hoạt VNeID mức 2", ["Người dân", "Người cao tuổi"], ["VNeID"], 64],
      ["Nộp hồ sơ dịch vụ công trực tuyến trên điện thoại", ["Người dân", "Hộ kinh doanh"], ["Dịch vụ công trực tuyến"], 48],
      ["Thanh toán không dùng tiền mặt, mã QR cho tiểu thương", ["Hộ kinh doanh"], ["Thanh toán không dùng tiền mặt"], 35],
      ["Nhận diện lừa đảo trên không gian mạng", ["Người cao tuổi", "Phụ nữ"], ["An toàn trên mạng"], 72],
      ["Ứng dụng trí tuệ nhân tạo trong công việc hằng ngày", ["Cán bộ, công chức"], ["Trí tuệ nhân tạo cơ bản", "Kỹ năng số cơ bản"], 28],
      ["Bán hàng trên sàn thương mại điện tử", ["Hộ kinh doanh", "Học sinh, thanh niên"], ["Thương mại điện tử"], 40],
    ].map(([ten, dt, cd, n], i) => ({ ten_lop: ten, ngay: d(-60 + i * 9), dia_diem: T(i).id, doi_tuong: dt, chu_de: cd, so_nguoi: n, giang_vien: i === 4 ? "Văn phòng UBND xã" : `Tổ CNS ${T(i).ten}` })),
  );
  await add(
    "ha-tang-so-thon",
    thon.map((t, i) => ({
      thon: t.id,
      song_4g5g: ["4G toàn thôn", "5G", "4G một phần", "4G toàn thôn"][i % 4],
      cap_quang: [92, 97, 78, 88][i % 4],
      wifi_cong_cong: i % 2 === 0,
      camera: [6, 10, 2, 4][i % 4],
      nha_van_hoa_so: i !== 2,
      danh_gia: ["Đạt", "Đạt", "Đang xây dựng", "Chưa đạt"][i % 4],
    })),
  );
  await add("sang-kien-doi-moi", [
    { ten: "Ứng dụng mã QR tra cứu thủ tục hành chính tại bộ phận một cửa", tac_gia: "Trung tâm Phục vụ hành chính công", linh_vuc: L.cchc, nam, cap_cong_nhan: "Cấp xã", hieu_qua: "Giảm 30% thời gian hướng dẫn người dân." },
    { ten: "Bản đồ số các điểm tập kết rác, camera an ninh của thôn", tac_gia: names[2], linh_vuc: L.hts, nam, cap_cong_nhan: "Chưa công nhận" },
    { ten: "Nhóm Zalo “Hỏi nhanh - Đáp gọn” hỗ trợ dịch vụ công", tac_gia: names[3], linh_vuc: L.cds, nam: nam - 1, cap_cong_nhan: "Cấp tỉnh", hieu_qua: "Hơn 1.200 lượt hỏi đáp được trả lời trong ngày." },
    { ten: "Sổ tay điện tử quy trình nội bộ cho công chức mới", tac_gia: names[4], linh_vuc: L.dmst, nam, cap_cong_nhan: "Cấp xã" },
  ]);
  await add("san-pham-so-ocop", [
    { san_pham: "Gạo thơm hữu cơ", chu_the: "HTX Nông nghiệp xã", thon: T(0).id, ocop: "4 sao", san_tmdt: ["Postmart", "Shopee"], ma_qr: true, lien_ket: "https://postmart.vn" },
    { san_pham: "Mật ong rừng", chu_the: `Hộ ${names[5]}`, thon: T(1).id, ocop: "3 sao", san_tmdt: ["Voso", "TikTok Shop"], ma_qr: true },
    { san_pham: "Bánh đa nem truyền thống", chu_the: `Hộ ${names[6]}`, thon: T(2).id, ocop: "3 sao", san_tmdt: ["Zalo OA"], ma_qr: false },
    { san_pham: "Chè búp khô", chu_the: "Tổ hợp tác chè sạch", thon: T(0).id, ocop: "Chưa xếp hạng", san_tmdt: ["Shopee", "Lazada"], ma_qr: true },
    { san_pham: "Nấm sò sạch", chu_the: `Hộ ${names[7]}`, thon: T(1).id, ocop: "Chưa xếp hạng", san_tmdt: ["Postmart"], ma_qr: false },
  ]);
  await add("phan-anh-kien-nghi", [
    { nguoi_phan_anh: names[0], sdt: "0912000111", thon: T(0).id, noi_dung: "Đèn chiếu sáng đường liên thôn bị hỏng 3 bóng.", kenh: "Zalo", linh_vuc: "Xây dựng, giao thông", ngay_nhan: d(-12), can_bo: S(0), trang_thai: "Đã xử lý", ket_qua: "Đã thay bóng đèn ngày " + d(-9).split("-").reverse().join("/") },
    { nguoi_phan_anh: names[1], sdt: "0912000222", thon: T(1).id, noi_dung: "Đề nghị hướng dẫn đăng ký khai sinh trực tuyến cho con.", kenh: "Cổng dịch vụ công", linh_vuc: "Tư pháp, hộ tịch", ngay_nhan: d(-5), can_bo: S(3), trang_thai: "Đã xử lý" },
    { nguoi_phan_anh: names[4], thon: T(2).id, noi_dung: "Sóng điện thoại yếu ở khu vực cuối thôn, khó dùng VNeID.", kenh: "Trực tiếp", linh_vuc: L.hts, ngay_nhan: d(-3), can_bo: S(4), trang_thai: "Đang xử lý" },
    { nguoi_phan_anh: names[6], sdt: "0912000333", thon: T(0).id, noi_dung: "Rác thải tồn đọng tại điểm tập kết gần chợ.", kenh: "Ứng dụng phản ánh", linh_vuc: "Nông nghiệp, môi trường", ngay_nhan: d(-1), trang_thai: "Mới tiếp nhận" },
    { nguoi_phan_anh: names[7], thon: T(1).id, noi_dung: "Tranh chấp ranh giới đất giữa hai hộ liền kề.", kenh: "Điện thoại", linh_vuc: "Đất đai", ngay_nhan: d(-8), can_bo: S(0), trang_thai: "Chuyển cấp trên" },
  ]);

  const merged: Marker = old
    ? { luc: mk.luc, cong_viec: [...old.cong_viec, ...mk.cong_viec], chi_tieu: [...old.chi_tieu, ...mk.chi_tieu], ban_ghi: [...old.ban_ghi, ...mk.ban_ghi], don_vi: [...old.don_vi, ...mk.don_vi] }
    : mk;
  await tx`INSERT INTO cai_dat (khoa, gia_tri) VALUES ('demo_nq57', ${tx.json(merged as never)}) ON CONFLICT (khoa) DO UPDATE SET gia_tri = EXCLUDED.gia_tri`;
  await writeLog(tx, uid, "nap_du_lieu_mau", "he_thong", null, null, { cong_viec: mk.cong_viec.length, chi_tieu: mk.chi_tieu.length, ban_ghi: mk.ban_ghi.length });
  return { cong_viec: mk.cong_viec.length, chi_tieu: mk.chi_tieu.length, ban_ghi: mk.ban_ghi.length };
}

/** Xóa hẳn dữ liệu mẫu đã nạp (không đưa vào thùng rác) */
export async function removeDemoNQ57(tx: Tx, uid: number) {
  const mk = (await tx`SELECT gia_tri FROM cai_dat WHERE khoa = 'demo_nq57'`)[0]?.gia_tri as Marker | undefined;
  if (!mk) return 0;
  // kèm các kỳ sau do hệ thống tự sinh từ việc định kỳ mẫu
  const cvSet = new Set(mk.cong_viec);
  for (let i = 0; i < 60; i++) {
    const more = (await tx`SELECT id FROM cong_viec WHERE id_goc_dinh_ky IN ${tx([...cvSet, -1])} AND NOT (id IN ${tx([...cvSet, -1])})`).map((r) => r.id as number);
    if (!more.length) break;
    more.forEach((x) => cvSet.add(x));
  }
  const cv = cvSet.size ? [...cvSet] : [-1];
  const ct = mk.chi_tieu.length ? mk.chi_tieu : [-1];
  const bg = mk.ban_ghi.length ? mk.ban_ghi : [-1];
  const all = (await tx`WITH RECURSIVE t AS (SELECT id FROM cong_viec WHERE id IN ${tx(cv)} UNION SELECT c.id FROM cong_viec c JOIN t ON c.id_cha = t.id) SELECT id FROM t`).map((r) => r.id as number);
  const ids = all.length ? all : [-1];
  await tx`UPDATE cong_viec SET id_goc_dinh_ky = NULL WHERE id_goc_dinh_ky IN ${tx(ids)}`;
  await tx`UPDATE cong_viec SET id_cha = NULL WHERE id_cha IN ${tx(ids)} AND NOT (id IN ${tx(ids)})`;
  await tx`DELETE FROM cong_viec_thanh_vien WHERE id_cong_viec IN ${tx(ids)}`;
  await tx`DELETE FROM cong_viec_chi_tieu WHERE id_cong_viec IN ${tx(ids)} OR id_chi_tieu IN ${tx(ct)}`;
  await tx`DELETE FROM checklist WHERE id_cong_viec IN ${tx(ids)}`;
  await tx`DELETE FROM gia_han WHERE id_cong_viec IN ${tx(ids)}`;
  await tx`DELETE FROM binh_luan WHERE id_cong_viec IN ${tx(ids)}`;
  await tx`DELETE FROM tep_dinh_kem WHERE doi_tuong = 'cong_viec' AND id_doi_tuong IN ${tx(ids)}`;
  await tx`DELETE FROM thong_bao WHERE (doi_tuong = 'cong_viec' AND id_doi_tuong IN ${tx(ids)}) OR (doi_tuong = 'chi_tieu' AND id_doi_tuong IN ${tx(ct)})`;
  await tx`UPDATE cong_viec SET id_cha = NULL WHERE id IN ${tx(ids)}`;
  await tx`DELETE FROM cong_viec WHERE id IN ${tx(ids)}`;
  await tx`DELETE FROM tep_dinh_kem WHERE doi_tuong = 'so_lieu' AND id_doi_tuong IN (SELECT id FROM chi_tieu_so_lieu WHERE id_chi_tieu IN ${tx(ct)})`;
  await tx`DELETE FROM chi_tieu_so_lieu WHERE id_chi_tieu IN ${tx(ct)}`;
  await tx`DELETE FROM chi_tieu_ke_hoach_ky WHERE id_chi_tieu IN ${tx(ct)}`;
  await tx`UPDATE chi_tieu SET id_cha = NULL WHERE id_cha IN ${tx(ct)}`;
  await tx`DELETE FROM chi_tieu WHERE id IN ${tx(ct)}`;
  await tx`DELETE FROM tep_dinh_kem WHERE doi_tuong = 'ban_ghi' AND id_doi_tuong IN ${tx(bg)}`;
  await tx`DELETE FROM mo_dun_ban_ghi WHERE id IN ${tx(bg)}`;
  for (const u of mk.don_vi) {
    const used = (await tx`SELECT (SELECT count(*) FROM nguoi_dung WHERE id_don_vi = ${u}) + (SELECT count(*) FROM cong_viec WHERE id_don_vi_chu_tri = ${u}) + (SELECT count(*) FROM chi_tieu WHERE id_don_vi_phu_trach = ${u}) + (SELECT count(*) FROM mo_dun_ban_ghi WHERE id_don_vi = ${u}) + (SELECT count(*) FROM don_vi WHERE id_cha = ${u}) AS n`)[0].n;
    if (Number(used) === 0) await tx`DELETE FROM don_vi WHERE id = ${u}`;
  }
  await tx`DELETE FROM cai_dat WHERE khoa = 'demo_nq57'`;
  await writeLog(tx, uid, "xoa_du_lieu_mau", "he_thong", null, null, { cong_viec: all.length, chi_tieu: mk.chi_tieu.length, ban_ghi: mk.ban_ghi.length });
  return all.length + mk.chi_tieu.length + mk.ban_ghi.length;
}
