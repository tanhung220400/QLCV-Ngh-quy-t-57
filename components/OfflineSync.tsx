"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { flushQueue, readQueue } from "./ProgressUpdate";

/** Tự gửi các cập nhật tiến độ đã lưu tạm khi có mạng trở lại */
export function OfflineSync() {
  const router = useRouter();
  const [sent, setSent] = useState(0);
  const [waiting, setWaiting] = useState(0);
  useEffect(() => {
    const run = async () => {
      setWaiting(readQueue().length);
      const n = await flushQueue();
      setWaiting(readQueue().length);
      if (n > 0) {
        setSent(n);
        router.refresh();
        setTimeout(() => setSent(0), 5000);
      }
    };
    run();
    window.addEventListener("online", run);
    const t = setInterval(run, 60000);
    return () => {
      window.removeEventListener("online", run);
      clearInterval(t);
    };
  }, [router]);
  if (!sent && !waiting) return null;
  return (
    <div className="no-print fixed right-3 bottom-24 z-40 rounded-xl bg-slate-900 px-4 py-2 text-white shadow-lg lg:bottom-4">
      {sent ? `Đã gửi ${sent} cập nhật lưu tạm.` : `${waiting} cập nhật đang chờ có mạng để gửi.`}
    </div>
  );
}
