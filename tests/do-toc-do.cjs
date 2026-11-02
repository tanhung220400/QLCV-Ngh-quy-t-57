// Đo tốc độ các trang chính trên máy thử (sau khi đã chạy e2e để có dữ liệu)
// NODE_PATH=/vercel/e2e/node_modules node tests/do-toc-do.cjs [nhãn]
// Cần bật ghi câu lệnh của Postgres: ALTER SYSTEM SET log_statement='all'; SELECT pg_reload_conf();
const { chromium } = require("playwright");
const { execSync } = require("child_process");
const fs = require("fs");
const BASE = process.env.BASE || "http://localhost:3000";
const LOG = process.env.PG_LOG || "/tmp/pgd/log";
const LAN = Number(process.env.LAN || 7);
const psql = (q) => execSync(`psql -h 127.0.0.1 -U postgres -d qlcv -At -c "${q}"`).toString().trim();
const soCauLenh = () => {
  try {
    return (fs.readFileSync(LOG, "utf8").match(/LOG: {2}(execute|statement)/g) || []).length;
  } catch {
    return 0;
  }
};
const giua = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const ngu = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const idViec = psql("SELECT id FROM cong_viec WHERE id_cha IS NULL ORDER BY id LIMIT 1");
  const idCt = psql("SELECT id FROM chi_tieu WHERE NOT huy AND id_cha IS NULL ORDER BY (SELECT count(*) FROM chi_tieu c WHERE c.id_cha = chi_tieu.id) DESC, id LIMIT 1");
  const trang = [
    "/",
    "/viec",
    "/viec?tab=tat_ca",
    `/viec/${idViec}`,
    "/chi-tieu",
    `/chi-tieu/${idCt}`,
    "/bao-cao",
    "/bieu-do",
    "/tra-cuu?q=" + encodeURIComponent("việc quá hạn"),
    "/tra-cuu?q=" + encodeURIComponent("chuyển đổi số"),
    "/thong-bao",
    "/quan-tri?muc=thung_rac",
  ];
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(BASE + "/dang-nhap");
  await page.fill('input[name="ten_dang_nhap"]', process.env.U || "chutich");
  await page.fill('input[name="mat_khau"]', process.env.PW || "Demo@2026");
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/dang-nhap"), { timeout: 20000 });
  const kq = [];
  for (const p of trang) {
    const t = [];
    const n = [];
    for (let i = 0; i < LAN; i++) {
      await ngu(400);
      const c0 = soCauLenh();
      const s = Date.now();
      const r = await page.request.get(BASE + p);
      await r.body();
      t.push(Date.now() - s);
      await ngu(1200); // gồm cả việc chạy nền sau khi trả trang
      n.push(soCauLenh() - c0);
      if (r.status() >= 400) t[t.length - 1] = -r.status();
    }
    kq.push({ trang: p.replace(/q=.*/, (m) => decodeURIComponent(m)), ms: giua(t.slice(1)), cau_lenh: giua(n.slice(1)), lan_dau_ms: t[0] });
  }
  await browser.close();
  const nhan = process.argv[2] || "do";
  fs.writeFileSync(`/tmp/toc-do-${nhan}.json`, JSON.stringify(kq, null, 1));
  for (const r of kq) console.log(`${r.trang.padEnd(34)} ${String(r.ms).padStart(5)} ms  ${String(r.cau_lenh).padStart(4)} câu lệnh  (lần đầu ${r.lan_dau_ms} ms)`);
})();
