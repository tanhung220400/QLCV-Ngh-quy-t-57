"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type Item = { href: string; label: string; icon: string };

const ICONS: Record<string, React.ReactNode> = {
  home: <path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z" />,
  list: <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />,
  plus: <path d="M12 5v14M5 12h14" />,
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </>
  ),
  chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  bell: <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />,
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </>
  ),
  cog: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </>
  ),
  more: <path d="M4 6h16M4 12h16M4 18h16" />,
};

export function Icon({ name, className = "h-6 w-6" }: { name: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {ICONS[name]}
    </svg>
  );
}

export function Nav({ items, mobile, unread, user }: { items: Item[]; mobile: Item[]; unread: number; user: { ho_ten: string; chuc_vu: string } }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const active = (h: string) => (h === "/" ? path === "/" : path === h || path.startsWith(h + "/"));
  return (
    <>
      {/* Thanh bên trên máy tính, máy tính bảng ngang */}
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="text-lg leading-tight font-bold text-brand-700">Giao việc &amp; Chỉ tiêu</div>
          <div className="mt-1 text-sm text-slate-500">
            {user.ho_ten}
            {user.chuc_vu ? ` · ${user.chuc_vu}` : ""}
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {items.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 font-medium ${active(it.href) ? "bg-brand-50 text-brand-700" : "text-slate-700 hover:bg-slate-50"}`}
            >
              <Icon name={it.icon} />
              <span className="flex-1">{it.label}</span>
              {it.href === "/thong-bao" && unread > 0 && <span className="rounded-full bg-red-600 px-2 text-sm text-white">{unread}</span>}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Thanh dưới trên điện thoại */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
        {mobile.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            className={`relative flex flex-col items-center gap-0.5 py-2 text-xs font-medium ${it.icon === "plus" ? "" : active(it.href) ? "text-brand-700" : "text-slate-600"}`}
          >
            {it.icon === "plus" ? (
              <span className="-mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg">
                <Icon name="plus" />
              </span>
            ) : (
              <Icon name={it.icon} />
            )}
            <span>{it.label}</span>
            {it.href === "/thong-bao" && unread > 0 && (
              <span className="absolute top-1 right-1/4 rounded-full bg-red-600 px-1.5 text-[11px] text-white">{unread}</span>
            )}
          </Link>
        ))}
        <button onClick={() => setOpen(true)} className="flex flex-col items-center gap-0.5 py-2 text-xs font-medium text-slate-600">
          <Icon name="more" />
          <span>Thêm</span>
        </button>
      </nav>
      {open && (
        <div className="no-print fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 px-2 text-slate-500">
              {user.ho_ten}
              {user.chuc_vu ? ` · ${user.chuc_vu}` : ""}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {items.map((it) => (
                <Link key={it.href} href={it.href} onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-3 font-medium">
                  <Icon name={it.icon} />
                  {it.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
