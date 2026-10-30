"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type SR = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void;
  onerror: (e: { error: string }) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
};

/** Ô tra cứu: gõ hoặc bấm micro để nói (tiếng Việt) */
export function VoiceSearch({ initial, examples }: { initial: string; examples: string[] }) {
  const [q, setQ] = useState(initial);
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const rec = useRef<SR | null>(null);
  const router = useRouter();

  useEffect(() => {
    const W = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
    if (!W.SpeechRecognition && !W.webkitSpeechRecognition) setSupported(false);
  }, []);

  const go = (text: string) => {
    const t = text.trim();
    if (t) router.push(`/tra-cuu?q=${encodeURIComponent(t)}`);
  };

  const listen = () => {
    setErr(null);
    const W = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
    const C = W.SpeechRecognition || W.webkitSpeechRecognition;
    if (!C) return setSupported(false);
    if (listening) {
      rec.current?.stop();
      return;
    }
    const r = new C();
    r.lang = "vi-VN";
    r.interimResults = true;
    r.continuous = false;
    let finalText = "";
    r.onresult = (e) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText = text;
      }
      setQ(text);
    };
    r.onerror = (e) => {
      setErr(e.error === "not-allowed" ? "Trình duyệt chưa cho phép dùng micro. Hãy cấp quyền micro cho trang này." : e.error === "no-speech" ? "Không nghe thấy tiếng nói, hãy thử lại." : `Không nhận dạng được giọng nói (${e.error}).`);
    };
    r.onend = () => {
      setListening(false);
      if (finalText) go(finalText);
    };
    rec.current = r;
    setListening(true);
    r.start();
  };

  return (
    <div className="card space-y-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          go(q);
        }}
        className="flex gap-2"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          name="q"
          className="input text-lg"
          placeholder="Hỏi bằng câu bình thường, ví dụ: việc quá hạn của phòng kinh tế tháng này"
          aria-label="Câu hỏi tra cứu"
          enterKeyHint="search"
        />
        <button
          type="button"
          onClick={listen}
          disabled={!supported}
          title={supported ? "Bấm để nói" : "Trình duyệt này chưa hỗ trợ nhận dạng giọng nói"}
          className={`btn shrink-0 ${listening ? "btn-danger animate-pulse" : "btn-outline"}`}
          aria-label={listening ? "Dừng nghe" : "Nói câu hỏi"}
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
          </svg>
          <span className="hidden sm:inline">{listening ? "Đang nghe..." : "Nói"}</span>
        </button>
        <button className="btn btn-primary shrink-0">Tìm</button>
      </form>
      {listening && <p className="text-brand-700">Đang nghe, hãy nói câu hỏi của bạn...</p>}
      {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-red-800">{err}</p>}
      {!supported && <p className="text-sm text-slate-500">Trình duyệt này chưa hỗ trợ nói. Dùng Chrome trên Android/máy tính hoặc Safari trên iPhone, hoặc dùng nút micro trên bàn phím điện thoại.</p>}
      <div className="flex flex-wrap gap-2">
        {examples.map((x) => (
          <button key={x} type="button" onClick={() => { setQ(x); go(x); }} className="chip border-slate-300 bg-slate-50 py-1 text-slate-700 hover:bg-slate-100">
            {x}
          </button>
        ))}
      </div>
    </div>
  );
}
