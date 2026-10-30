// Service worker: xem được các trang đã mở khi mất mạng (mạng trước, bộ nhớ đệm sau)
const CACHE = "qlcv-v1";
const OFFLINE_URLS = ["/", "/viec", "/viec?tab=cua_toi"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/manifest.webmanifest", "/icon-192.png"]).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith("/api/")) return;
  // Tài nguyên tĩnh: bộ nhớ đệm trước
  if (url.pathname.startsWith("/_next/static/") || /\.(png|svg|ico|webmanifest|woff2?)$/.test(url.pathname)) {
    e.respondWith(caches.match(req).then((r) => r || fetch(req).then((res) => { const cp = res.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); return res; })));
    return;
  }
  // Trang và dữ liệu RSC: mạng trước, lưu bản sao để xem khi mất mạng
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && (req.mode === "navigate" || req.headers.get("RSC"))) {
          const cp = res.clone();
          caches.open(CACHE).then((c) => c.put(req, cp));
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then(
          (r) =>
            r ||
            (req.mode === "navigate"
              ? caches.match("/viec?tab=cua_toi").then((x) => x || caches.match("/")).then((x) => x || new Response("<meta charset=utf-8><h2 style='font-family:sans-serif;padding:24px'>Đang mất mạng. Hãy mở lại khi có mạng.</h2>", { headers: { "content-type": "text/html; charset=utf-8" } }))
              : Response.error()),
        ),
      ),
  );
});
void OFFLINE_URLS;
