"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const KEY = "qlcv_hang_doi";

type Item = { id: number; phan_tram: number; ghi_chu: string; luc: string };

export function readQueue(): Item[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}
function writeQueue(q: Item[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(q));
  } catch {}
}

export async function sendProgress(it: Item): Promise<{ ok: boolean; error?: string; network?: boolean }> {
  try {
    const r = await fetch("/api/tien-do", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(it) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) return { ok: false, error: j.error || "Lỗi máy chủ" };
    return { ok: true };
  } catch {
    return { ok: false, network: true };
  }
}

export async function flushQueue(): Promise<number> {
  const q = readQueue();
  if (!q.length || !navigator.onLine) return 0;
  const left: Item[] = [];
  let sent = 0;
  for (const it of q) {
    const r = await sendProgress(it);
    if (r.ok) sent++;
    else if (r.network) left.push(it);
  }
  writeQueue(left);
  return sent;
}

/** Cập nhật tiến độ — nếu mất mạng thì lưu tạm và tự gửi khi có mạng lại */
export function ProgressUpdate({ id, current, auto }: { id: number; current: number; auto: boolean }) {
  const [v, setV] = useState(current);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ t: "ok" | "err" | "wait"; s: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const it: Item = { id, phan_tram: v, ghi_chu: note, luc: new Date().toISOString() };
    if (!navigator.onLine) {
      writeQueue([...readQueue(), it]);
      setMsg({ t: "wait", s: "Đang mất mạng. Đã lưu tạm, sẽ tự gửi khi có mạng lại." });
      setBusy(false);
      return;
    }
    const r = await sendProgress(it);
    if (r.ok) {
      setMsg({ t: "ok", s: "Đã cập nhật tiến độ." });
      setNote("");
      router.refresh();
    } else if (r.network) {
      writeQueue([...readQueue(), it]);
      setMsg({ t: "wait", s: "Mạng chập chờn. Đã lưu tạm, sẽ tự gửi khi có mạng lại." });
    } else setMsg({ t: "err", s: r.error || "Không cập nhật được." });
    setBusy(false);
  };

  return (
    <form onSubmit={submit} className="mt-2 space-y-3">
      {auto ? (
        <p className="text-sm text-slate-600">% tiến độ tự tính từ việc con và checklist. Bạn có thể ghi chú tình hình thực hiện.</p>
      ) : (
        <div>
          <div className="flex items-center gap-3">
            <input type="range" min={0} max={100} step={5} value={v} onChange={(e) => setV(Number(e.target.value))} className="h-3 flex-1 accent-blue-700" aria-label="Phần trăm tiến độ" />
            <span className="w-16 text-right text-xl font-bold">{v}%</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {[25, 50, 75, 90].map((x) => (
              <button type="button" key={x} onClick={() => setV(x)} className="btn btn-outline btn-sm">
                {x}%
              </button>
            ))}
          </div>
        </div>
      )}
      <textarea value={note} onChange={(e) => setNote(e.target.value)} className="input" rows={2} placeholder="Ghi chú tình hình (không bắt buộc)" />
      <button disabled={busy} className="btn btn-primary w-full">
        {busy ? "Đang gửi..." : "Cập nhật"}
      </button>
      {msg && (
        <p className={`rounded-lg px-3 py-2 ${msg.t === "ok" ? "bg-emerald-50 text-emerald-800" : msg.t === "wait" ? "bg-amber-50 text-amber-900" : "bg-red-50 text-red-800"}`}>{msg.s}</p>
      )}
    </form>
  );
}
