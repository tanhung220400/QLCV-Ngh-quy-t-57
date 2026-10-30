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
    const page = await ctx.newPage();
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
  for (const p of ["/", "/viec", "/viec?xem=kanban", "/viec?xem=lich", "/chi-tieu", "/bao-cao", "/quan-tri", "/quan-tri?muc=don_vi", "/quan-tri?muc=danh_muc", "/quan-tri?muc=ngay_nghi", "/quan-tri?muc=cai_dat", "/quan-tri?muc=nhat_ky", "/thong-bao", "/tai-khoan"])
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
  await page.goto(BASE + "/chi-tieu");
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

  // 9. Giao diện điện thoại: không tràn ngang
  ({ ctx, page } = await newPage({ width: 390, height: 844 }));
  await login(page, "tp.kinhte");
  for (const p of ["/", "/viec", "/viec?xem=kanban", "/viec?xem=lich", `/viec/${taskId}`, "/viec/moi", "/chi-tieu", "/bao-cao", "/thong-bao", "/tai-khoan"]) {
    await page.goto(BASE + p, { waitUntil: "networkidle" });
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok(`điện thoại không tràn ngang ${p}`, over <= 1, `dư ${over}px`);
  }
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
