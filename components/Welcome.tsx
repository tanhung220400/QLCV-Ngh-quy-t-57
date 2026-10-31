"use client";
import { useEffect, useRef, useState } from "react";

const KEY = "qlcv_chao";
const LINES: { text: string; cls: string }[] = [
  { text: "Chào mừng bạn đến với", cls: "chao-l1" },
  { text: "Phần mềm quản lý công việc", cls: "chao-l2" },
  { text: "Nghị quyết 57-NQ/TW", cls: "chao-l3" },
];

/**
 * Màn hình chào mừng: hiện một lần mỗi phiên làm việc (hoặc khi mở ?chao=1).
 * Quyết định hiện/ẩn bằng đoạn script chạy trước khi vẽ trang để không bị nháy.
 */
export function Welcome({ img, tenXa, hoTen, bat }: { img: string | null; tenXa: string; hoTen: string; bat: boolean }) {
  const [closing, setClosing] = useState(false);
  const [gone, setGone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const close = () => {
    if (closing) return;
    setClosing(true);
    setTimeout(() => {
      setGone(true);
      document.documentElement.removeAttribute("data-chao");
    }, 650);
  };

  useEffect(() => {
    // Chuyển trang trong ứng dụng (ví dụ ngay sau đăng nhập) thì đoạn script phía dưới không chạy: tự quyết định ở đây
    let seen = false;
    try {
      seen = !!sessionStorage.getItem(KEY);
    } catch {}
    const show = document.documentElement.hasAttribute("data-chao") || (bat && !seen) || location.search.includes("chao=1");
    if (!show) return setGone(true);
    document.documentElement.setAttribute("data-chao", "1");
    try {
      sessionStorage.setItem(KEY, "1");
    } catch {}
    if (location.search.includes("chao=1")) history.replaceState(null, "", location.pathname);
    timer.current = setTimeout(close, 7000);
    const onKey = (e: KeyboardEvent) => (e.key === "Escape" || e.key === "Enter") && close();
    window.addEventListener("keydown", onKey);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (gone) return null;
  const hello = hoTen.split(" ").slice(-1)[0];
  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `try{if(${bat ? "true" : "false"}&&!sessionStorage.getItem("${KEY}")||location.search.indexOf("chao=1")>=0)document.documentElement.setAttribute("data-chao","1")}catch(e){}`,
        }}
      />
      <div id="chao" role="dialog" aria-label="Màn hình chào mừng" className={`chao no-print ${closing ? "chao-out" : ""}`} onClick={close}>
        <div className="chao-bg" style={{ backgroundImage: `url(${img || "/chao.webp"})` }} />
        <div className="chao-shade" />
        <div className="chao-glow chao-glow-a" />
        <div className="chao-glow chao-glow-b" />

        <div className="chao-body">
          <div className="chao-badge">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/cong-an-hieu.webp" alt="Công an hiệu" />
          </div>
          <div className="chao-org">{tenXa}</div>
          <h1 className="chao-title">
            {LINES.map((l) => (
              <span key={l.text} className={`chao-line ${l.cls}`}>
                {l.text.split(" ").map((word, i) => (
                  <span key={i} className="chao-word">
                    {word}
                    {i < l.text.split(" ").length - 1 ? " " : ""}
                  </span>
                ))}
              </span>
            ))}
          </h1>
          <div className="chao-rule" />
          <p className="chao-sub">
            Xin chào {hello}! Đột phá phát triển khoa học, công nghệ,
            <br className="hidden sm:inline" /> đổi mới sáng tạo và chuyển đổi số
          </p>
          <button
            type="button"
            className="chao-btn"
            onClick={(e) => {
              e.stopPropagation();
              close();
            }}
          >
            Bắt đầu làm việc
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        </div>
        <div className="chao-bar">
          <span />
        </div>
      </div>
    </>
  );
}
