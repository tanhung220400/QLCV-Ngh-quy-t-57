// Kiểm thử đầu-cuối: NODE_PATH=<thư mục có playwright>/node_modules BASE=http://localhost:3000 node tests/e2e.cjs
const { chromium } = require("playwright");
const BASE = process.env.BASE || "http://localhost:3000";
const PW = "Demo@2026";
const results = [];
const ok = (name, cond, extra = "") => results.push(`${cond ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`);
const day = (n) => {
  const d = new Date(Date.now() + 7 * 3600e3 + n * 86400e3);
  return d.toISOString().slice(0, 10);
};

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const newPage = async (viewport = { width: 1280, height: 900 }) => {
    const ctx = await browser.newContext({ viewport, locale: "vi-VN", timezoneId: "Asia/Ho_Chi_Minh" });
    // bỏ qua màn hình chào mừng trong các bước kiểm thử (có bước riêng để thử)
    await ctx.addInitScript(() => {
      try {
        if (!location.search.includes("chao=1")) sessionStorage.setItem("qlcv_chao", "1");
      } catch {}
    });
    const page = await ctx.newPage();
    // chờ trang tải xong JavaScript trước khi thao tác (như người dùng thật)
    const go = page.goto.bind(page);
    page.goto = (u, o) => go(u, { waitUntil: "networkidle", ...(o || {}) });
    page.on("dialog", (d) => d.accept());
    page.on("pageerror", (e) => errors.push(`pageerror ${page.url()}: ${e.message}`));
    page.on("console", (m) => m.type() === "error" && !/favicon|ERR_|Failed to load resource/.test(m.text()) && errors.push(`console ${page.url()}: ${m.text().slice(0, 200)}`));
    page.on("response", (r) => r.status() >= 500 && errors.push(`HTTP ${r.status()} ${r.url()}`));
    return { ctx, page };
  };
  const check = async (page, path, label) => {
    const r = await page.goto(BASE + path, { waitUntil: "networkidle" });
    const txt = await page.locator("body").innerText();
    const bad = /Application error|Internal Server Error|server-side exception/i.test(txt);
    ok(`${label} ${path}`, r.status() < 400 && !bad, `HTTP ${r.status()}${bad ? " (lỗi trang)" : ""}`);
    return txt;
  };
  const login = async (page, u) => {
    await page.goto(BASE + "/dang-nhap");
    await page.fill('input[name="ten_dang_nhap"]', u);
    await page.fill('input[name="mat_khau"]', PW);
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.startsWith("/dang-nhap"), { timeout: 15000, waitUntil: "commit" });
  };

  // 1. Khởi tạo
  let { ctx, page } = await newPage();
  await page.goto(BASE + "/");
  ok("chuyển đến trang khởi tạo", page.url().includes("/cai-dat-ban-dau"), page.url());
  await page.fill('input[name="ma_khoi_tao"]', "sai");
  await page.fill('input[name="ten_xa"]', "xã Tân Hưng");
  await page.fill('input[name="ho_ten"]', "Quản trị");
  await page.fill('input[name="ten_dang_nhap"]', "quantri");
  await page.fill('input[name="mat_khau"]', "Quantri@2026");
  await page.click('button[type="submit"]');
  await page.waitForSelector("text=Mã khởi tạo không đúng");
  ok("từ chối mã khởi tạo sai", true);
  await page.fill('input[name="ma_khoi_tao"]', "khoitao");
  await page.click('button[type="submit"]');
  await page.waitForURL(BASE + "/", { timeout: 60000, waitUntil: "commit" });
  ok("khởi tạo + dữ liệu mẫu", true);
  for (const p of ["/", "/viec", "/viec?xem=kanban", "/viec?xem=lich", "/chi-tieu", "/bao-cao", "/quan-tri", "/quan-tri?muc=don_vi", "/quan-tri?muc=danh_muc", "/quan-tri?muc=ngay_nghi", "/quan-tri?muc=cai_dat", "/quan-tri?muc=nhat_ky", "/quan-tri?muc=mo_dun", "/quan-tri?muc=thung_rac", "/quan-tri?muc=sms", "/quan-tri?muc=giao_dien", "/m/nghi-quyet-57", "/m/to-cong-nghe-so", "/m/binh-dan-hoc-vu-so", "/m/ha-tang-so-thon", "/m/sang-kien-doi-moi", "/m/san-pham-so-ocop", "/m/phan-anh-kien-nghi", "/m/phan-anh-kien-nghi/moi", "/thong-bao", "/tai-khoan"])
    await check(page, p, "quản trị");
  await ctx.close();

  // 2. Chủ tịch giao việc cho Phòng Kinh tế và Phòng Văn hóa (tách 2 việc)
  ({ ctx, page } = await newPage());
  await login(page, "chutich");
  const dash = await check(page, "/", "chủ tịch");
  ok("dashboard có 4 con số", /Việc quá hạn/.test(dash) && /Đúng hạn trong tháng/.test(dash) && /Chỉ tiêu có nguy cơ/.test(dash));
  await page.goto(BASE + "/viec/moi");
  await page.fill('input[name="ten"]', "Kiểm thử: Rà soát hồ sơ đất đai tồn đọng");
  await page.fill('input[name="han_ngay"]', day(10));
  await page.fill('input[name="san_pham"]', "Báo cáo");
  await page.selectOption('select[name="linh_vuc"]', "Đất đai");
  await page.click('button[type="submit"]');
  await page.waitForSelector("text=Còn thiếu: người chủ trì");
  ok("chặn lưu khi thiếu người chủ trì", true);
  ok("giữ nội dung đã nhập sau khi báo lỗi", (await page.inputValue('input[name="ten"]')).includes("Rà soát"));
  await page.getByText("Phòng Kinh tế", { exact: true }).click();
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/viec\/\d+\?moi=1/, { timeout: 15000, waitUntil: "commit" });
  const taskId = Number(page.url().match(/\/viec\/(\d+)/)[1]);
  ok("giao việc cho đơn vị", taskId > 0, `id ${taskId}`);
  await page.goto(BASE + "/viec/moi");
  await page.fill('input[name="ten"]', "Kiểm thử: Báo cáo nhanh tình hình mưa bão");
  await page.getByText("Phòng Kinh tế", { exact: true }).click();
  await page.getByText("Phòng Văn hóa - Xã hội", { exact: true }).click();
  await page.fill('input[name="han_ngay"]', day(3));
  await page.fill('input[name="san_pham"]', "Báo cáo");
  await page.selectOption('select[name="linh_vuc"]', "Nông nghiệp, môi trường");
  await page.click("text=Hỏa tốc");
  await page.click('button[type="submit"]');
  await page.waitForURL(/tab=toi_giao&moi=2/, { timeout: 15000, waitUntil: "commit" });
  ok("giao nhiều đơn vị tự tách việc", true);
  await ctx.close();

  // 3. Trưởng phòng nhận việc, giao lại công chức
  ({ ctx, page } = await newPage());
  await login(page, "tp.kinhte");
  await page.goto(BASE + `/viec/${taskId}`);
  await page.click("text=Xác nhận đã nhận việc");
  await page.waitForSelector("text=Đã nhận việc.");
  ok("trưởng phòng nhận việc", true);
  await page.selectOption('select[name="id_nguoi"]', { label: "Vũ Thị Lan" });
  await page.click('button:text-is("Giao")');
  await page.waitForSelector("text=Đã giao lại cho Vũ Thị Lan");
  ok("giao lại cho công chức", true);
  const unitTab = await check(page, "/viec?tab=don_vi", "trưởng phòng");
  ok("tab việc đơn vị có việc vừa giao", unitTab.includes("Rà soát hồ sơ đất đai tồn đọng"));
  await ctx.close();

  // 4. Công chức cập nhật tiến độ, xin gia hạn, báo cáo hoàn thành
  ({ ctx, page } = await newPage());
  await login(page, "cv.kinhte1");
  await page.goto(BASE + `/viec/${taskId}`);
  await page.locator('input[type="range"]').fill("50");
  await page.click('button:text-is("Cập nhật")');
  await page.waitForSelector("text=Đã cập nhật tiến độ.");
  ok("cập nhật tiến độ 50%", true);
  await page.click("summary:has-text('Xin gia hạn')");
  await page.fill('details:has(summary:has-text("Xin gia hạn")) input[name="han_ngay"]', day(15));
  await page.fill('details:has(summary:has-text("Xin gia hạn")) textarea[name="ly_do"]', "Chờ số liệu từ Văn phòng đăng ký đất đai");
  await page.click('details:has(summary:has-text("Xin gia hạn")) button:has-text("Gửi đề nghị")');
  await page.waitForSelector("text=Đề nghị gia hạn đang chờ duyệt");
  ok("xin gia hạn", true);
  await page.fill('textarea[name="noi_dung"]', "Đã làm xong phần lớn, báo cáo @chutich");
  await page.click('#trao-doi button:has-text("Gửi")');
  await page.waitForSelector("text=Đã làm xong phần lớn");
  ok("bình luận + nhắc tên", true);
  await page.fill('textarea[name="ket_qua"]', "Đã rà soát 42 hồ sơ, báo cáo kèm theo");
  await page.click('#bao-cao button:has-text("Gửi báo cáo")');
  await page.waitForSelector("text=Đính kèm sản phẩm");
  ok("chặn báo cáo khi chưa có tệp", true);
  await page.check('input[name="khong_tep"]');
  await page.click('#bao-cao button:has-text("Gửi báo cáo")');
  await page.waitForSelector("text=chờ người giao duyệt");
  ok("báo cáo hoàn thành", true);
  // Tải tệp (lưu vào CSDL vì không có Blob khi thử)
  const resp = await page.request.post(BASE + "/api/tep", { multipart: { file: { name: "bao-cao.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 test") }, doi_tuong: "cong_viec", id_doi_tuong: String(taskId), gps: "10.762622,106.660172" } });
  ok("tải tệp đính kèm", resp.status() === 200, `HTTP ${resp.status()}`);
  const bad = await page.request.post(BASE + "/api/tep", { multipart: { file: { name: "virus.exe", mimeType: "application/octet-stream", buffer: Buffer.from("x") }, doi_tuong: "cong_viec", id_doi_tuong: String(taskId) } });
  ok("chặn loại tệp không cho phép", bad.status() === 400);
  await ctx.close();

  // 5. Chủ tịch duyệt gia hạn và kết quả
  ({ ctx, page } = await newPage());
  await login(page, "chutich");
  const notif = await check(page, "/thong-bao", "chủ tịch");
  ok("thông báo nhắc tên / chờ duyệt", /nhắc đến bạn/.test(notif) && /Chờ duyệt kết quả/.test(notif));
  await page.goto(BASE + `/viec/${taskId}`);
  await page.click('button:has-text("Đồng ý gia hạn")');
  await page.waitForSelector("text=Đã đồng ý gia hạn.");
  ok("duyệt gia hạn", true);
  await page.click('button:has-text("Đồng ý hoàn thành")');
  await page.waitForSelector("text=Đã duyệt hoàn thành.");
  await page.waitForSelector("text=Đúng hạn");
  const det = await page.locator("body").innerText();
  ok("việc chuyển Hoàn thành + đúng hạn", /Hoàn thành/.test(det) && /đúng hạn/i.test(det));
  ok("lịch sử gia hạn ghi nhận", /Lịch sử gia hạn \(1\)/.test(det));
  // Kanban: kéo việc Mới giao -> Đã nhận không đúng người thì báo lỗi
  await page.goto(BASE + "/viec?xem=kanban&tab=tat_ca");
  ok("bảng Kanban có 5 cột", (await page.locator("text=Chờ duyệt").count()) > 0);
  for (const p of ["/viec?tab=qua_han", "/viec?tab=sap_han", "/viec?xem=lich", "/chi-tieu", "/chi-tieu?loc=nguy_co", "/bao-cao", "/?ky=thang", "/?ky=quy"]) await check(page, p, "chủ tịch");
  // Xuất báo cáo
  for (const [p, type] of [
    ["/api/xuat/viec?tab=tat_ca", "spreadsheetml"],
    ["/api/xuat/qua-han", "spreadsheetml"],
    ["/api/xuat/ca-nhan", "spreadsheetml"],
    ["/api/xuat/chi-tieu", "spreadsheetml"],
    ["/api/bao-cao/tuan", "wordprocessingml"],
    ["/api/bao-cao/chi-tieu?ky=quy", "wordprocessingml"],
    ["/api/bao-cao/hop?ten=" + encodeURIComponent("Giao ban UBND tuần 42"), "wordprocessingml"],
    ["/api/mau/chi-tieu", "spreadsheetml"],
    ["/in/tuan", "text/html"],
    ["/in/hop?ten=" + encodeURIComponent("Giao ban UBND tuần 42"), "text/html"],
  ]) {
    const r = await page.request.get(BASE + p);
    const body = await r.body();
    ok(`xuất ${p.split("?")[0]}`, r.status() === 200 && (r.headers()["content-type"] || "").includes(type) && body.length > 1000, `${r.status()} ${body.length}B`);
  }
  await ctx.close();

  // 6. Phó Chủ tịch chỉ thấy lĩnh vực phụ trách
  ({ ctx, page } = await newPage());
  await login(page, "pct.vanhoa");
  const pv = await check(page, "/viec?tab=tat_ca", "PCT văn hóa");
  ok("PCT văn hóa không thấy việc đất đai", !pv.includes("Rà soát hồ sơ đất đai tồn đọng") && pv.includes("hộ nghèo"));
  await ctx.close();

  // 7. Công chức không xem được việc người khác
  ({ ctx, page } = await newPage());
  await login(page, "cv.vanhoa1");
  await page.goto(BASE + `/viec/${taskId}`);
  ok("chặn xem việc không thuộc trách nhiệm", (await page.locator("body").innerText()).includes("không có quyền"));
  // Nhập số liệu chỉ tiêu BHYT
  await page.goto(BASE + "/chi-tieu?mo=tat_ca");
  await page.click("text=Tỷ lệ người dân tham gia bảo hiểm y tế");
  await page.waitForURL(/chi-tieu\/\d+/, { waitUntil: "commit" });
  const kpiUrl = page.url();
  await page.fill('#nhap input[name="gia_tri"]', "93,2");
  await page.click('#nhap button:has-text("Lưu số liệu")');
  await page.waitForURL(/so_lieu=\d+/, { waitUntil: "commit" });
  ok("công chức nhập số liệu chỉ tiêu", (await page.locator("body").innerText()).includes("Chờ xác nhận"));
  await ctx.close();
  ({ ctx, page } = await newPage());
  await login(page, "tp.vanhoa");
  await page.goto(kpiUrl);
  await page.locator('button:has-text("Xác nhận")').first().click();
  await page.waitForSelector("text=Đã xác nhận.");
  ok("trưởng phòng xác nhận số liệu", true);
  await ctx.close();

  // 8. Văn phòng nhập nhanh từ kết luận họp
  ({ ctx, page } = await newPage());
  await login(page, "vanphong");
  await page.goto(BASE + "/viec/nhap-nhanh");
  await page.fill("textarea", `1. Kiểm thử nhập nhanh việc A | Phòng Kinh tế | ${day(9).split("-").reverse().join("/")} | Báo cáo | Đất đai\n2. Kiểm thử nhập nhanh việc B | Phòng Văn hóa - Xã hội | ${day(12).split("-").reverse().join("/")} | Kế hoạch | Văn hóa - xã hội`);
  await page.click("text=Tách thành danh sách");
  await page.fill('input[name="cuoc_hop"]', "Họp kiểm thử");
  await page.selectOption('select[name="nguoi_giao"]', { index: 2 });
  await page.click('button:has-text("Giao 2 việc")');
  await page.waitForURL(/moi=2/, { timeout: 20000, waitUntil: "commit" });
  ok("nhập nhanh 2 việc từ kết luận họp", true);
  await ctx.close();

  // 10. Đăng xuất, ghi nhớ tên đăng nhập, quên mật khẩu
  ({ ctx, page } = await newPage());
  await page.goto(BASE + "/dang-nhap");
  await page.fill('input[name="ten_dang_nhap"]', "cv.kinhte2");
  await page.check("text=Ghi nhớ tên đăng nhập");
  await page.fill('input[name="mat_khau"]', PW);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/dang-nhap"), { waitUntil: "commit" });
  await page.waitForSelector("text=Đăng xuất");
  ok("có nút Đăng xuất", (await page.locator('button:has-text("Đăng xuất")').count()) > 0);
  await page.locator('aside button:has-text("Đăng xuất")').click();
  await page.waitForURL(/dang-nhap/, { waitUntil: "commit" });
  await page.waitForSelector('input[name="ten_dang_nhap"]');
  await page.waitForTimeout(300);
  ok("đăng xuất được và ghi nhớ tên đăng nhập", (await page.inputValue('input[name="ten_dang_nhap"]')) === "cv.kinhte2");
  await page.click("text=Quên mật khẩu?");
  await page.waitForURL(/quen-mat-khau/, { waitUntil: "commit" });
  await page.click('button:has-text("Gửi mã xác nhận")');
  await page.waitForURL(/b=2/, { waitUntil: "commit" });
  ok("quên mật khẩu: chuyển bước nhập mã", (await page.locator("text=Mã xác nhận").count()) > 0);
  await ctx.close();

  // 11. Quản trị phân quyền chi tiết + SMS
  ({ ctx, page } = await newPage());
  await page.goto(BASE + "/dang-nhap");
  await page.fill('input[name="ten_dang_nhap"]', "quantri");
  await page.fill('input[name="mat_khau"]', "Quantri@2026");
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/dang-nhap"), { waitUntil: "commit" });
  const tb = await check(page, "/thong-bao", "quản trị");
  ok("quản trị nhận yêu cầu cấp lại mật khẩu", tb.includes("Yêu cầu cấp lại mật khẩu"));
  // cv.kinhte2: mở rộng phạm vi sang cả Phòng Kinh tế, bỏ quyền xem chỉ tiêu
  await page.goto(BASE + "/quan-tri?muc=nguoi_dung&q=Ng%C3%B4");
  await page.locator('a:text-is("Sửa")').first().click();
  await page.waitForURL(/sua=\d+/, { waitUntil: "commit" });
  await page.waitForSelector('select[name="pham_vi"]');
  await page.selectOption('select[name="pham_vi"]', "don_vi");
  await page.locator('input[name="pv_don_vi"]').first().waitFor();
  await page.check('label:has-text("Phòng Kinh tế") input[name="pv_don_vi"]');
  await page.uncheck('input[name="quyen"][value="ct.xem"]');
  await page.check('input[name="quyen"][value="bc.dashboard"]');
  await page.check('input[name="quyen"][value="bc.bieu_do"]');
  await page.click('button:has-text("Lưu thay đổi")');
  await page.waitForSelector("text=Đã lưu.");
  ok("lưu phân quyền chi tiết", true);
  const dv = require("child_process").execSync(`psql -h 127.0.0.1 -U postgres -d qlcv -tAc "SELECT d.ten FROM nguoi_dung n JOIN don_vi d ON d.id = n.id_don_vi WHERE n.ten_dang_nhap = 'cv.kinhte2'"`).toString().trim();
  ok("sửa phân quyền không làm mất đơn vị của cán bộ", dv === "Phòng Kinh tế", dv || "(trống)");
  // Bật SMS qua webhook thử
  await page.goto(BASE + "/quan-tri?muc=sms");
  await page.check('input[name="bat"]');
  await page.selectOption('select[name="nha_cung_cap"]', "webhook");
  await page.fill('input[name="webhook_url"]', "http://127.0.0.1:4555/sms");
  await page.fill('input[name="im_lang_tu"]', "00:00");
  await page.fill('input[name="im_lang_den"]', "00:00");
  await page.click('button:has-text("Lưu cài đặt SMS")');
  await page.waitForSelector("text=Đã lưu cài đặt SMS.");
  ok("bật SMS (webhook)", true);
  await page.fill('input[name="sdt"]', "0912345678");
  await page.click('button:has-text("Gửi thử")');
  await page.waitForSelector("text=Đã gửi tin thử");
  ok("gửi SMS thử qua webhook", true);
  await ctx.close();

  ({ ctx, page } = await newPage());
  await login(page, "cv.kinhte1");
  await page.goto(BASE + "/bieu-do");
  ok("công chức chưa được phân quyền thì không xem được biểu đồ", page.url().includes("khong_quyen"));
  ok("menu không hiện biểu đồ khi chưa có quyền", !(await page.locator("aside").innerText()).includes("Biểu đồ tiến độ"));
  await ctx.close();

  ({ ctx, page } = await newPage());
  await login(page, "cv.kinhte2");
  const bd2 = await check(page, "/bieu-do", "được cấp quyền biểu đồ");
  ok("admin cấp quyền thì xem được biểu đồ", bd2.includes("So sánh tiến độ thực hiện công việc"));
  ok("biểu đồ con việc con của đơn vị mình", (await page.locator("svg[data-bieu-do-con]").count()) === 1 && bd2.includes("Biểu đồ con: tiến độ các việc con của Phòng Kinh tế"));
  await page.locator("svg[data-bieu-do-con] rect[fill='transparent']").first().hover();
  ok("di chuột biểu đồ con hiện việc con", await page.locator("text=Bấm vào cột để mở việc con").isVisible());
  const subOpts = await page.locator('select[aria-label="Chọn việc lớn"] option').allInnerTexts();
  ok("biểu đồ con lọc theo việc lớn", subOpts.some((o) => o.includes("giải phóng mặt bằng")), subOpts.join(" | ").slice(0, 160));
  const scopeTxt = await check(page, "/viec?tab=tat_ca", "công chức được mở phạm vi");
  ok("phạm vi đơn vị: thấy việc của cả phòng", scopeTxt.includes("Rà soát, thống kê diện tích đất công"));
  await page.goto(BASE + "/chi-tieu");
  ok("bỏ quyền xem chỉ tiêu thì không vào được", page.url().includes("khong_quyen"));
  const dashTxt = await page.locator("body").innerText();
  ok("cấp thêm quyền dashboard", dashTxt.includes("Việc quá hạn cần can thiệp"));
  await ctx.close();

  // 12. Giao việc gửi SMS cho người chủ trì có số điện thoại
  ({ ctx, page } = await newPage());
  await login(page, "chutich");
  await page.goto(BASE + "/viec/moi");
  await page.fill('input[name="ten"]', "Kiểm thử SMS: Báo cáo nhanh");
  await page.click('button:has-text("Cá nhân")');
  await page.fill('input[placeholder="Tìm..."]', "Ngô");
  await page.locator('label:has-text("Ngô Văn Hùng") input[type="checkbox"]').first().check();
  await page.fill('input[name="han_ngay"]', day(5));
  await page.fill('input[name="san_pham"]', "Báo cáo");
  await page.selectOption('select[name="linh_vuc"]', "Nông nghiệp, môi trường");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/viec\/\d+\?moi=1/, { waitUntil: "commit" });
  await page.waitForTimeout(2500);
  const smsLog = require("fs").existsSync("/tmp/sms.log") ? require("fs").readFileSync("/tmp/sms.log", "utf8") : "";
  ok("SMS giao việc được gửi tới cán bộ", /Ban duoc giao|Viec moi/.test(smsLog), smsLog.split("\n").slice(-2).join(" / ").slice(0, 200));
  // Thu gọn chỉ tiêu theo lĩnh vực
  await page.goto(BASE + "/chi-tieu");
  const ctTxt = await page.locator("body").innerText();
  ok("chỉ tiêu thu gọn theo lĩnh vực", ctTxt.includes("Giáo dục, y tế") && !(await page.locator("text=Tỷ lệ người dân tham gia bảo hiểm y tế").isVisible()));
  await page.click("summary:has-text('Giáo dục, y tế')");
  ok("bấm lĩnh vực thì hiện chỉ tiêu", await page.locator("text=Tỷ lệ người dân tham gia bảo hiểm y tế").isVisible());
  // Tra cứu
  for (const [q, expect] of [
    ["việc quá hạn của phòng kinh tế", "Phòng Kinh tế"],
    ["tong hop viec hoan thanh nam nay theo tung don vi", "Tổng hợp theo từng đơn vị"],
    ["chỉ tiêu có nguy cơ không đạt", "Có nguy cơ không đạt"],
    ["việc về hộ nghèo", "ho ngheo"],
  ]) {
    const txt = await check(page, "/tra-cuu?q=" + encodeURIComponent(q), "tra cứu");
    ok(`tra cứu hiểu “${q}”`, txt.includes(expect) && !/Không tìm thấy/.test(txt), txt.match(/Tổng số việc\s*\d+|Chỉ tiêu năm \d+\s*\d+/)?.[0] || "");
  }
  const xr = await page.request.get(BASE + "/api/tra-cuu/xuat?q=" + encodeURIComponent("việc quá hạn theo từng đơn vị"));
  ok("xuất Excel kết quả tra cứu", xr.status() === 200 && (await xr.body()).length > 1000);
  await ctx.close();


  // 13. Quản trị: module tự tạo, nhập liệu, Excel, thùng rác, danh mục, dữ liệu mẫu NQ57
  ({ ctx, page } = await newPage());
  await page.goto(BASE + "/dang-nhap");
  await page.fill('input[name="ten_dang_nhap"]', "quantri");
  await page.fill('input[name="mat_khau"]', "Quantri@2026");
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/dang-nhap"), { waitUntil: "commit" });
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  const side = await page.locator("aside").innerText();
  ok("menu nhóm theo module (NQ57, địa bàn)", side.includes("NGHỊ QUYẾT 57") || side.includes("Nghị quyết 57"), side.replace(/\n/g, " | ").slice(0, 200));
  ok("menu có module nhập liệu", side.includes("Tổ công nghệ số cộng đồng") && side.includes("Phản ánh, kiến nghị"));
  const tcn = await check(page, "/m/to-cong-nghe-so", "module");
  ok("dữ liệu mẫu NQ57 trong module", (tcn.match(/Tổ công nghệ số cộng đồng Thôn/g) || []).length >= 2);
  const home = await check(page, "/", "trang chủ");
  ok("trang chủ có truy cập nhanh", home.includes("Truy cập nhanh"));
  const nqTasks = await check(page, "/viec?tab=tat_ca", "quản trị");
  ok("công việc mẫu NQ57", nqTasks.includes("Bình dân học vụ số") || nqTasks.includes("VNeID"));
  const nqKpi = await check(page, "/chi-tieu?mo=tat_ca", "quản trị");
  ok("chỉ tiêu mẫu NQ57", nqKpi.includes("nộp trực tuyến toàn trình") && nqKpi.includes("thanh toán không dùng tiền mặt"));
  // Tạo module mới trong nhóm Quản lý địa bàn
  await page.goto(BASE + "/quan-tri?muc=mo_dun");
  const addForm = page.locator('form:has(button:has-text("Tạo module"))');
  await addForm.locator('input[name="ten"]').fill("Hộ kinh doanh cá thể");
  await addForm.locator('select[name="id_cha"]').selectOption({ label: "Quản lý địa bàn (Nhóm menu)" });
  await addForm.locator('select[name="bieu_tuong"]').selectOption("store");
  await addForm.locator('select[name="mau"]').selectOption("orange");
  await addForm.locator('button:has-text("Tạo module")').click();
  await page.waitForURL(/quan-tri\/mo-dun\/\d+\?moi=1/, { waitUntil: "commit" });
  ok("tạo module mới", true);
  const fieldForm = page.locator('form:has(button:has-text("Thêm trường"))');
  await fieldForm.locator('input[name="ten"]').fill("Số lao động");
  await fieldForm.locator('select[name="kieu"]').selectOption("so");
  await fieldForm.locator('button:has-text("Thêm trường")').click();
  await page.waitForSelector("text=Đã thêm trường “Số lao động”");
  await fieldForm.locator('input[name="ten"]').fill("Ngành nghề");
  await fieldForm.locator('select[name="kieu"]').selectOption("lua_chon");
  await fieldForm.locator('textarea[name="tuy_chon"]').fill("Ăn uống\nTạp hóa\nDịch vụ");
  await fieldForm.locator('button:has-text("Thêm trường")').click();
  await page.waitForSelector("text=Đã thêm trường “Ngành nghề”");
  ok("thêm trường dữ liệu cho module", true);
  await page.goto(BASE + "/m/ho-kinh-doanh-ca-the/moi");
  await page.fill('input[name="f_ten"]', "Quán cơm Bình Dân");
  await page.fill('input[name="f_so_lao_dong"]', "3");
  await page.selectOption('select[name="f_nganh_nghe"]', "Ăn uống");
  await page.click('button:has-text("Lưu")');
  await page.waitForURL(/\/m\/ho-kinh-doanh-ca-the\/\d+\?luu=1/, { waitUntil: "commit" });
  const recUrl = page.url().split("?")[0].replace(BASE, "");
  const rec = await page.locator("main").innerText();
  ok("nhập bản ghi vào module mới", rec.includes("Quán cơm Bình Dân") && rec.includes("Ăn uống"));
  ok("module mới hiện trên menu", (await page.locator("aside").innerText()).includes("Hộ kinh doanh cá thể"));
  // Nhập Excel
  const ExcelJS = require("/vercel/app/node_modules/exceljs");
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("x");
  ws.addRow(["Tên, nội dung *", "Số lao động", "Ngành nghề"]);
  ws.addRow(["Tạp hóa Minh Anh", 2, "Tạp hóa"]);
  ws.addRow(["Tiệm sửa xe Hùng", 1, "Dịch vụ"]);
  await wb.xlsx.writeFile("/tmp/nhap.xlsx");
  await page.goto(BASE + "/m/ho-kinh-doanh-ca-the");
  await page.click("summary:has-text('Nhập từ Excel')");
  await page.setInputFiles('input[name="file"]', "/tmp/nhap.xlsx");
  await page.click('button:has-text("Nhập dữ liệu")');
  await page.waitForSelector("text=Đã nhập 2 bản ghi");
  await page.reload();
  const list = await page.locator("main").innerText();
  ok("nhập bản ghi từ Excel", list.includes("Tạp hóa Minh Anh") && list.includes("Tiệm sửa xe Hùng"));
  ok("thống kê nhanh trong module", list.includes("Tổng: Số lao động") && list.includes("6"));
  const xm = await page.request.get(BASE + "/api/m/ho-kinh-doanh-ca-the/xuat");
  ok("xuất Excel module", xm.status() === 200 && (await xm.body()).length > 1000);
  const xs = await page.request.get(BASE + "/api/m/ho-kinh-doanh-ca-the/xuat?mau=1");
  ok("tải mẫu nhập Excel", xs.status() === 200);
  const sTxt = await check(page, "/m/ho-kinh-doanh-ca-the?q=" + encodeURIComponent("tap hoa"), "tìm không dấu");
  ok("tìm kiếm không dấu trong module", sTxt.includes("Tạp hóa Minh Anh") && !sTxt.includes("Quán cơm Bình Dân"));
  // Xóa bản ghi -> thùng rác -> khôi phục
  await page.goto(BASE + recUrl);
  await page.click("summary:has-text('Xóa bản ghi')");
  await page.click('button:has-text("Xóa")');
  await page.waitForURL(/xoa=1/, { waitUntil: "commit" });
  await page.waitForTimeout(500);
  ok("xóa bản ghi", !(await page.locator("main").innerText()).includes("Quán cơm Bình Dân"));
  await page.goto(BASE + "/quan-tri?muc=thung_rac");
  await page.locator('tr:has-text("Quán cơm Bình Dân") button:has-text("Khôi phục")').click();
  await page.waitForSelector("text=Đã khôi phục");
  const back = await check(page, recUrl, "khôi phục");
  ok("khôi phục bản ghi từ thùng rác", back.includes("Quán cơm Bình Dân"));
  // Quản trị xóa công việc (kèm việc con) và khôi phục
  await page.goto(BASE + "/viec?tab=tat_ca");
  await page.click("text=Tổ chức các lớp “Bình dân học vụ số” cho người dân tại thôn");
  await page.waitForURL(/\/viec\/\d+$/, { waitUntil: "commit" });
  const delUrl = page.url().replace(BASE, "");
  await page.click("summary:has-text('Quản trị dữ liệu')");
  await page.locator('form:has(button:has-text("Xóa công việc")) input[name="ly_do"]').fill("Kiểm thử xóa");
  await page.click('button:has-text("Xóa công việc")');
  await page.waitForURL(/viec\?xoa=1/, { waitUntil: "commit" });
  const gr = await page.goto(BASE + delUrl);
  const gone = await page.locator("body").innerText();
  ok("quản trị xóa công việc", gr.status() === 404 || /không tìm thấy|could not be found/i.test(gone), `HTTP ${gr.status()}`);
  await page.goto(BASE + "/quan-tri?muc=thung_rac");
  ok("thùng rác ghi việc con", (await page.locator("main").innerText()).includes("kèm 3 việc con"));
  await page.locator('tr:has-text("Bình dân học vụ số") button:has-text("Khôi phục")').first().click();
  await page.waitForSelector("text=Đã khôi phục");
  const back2 = await check(page, delUrl, "khôi phục việc");
  ok("khôi phục công việc kèm việc con", back2.includes("Bình dân học vụ số") && back2.includes("Lớp tại"));
  // Quản trị sửa toàn bộ (đổi trạng thái việc đã hoàn thành)
  await page.click("summary:has-text('Quản trị dữ liệu')");
  await page.selectOption('form:has(button:has-text("Lưu (quản trị)")) select[name="trang_thai"]', "tam_dung");
  await page.click('button:has-text("Lưu (quản trị)")');
  await page.waitForSelector("text=Đã lưu thay đổi.");
  ok("quản trị sửa toàn bộ thông tin việc", (await page.locator("main").innerText()).includes("Tạm dừng"));
  // Danh mục: thêm lĩnh vực, đổi tên lĩnh vực đang dùng
  await page.goto(BASE + "/quan-tri?muc=danh_muc");
  const lvBox = page.locator("details:has(summary:has-text('Lĩnh vực'))").first();
  await lvBox.locator('form:has(button:has-text("Thêm")) input[name="ten"]').fill("Lĩnh vực kiểm thử mới");
  await lvBox.locator('button:has-text("Thêm")').click();
  await page.waitForSelector("text=Đã thêm “Lĩnh vực kiểm thử mới”");
  ok("admin thêm lĩnh vực", true);
  const row = lvBox.locator('form:has(input[name="ten"][value="Đất đai"])');
  await row.locator('input[name="ten"]').fill("Đất đai, địa chính");
  await row.locator('button:has-text("Lưu")').click();
  await page.waitForSelector("text=Đã đổi tên thành “Đất đai, địa chính”");
  const rn = await page.locator("main").innerText();
  ok("đổi tên lĩnh vực cập nhật nội dung đang dùng", /cập nhật \d+ nội dung/.test(rn), rn.match(/Đã đổi tên[^\n]*/)?.[0]);
  await page.goto(BASE + "/viec/moi");
  ok("lĩnh vực mới có trong biểu mẫu giao việc", (await page.locator('select[name="linh_vuc"] option').allInnerTexts()).includes("Lĩnh vực kiểm thử mới"));
  // API nạp dữ liệu mẫu cần khóa
  const n1 = await page.request.post(BASE + "/api/quan-tri/nap-mau");
  ok("API nạp mẫu chặn khi không có khóa", n1.status() === 401);
  const n2 = await page.request.post(BASE + "/api/quan-tri/nap-mau", { headers: { "x-setup-key": "khoitao" } });
  ok("API nạp mẫu nhận khóa đúng", n2.status() === 200 && (await n2.text()).includes("da_co"));
  await page.screenshot({ path: "/tmp/shot-admin.jpg", type: "jpeg", quality: 45 });
  await page.goto(BASE + "/m/ha-tang-so-thon", { waitUntil: "networkidle" });
  await page.screenshot({ path: "/tmp/shot-module.jpg", type: "jpeg", quality: 45, fullPage: true });
  await ctx.close();


  // 14. Giao diện: ảnh nền menu, màn hình chào mừng, nút Quay lại
  ({ ctx, page } = await newPage());
  await page.goto(BASE + "/dang-nhap");
  await page.fill('input[name="ten_dang_nhap"]', "quantri");
  await page.fill('input[name="mat_khau"]', "Quantri@2026");
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/dang-nhap"), { waitUntil: "commit" });
  await page.goto(BASE + "/quan-tri?muc=giao_dien");
  await page.screenshot({ path: "/tmp/anh-thu.jpg", type: "jpeg", quality: 60 });
  await page.setInputFiles('input[data-loai="menu"]', "/tmp/anh-thu.jpg");
  await page.waitForSelector("text=Đã cập nhật ảnh.");
  await page.setInputFiles('input[data-loai="chao"]', "/tmp/anh-thu.jpg");
  await page.waitForTimeout(2500);
  await page.goto(BASE + "/viec", { waitUntil: "networkidle" });
  const bg = await page.evaluate(() => getComputedStyle(document.querySelector("aside .side-bg-img") || document.body).backgroundImage);
  ok("ảnh nền cột menu", /api\/giao-dien\/menu/.test(bg), bg.slice(0, 80));
  const im = await page.request.get(BASE + "/api/giao-dien/menu");
  ok("phục vụ ảnh giao diện", im.status() === 200 && (im.headers()["content-type"] || "").startsWith("image/"));
  ok("tiêu đề nhóm nổi bật", (await page.locator("aside div.uppercase, aside span.uppercase").allInnerTexts()).some((t) => /điều hành/i.test(t)));
  // Quay lại
  await page.goto(BASE + "/viec", { waitUntil: "networkidle" });
  await page.click("text=Tổ chức các lớp “Bình dân học vụ số” cho người dân tại thôn");
  await page.waitForURL(/\/viec\/\d+$/, { waitUntil: "commit" });
  await page.click('button:has-text("Quay lại")');
  await page.waitForURL((u) => u.pathname === "/viec", { waitUntil: "commit" });
  ok("nút Quay lại về trang trước", true);
  await page.goto(BASE + "/m/to-cong-nghe-so/moi", { waitUntil: "networkidle" });
  ok("có nút Quay lại ở trang con", (await page.locator('button:has-text("Quay lại")').count()) === 1);
  // Ký hiệu module không có nền ô
  ok("ký hiệu module trong menu không có nền", (await page.locator("aside nav a span.ring-1").count()) === 0);
  // Kéo đổi độ rộng cột menu
  const rz = page.locator("aside [data-resizer]");
  const bb = await rz.boundingBox();
  await page.mouse.move(bb.x + 3, bb.y + 300);
  await page.mouse.down();
  await page.mouse.move(bb.x + 60, bb.y + 300, { steps: 5 });
  await page.mouse.move(bb.x + 95, bb.y + 300, { steps: 5 });
  await page.mouse.up();
  const w1 = (await page.locator("aside").boundingBox()).width;
  ok("kéo đổi độ rộng cột menu", w1 > 360 && w1 < 400, `rộng ${w1}`);
  const mainX = (await page.locator("main").boundingBox()).x;
  ok("nội dung dịch theo cột menu", mainX >= w1 - 1, `main x ${mainX}`);
  await page.reload({ waitUntil: "networkidle" });
  ok("nhớ độ rộng cột menu", Math.abs((await page.locator("aside").boundingBox()).width - w1) < 2);
  await page.dblclick("aside [data-resizer]");
  ok("bấm đúp về độ rộng mặc định", Math.abs((await page.locator("aside").boundingBox()).width - 288) < 2);
  // Admin xóa nhiều việc giao sai
  await page.goto(BASE + "/viec?tab=tat_ca&chon=1&q=" + encodeURIComponent("Kiểm thử nhập nhanh"), { waitUntil: "networkidle" });
  const boxes = page.locator('input[name="chon"]');
  ok("chế độ chọn nhiều để xóa", (await boxes.count()) === 2, `${await boxes.count()} ô`);
  await boxes.nth(0).check();
  await boxes.nth(1).check();
  await page.click('button:has-text("Xóa các việc đã chọn")');
  await page.waitForSelector("text=Đã xóa 2 công việc vào Thùng rác.");
  const after = await check(page, "/viec?tab=tat_ca&q=" + encodeURIComponent("Kiểm thử nhập nhanh"), "sau xóa nhiều");
  ok("admin xóa nhiều công việc", !after.includes("Kiểm thử nhập nhanh việc A"));
  // Đóng gói công việc năm cũ
  const curY = Number(day(0).slice(0, 4));
  require("child_process").execSync(`psql -h 127.0.0.1 -U postgres -d qlcv -c "UPDATE cong_viec SET tao_luc = make_timestamptz(${curY - 1}, 11, 20, 8, 0, 0, 'Asia/Ho_Chi_Minh') WHERE ten = 'Tổng hợp số liệu thu ngân sách quý III'"`);
  const curList = await check(page, "/viec?tab=tat_ca&trang_thai=hoan_thanh", "năm nay");
  ok("danh sách năm nay không còn việc năm cũ", !curList.includes("Tổng hợp số liệu thu ngân sách quý III"));
  ok("menu có mục Công việc năm cũ", (await page.locator("aside").innerText()).includes(`Công việc năm ${curY - 1}`));
  const oldList = await check(page, `/viec?tab=tat_ca&nam=${curY - 1}`, "năm cũ");
  ok("mục Công việc năm cũ chứa việc năm cũ", oldList.includes("Tổng hợp số liệu thu ngân sách quý III") && oldList.includes(`Công việc năm ${curY - 1}`));
  // Nút sửa/xóa nổi bật ở trang chi tiết
  await page.goto(BASE + "/viec?tab=tat_ca", { waitUntil: "networkidle" });
  await page.click("text=Tổ chức các lớp “Bình dân học vụ số” cho người dân tại thôn");
  await page.waitForURL(/\/viec\/\d+$/, { waitUntil: "commit" });
  await page.click('a:has-text("✎ Sửa")');
  await page.waitForSelector('button:has-text("Lưu (quản trị)")', { state: "visible" });
  ok("nút Sửa mở ngay khung sửa toàn bộ", true);
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  ok("trang chủ không có nút Quay lại", (await page.locator('button:has-text("Quay lại")').count()) === 0);
  await ctx.close();
  // Màn hình chào mừng: máy tính, máy tính bảng, điện thoại
  for (const [name, vp] of [["máy tính", { width: 1440, height: 900 }], ["máy tính bảng", { width: 820, height: 1180 }], ["điện thoại", { width: 390, height: 844 }]]) {
    const c2 = await browser.newContext({ viewport: vp, locale: "vi-VN" });
    const p2 = await c2.newPage();
    p2.on("pageerror", (e) => errors.push(`pageerror chao: ${e.message}`));
    await p2.goto(BASE + "/dang-nhap");
    await p2.fill('input[name="ten_dang_nhap"]', "chutich");
    await p2.fill('input[name="mat_khau"]', PW);
    await p2.click('button[type="submit"]');
    await p2.waitForURL((u) => !u.pathname.startsWith("/dang-nhap"), { waitUntil: "commit" });
    await p2.waitForSelector("#chao", { state: "visible", timeout: 10000 });
    await p2.waitForTimeout(3200);
    const txt = await p2.locator("#chao h1").innerText();
    ok(`màn hình chào (${name})`, txt.replace(/\s+/g, " ").includes("Chào mừng bạn đến với Phần mềm quản lý công việc Nghị quyết 57-NQ/TW"), txt.replace(/\s+/g, " "));
    const fit = await p2.evaluate(() => { const b = document.querySelector(".chao-body").getBoundingClientRect(); return b.right <= innerWidth + 1 && b.left >= -1 && document.documentElement.scrollWidth <= innerWidth + 1; });
    ok(`chữ chào vừa màn hình (${name})`, fit);
    await p2.screenshot({ path: `/tmp/shot-chao-${vp.width}.jpg`, type: "jpeg", quality: 50 });
    await p2.click("text=Bắt đầu làm việc");
    await p2.waitForSelector("#chao", { state: "detached", timeout: 5000 });
    await p2.reload({ waitUntil: "networkidle" });
    ok(`chỉ chào một lần mỗi phiên (${name})`, !(await p2.locator("#chao").isVisible().catch(() => false)));
    await c2.close();
  }


  // 15. Biểu đồ so sánh tiến độ giữa các đơn vị (lãnh đạo)
  ({ ctx, page } = await newPage({ width: 1440, height: 900 }));
  await login(page, "chutich");
  ok("menu có Biểu đồ tiến độ đơn vị", (await page.locator("aside").innerText()).includes("Biểu đồ tiến độ đơn vị"));
  const bd = await check(page, "/bieu-do", "biểu đồ");
  ok("đơn vị khác không thấy việc con của Phòng Kinh tế", !bd.includes("Kiểm đếm tài sản") && (await page.locator("svg[data-bieu-do-con]").count()) === 0);
  ok("biểu đồ chính chỉ tính việc lớn", bd.includes("không tính việc con"));
  ok("biểu đồ cột theo đơn vị", (await page.locator('svg[role="img"] path').count()) >= 3 && bd.includes("Phòng Kinh tế") && bd.includes("Tiến độ bình quân"));
  const svgW = (await page.locator('svg[role="img"]').boundingBox()).width;
  const mainW = (await page.locator("main").boundingBox()).width;
  ok("biểu đồ rộng hết vùng làm việc", svgW > mainW - 120 && mainW > 1000, `svg ${svgW} / main ${mainW}`);
  const svgH = (await page.locator('svg[role="img"]').boundingBox()).height;
  ok("biểu đồ cao theo màn hình", svgH >= 500, `cao ${svgH}`);
  await page.locator('svg[role="img"] rect[fill="transparent"]').first().hover();
  ok("di chuột hiện chi tiết đơn vị", await page.locator("text=Bấm vào cột để xem danh sách việc").isVisible());
  await page.click('button:has-text("Số việc theo trạng thái")');
  ok("đổi sang biểu đồ trạng thái", (await page.locator("text=Chưa xong, đã quá hạn").count()) > 0);
  await page.selectOption('select[name="quy"]', "4");
  await page.click('button:has-text("Xem")');
  await page.waitForURL(/quy=4/, { waitUntil: "commit" });
  ok("lọc theo quý", (await page.locator("main").innerText()).includes("quý IV"));
  await page.screenshot({ path: "/tmp/shot-bieudo.jpg", type: "jpeg", quality: 50 });
  await ctx.close();
  ({ ctx, page } = await newPage({ width: 390, height: 844 }));
  await login(page, "chutich");
  await page.goto(BASE + "/bieu-do");
  const over2 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok("biểu đồ trên điện thoại không tràn trang (cuộn ngang trong khung)", over2 <= 1, `dư ${over2}px`);
  await ctx.close();

  // PCT kinh tế không thấy chỉ tiêu lĩnh vực y tế
  ({ ctx, page } = await newPage());
  await login(page, "pct.kinhte");
  await page.goto(BASE + "/chi-tieu?mo=tat_ca");
  const pk = await page.locator("body").innerText();
  ok("PCT kinh tế chỉ thấy chỉ tiêu lĩnh vực phụ trách", pk.includes("Tổng thu ngân sách") && !pk.includes("bảo hiểm y tế"));
  const pkt = await check(page, "/tra-cuu?q=" + encodeURIComponent("chỉ tiêu"), "PCT tra cứu");
  ok("tra cứu cũng giới hạn theo phân quyền", !pkt.includes("bảo hiểm y tế"));
  await ctx.close();

  // 9. Giao diện điện thoại: không tràn ngang
  ({ ctx, page } = await newPage({ width: 390, height: 844 }));
  await login(page, "tp.kinhte");
  for (const p of ["/", "/viec", "/viec?xem=kanban", "/viec?xem=lich", `/viec/${taskId}`, "/viec/moi", "/chi-tieu", "/bao-cao", "/thong-bao", "/tai-khoan", "/m/to-cong-nghe-so", "/m/quan-ly-dia-ban", "/m/binh-dan-hoc-vu-so/moi"]) {
    await page.goto(BASE + p, { waitUntil: "networkidle" });
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    const wide = over > 1 ? await page.evaluate(() => [...document.querySelectorAll("body *")].filter((e) => e.getBoundingClientRect().right > window.innerWidth + 1).slice(-3).map((e) => e.tagName + "." + String(e.className).slice(0, 60)).join(" | ")) : "";
    ok(`điện thoại không tràn ngang ${p}`, over <= 1, `dư ${over}px ${wide}`);
  }
  await page.goto(BASE + "/");
  await page.click('nav button:has-text("Menu")');
  await page.waitForTimeout(400);
  await page.screenshot({ path: "/tmp/shot-mobile-menu.jpg", type: "jpeg", quality: 45 });
  ok("menu điện thoại có module", (await page.locator("text=Tổ công nghệ số cộng đồng").count()) > 0);
  await page.goto(BASE + "/");
  await page.screenshot({ path: "/tmp/shot-mobile-home.jpg", type: "jpeg", quality: 45 });
  await page.goto(BASE + `/viec/${taskId}`);
  await page.screenshot({ path: "/tmp/shot-mobile-task.jpg", type: "jpeg", quality: 45 });
  await ctx.close();
  ({ ctx, page } = await newPage({ width: 1280, height: 800 }));
  await login(page, "chutich");
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.screenshot({ path: "/tmp/shot-desktop-home.jpg", type: "jpeg", quality: 45, fullPage: true });
  await page.goto(BASE + "/viec?xem=kanban&tab=tat_ca", { waitUntil: "networkidle" });
  await page.screenshot({ path: "/tmp/shot-desktop-kanban.jpg", type: "jpeg", quality: 45 });
  // Tác vụ quét hạn
  const cron = await page.request.get(BASE + "/api/cron");
  ok("tác vụ quét hạn", cron.status() === 200, await cron.text());
  await ctx.close();

  await browser.close();
  console.log(results.join("\n"));
  console.log(`\n${results.filter((r) => r.startsWith("PASS")).length}/${results.length} PASS`);
  if (errors.length) console.log("ERRORS:\n" + [...new Set(errors)].slice(0, 30).join("\n"));
})().catch((e) => {
  console.log(results.join("\n"));
  console.log("CRASH:", e.message.slice(0, 600));
  process.exit(1);
});
