"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

/** Thu nhỏ ảnh về tối đa 2000 px, nén JPEG để tải nhanh trên điện thoại */
async function shrink(file: File, max = 2000): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const s = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * s);
    c.height = Math.round(img.height * s);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise<Blob>((res) => c.toBlob((b) => res(b!), "image/jpeg", 0.84));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function ThemeUpload({ loai, label, src, hint }: { loai: "menu" | "chao"; label: string; src: string | null; hint: string }) {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const send = async (file: File | null) => {
    setBusy(true);
    setMsg(file ? "Đang tải ảnh lên…" : "Đang xóa…");
    try {
      let r: Response;
      if (file) {
        const fd = new FormData();
        fd.set("file", new File([await shrink(file)], "anh.jpg", { type: "image/jpeg" }));
        r = await fetch(`/api/giao-dien/${loai}`, { method: "POST", body: fd });
      } else r = await fetch(`/api/giao-dien/${loai}?xoa=1`, { method: "POST" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Lỗi tải ảnh");
      setMsg(file ? "Đã cập nhật ảnh." : "Đã xóa ảnh, dùng nền mặc định.");
      router.refresh();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-2">
      <div className="label">{label}</div>
      <div className="relative aspect-[16/9] overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-brand-700 via-indigo-700 to-sky-600">
        {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-sm text-white/80">Đang dùng nền mặc định</div>}
      </div>
      <p className="text-sm text-slate-500">{hint}</p>
      <div className="flex flex-wrap gap-2">
        <label className={`btn btn-outline btn-sm cursor-pointer ${busy ? "pointer-events-none opacity-60" : ""}`}>
          {src ? "Đổi ảnh" : "Tải ảnh lên"}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" data-loai={loai} onChange={(e) => e.target.files?.[0] && send(e.target.files[0])} />
        </label>
        {src && (
          <button type="button" className="btn btn-danger-soft btn-sm" disabled={busy} onClick={() => send(null)}>
            Xóa ảnh
          </button>
        )}
      </div>
      {msg && <p className="text-sm text-slate-600" role="status">{msg}</p>}
    </div>
  );
}
