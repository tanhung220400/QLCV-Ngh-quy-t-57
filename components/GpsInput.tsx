"use client";
import { useRef, useState } from "react";

/** Ô nhập toạ độ, có nút lấy vị trí hiện tại của điện thoại */
export function GpsInput({ name, defaultValue }: { name: string; defaultValue?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");
  return (
    <div>
      <div className="flex gap-2">
        <input ref={ref} name={name} id={name} className="input" defaultValue={defaultValue} placeholder="vĩ độ,kinh độ" />
        <button
          type="button"
          className="btn btn-outline shrink-0"
          onClick={() => {
            if (!("geolocation" in navigator)) return setMsg("Thiết bị không hỗ trợ định vị.");
            setMsg("Đang lấy vị trí…");
            navigator.geolocation.getCurrentPosition(
              (p) => {
                if (ref.current) ref.current.value = `${p.coords.latitude.toFixed(6)},${p.coords.longitude.toFixed(6)}`;
                setMsg(`Độ chính xác khoảng ${Math.round(p.coords.accuracy)} m`);
              },
              () => setMsg("Không lấy được vị trí. Hãy cho phép truy cập vị trí."),
              { enableHighAccuracy: true, timeout: 15000 },
            );
          }}
        >
          📍 Vị trí hiện tại
        </button>
      </div>
      {msg && <p className="mt-1 text-sm text-slate-500">{msg}</p>}
    </div>
  );
}
