"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const MAX = 20 * 1024 * 1024;

function getPosition(): Promise<string | null> {
  return new Promise((res) => {
    if (!("geolocation" in navigator)) return res(null);
    navigator.geolocation.getCurrentPosition(
      (p) => res(`${p.coords.latitude.toFixed(6)},${p.coords.longitude.toFixed(6)}`),
      () => res(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  });
}

/** Thu nhỏ ảnh và in ngày giờ + toạ độ GPS lên góc ảnh */
async function stampImage(file: File, when: Date, gps: string | null): Promise<File> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const scale = Math.min(1, 2000 / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0, w, h);
    const fs = Math.max(16, Math.round(w / 40));
    const lines = [when.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }), gps ? `GPS: ${gps}` : "Không lấy được vị trí GPS"];
    ctx.font = `bold ${fs}px sans-serif`;
    const bw = Math.max(...lines.map((l) => ctx.measureText(l).width)) + fs;
    const bh = lines.length * fs * 1.35 + fs * 0.6;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(w - bw - fs / 2, h - bh - fs / 2, bw, bh);
    ctx.fillStyle = "#fff";
    lines.forEach((l, i) => ctx.fillText(l, w - bw, h - bh - fs / 2 + fs * 1.2 + i * fs * 1.35));
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.85));
    if (!blob) return file;
    const name = file.name.replace(/\.[^.]+$/, "") || "anh";
    return new File([blob], `${name}_${when.toISOString().slice(0, 19).replace(/[:T]/g, "")}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function FileUpload({ doiTuong, idDoiTuong, blob }: { doiTuong: string; idDoiTuong: number; blob: boolean }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const limit = blob ? MAX : 4 * 1024 * 1024;

  const handle = async (files: FileList | null, camera: boolean) => {
    if (!files?.length) return;
    setErr(null);
    for (const f0 of Array.from(files)) {
      let f = f0;
      let gps: string | null = null;
      let when: Date | null = null;
      if (camera || f.type.startsWith("image/")) {
        setBusy("Đang lấy vị trí và xử lý ảnh...");
        when = camera ? new Date() : new Date(f.lastModified || Date.now());
        gps = await getPosition();
        f = await stampImage(f, when, gps);
      }
      if (f.size > limit) {
        setErr(`Tệp “${f.name}” vượt quá ${Math.round(limit / 1048576)} MB.`);
        continue;
      }
      setBusy(`Đang tải “${f.name}”...`);
      try {
        if (blob) {
          const { upload } = await import("@vercel/blob/client");
          const res = await upload(`${doiTuong}/${idDoiTuong}/${f.name}`, f, { access: "public", handleUploadUrl: "/api/tep/blob", clientPayload: JSON.stringify({ doiTuong, idDoiTuong }) });
          const r = await fetch("/api/tep", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ doi_tuong: doiTuong, id_doi_tuong: idDoiTuong, url: res.url, ten: f.name, mime: f.type, size: f.size, gps, thoi_gian_chup: when, minh_chung: camera }),
          });
          if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Lỗi lưu tệp");
        } else {
          const fd = new FormData();
          fd.set("file", f);
          fd.set("doi_tuong", doiTuong);
          fd.set("id_doi_tuong", String(idDoiTuong));
          if (gps) fd.set("gps", gps);
          if (when) fd.set("thoi_gian_chup", when.toISOString());
          if (camera) fd.set("minh_chung", "1");
          const r = await fetch("/api/tep", { method: "POST", body: fd });
          if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Lỗi tải tệp");
        }
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Không tải được tệp.");
      }
    }
    setBusy(null);
    if (fileRef.current) fileRef.current.value = "";
    if (camRef.current) camRef.current.value = "";
    router.refresh();
  };

  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => camRef.current?.click()} className="btn btn-primary" disabled={!!busy}>
          📷 Chụp ảnh hiện trường
        </button>
        <button type="button" onClick={() => fileRef.current?.click()} className="btn btn-outline" disabled={!!busy}>
          📎 Đính kèm tệp
        </button>
      </div>
      <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handle(e.target.files, true)} />
      <input
        ref={fileRef}
        type="file"
        multiple
        accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.heic,image/*"
        className="hidden"
        onChange={(e) => handle(e.target.files, false)}
      />
      <p className="mt-1 text-sm text-slate-500">PDF, Word, Excel, ảnh. Tối đa {Math.round(limit / 1048576)} MB mỗi tệp. Ảnh chụp tự gắn ngày giờ và vị trí GPS.</p>
      {busy && <p className="mt-2 text-brand-700">{busy}</p>}
      {err && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-red-800">{err}</p>}
    </div>
  );
}
