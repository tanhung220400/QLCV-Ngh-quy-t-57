"use client";
import { useEffect, useState } from "react";

/** Đăng ký service worker (PWA) và báo trạng thái mất mạng */
export function SwRegister() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    setOffline(!navigator.onLine);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  if (!offline) return null;
  return (
    <div className="no-print fixed inset-x-0 top-0 z-50 bg-amber-500 px-3 py-1.5 text-center font-semibold text-white">
      Đang mất mạng — bạn vẫn xem được danh sách việc đã tải. Cập nhật tiến độ sẽ tự gửi khi có mạng lại.
    </div>
  );
}
