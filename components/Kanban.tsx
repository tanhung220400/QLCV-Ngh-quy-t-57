"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { kanbanMove } from "@/app/actions/task";

type Card = { id: number; ten: string; trang_thai: string; ten_chu_tri: string; han: string; phan_tram: number; mau: string; nhan: string; uu_tien: string };
const VIEN: Record<string, string> = { xanh: "border-l-emerald-500", vang: "border-l-amber-500", do: "border-l-red-600", xam: "border-l-slate-400" };
const CHIP: Record<string, string> = { xanh: "text-emerald-700", vang: "text-amber-700", do: "text-red-700", xam: "text-slate-500" };

export function Kanban({ columns, tasks }: { columns: { key: string; label: string }[]; tasks: Card[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  const move = (id: number, to: string) =>
    start(async () => {
      setMsg(null);
      const r = await kanbanMove(id, to);
      if (r.need === "bao_cao") router.push(`/viec/${id}#bao-cao`);
      else if (r.need === "lam_lai") router.push(`/viec/${id}#duyet`);
      else if (r.error) setMsg(r.error);
      else router.refresh();
    });

  const others = tasks.filter((t) => !columns.some((c) => c.key === t.trang_thai));
  return (
    <div>
      {msg && <p className="mb-2 rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-red-800">{msg}</p>}
      {pending && <p className="mb-2 text-slate-500">Đang cập nhật...</p>}
      <div className="-mx-3 flex snap-x gap-3 overflow-x-auto px-3 pb-3">
        {columns.map((col) => {
          const list = tasks.filter((t) => t.trang_thai === col.key);
          return (
            <div
              key={col.key}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(col.key);
              }}
              onDragLeave={() => setOver(null)}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                const id = Number(e.dataTransfer.getData("text/plain"));
                if (id) move(id, col.key);
              }}
              className={`w-[82vw] max-w-xs shrink-0 snap-start rounded-2xl p-2 sm:w-72 ${over === col.key ? "bg-brand-100" : "bg-slate-200/70"}`}
            >
              <div className="flex items-center justify-between px-2 py-1 font-bold text-slate-700">
                {col.label}
                <span className="rounded-full bg-white px-2 text-sm">{list.length}</span>
              </div>
              <div className="mt-1 space-y-2">
                {list.map((t) => (
                  <div
                    key={t.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", String(t.id))}
                    className={`rounded-xl border border-l-4 border-slate-200 bg-white p-3 shadow-sm ${VIEN[t.mau]}`}
                  >
                    <Link href={`/viec/${t.id}`} className="block font-semibold leading-snug">
                      {t.uu_tien !== "thuong" && <span className="mr-1 text-red-600">{t.uu_tien === "hoa_toc" ? "[Hỏa tốc]" : "[Khẩn]"}</span>}
                      {t.ten}
                    </Link>
                    <div className="mt-1 text-sm text-slate-600">{t.ten_chu_tri}</div>
                    <div className={`text-sm font-semibold ${CHIP[t.mau]}`}>
                      {t.nhan} · {t.phan_tram}%
                    </div>
                    <select
                      aria-label="Chuyển trạng thái"
                      className="mt-2 w-full rounded-lg border border-slate-300 bg-slate-50 px-2 py-1.5 text-sm"
                      value=""
                      onChange={(e) => e.target.value && move(t.id, e.target.value)}
                    >
                      <option value="">Chuyển sang…</option>
                      {columns
                        .filter((c) => c.key !== t.trang_thai)
                        .map((c) => (
                          <option key={c.key} value={c.key}>
                            {c.label}
                          </option>
                        ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {others.length > 0 && (
        <div className="mt-2 card">
          <div className="font-semibold">Trả lại / Tạm dừng ({others.length})</div>
          <ul className="mt-1 list-disc pl-5">
            {others.map((t) => (
              <li key={t.id}>
                <Link href={`/viec/${t.id}`} className="text-brand-700 underline">
                  {t.ten}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-2 text-sm text-slate-500">Trên máy tính: kéo thả thẻ sang cột khác. Trên điện thoại: dùng ô “Chuyển sang…”.</p>
    </div>
  );
}
