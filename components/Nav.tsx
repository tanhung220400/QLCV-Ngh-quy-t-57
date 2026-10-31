"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { logoutAction } from "@/app/actions/auth";
import { Icon } from "./Icon";
import { MAU_MODULE } from "@/lib/modules";

export { Icon };

export type NavNode = { id: number; ten: string; href: string; icon: string; mau: string; loai: string; con: NavNode[] };
type Me = { ho_ten: string; chuc_vu: string; don_vi: string; ten_xa: string; admin: boolean; traCuu: boolean; giaoViec: boolean };

const initials = (s: string) =>
  s
    .split(" ")
    .filter(Boolean)
    .slice(-2)
    .map((x) => x[0])
    .join("")
    .toUpperCase();

function useActive() {
  const path = usePathname();
  return (h: string) => (h === "/" ? path === "/" : !h.startsWith("http") && (path === h || path.startsWith(h + "/")));
}

function Tile({ icon, mau, size = "sm" }: { icon: string; mau: string; size?: "sm" | "lg" }) {
  const c = MAU_MODULE[mau] || MAU_MODULE.blue;
  return (
    <span className={`${size === "lg" ? "h-12 w-12 rounded-2xl" : "h-8 w-8 rounded-lg"} flex shrink-0 items-center justify-center ring-1 ${c.bg} ${c.fg} ${c.ring}`}>
      <Icon name={icon} className={size === "lg" ? "h-6 w-6" : "h-[18px] w-[18px]"} />
    </span>
  );
}

function NavLink({ n, depth, unread, onClick }: { n: NavNode; depth: number; unread: number; onClick?: () => void }) {
  const active = useActive();
  const on = active(n.href);
  const ext = n.href.startsWith("http");
  return (
    <>
      <Link
        href={n.href}
        onClick={onClick}
        target={ext ? "_blank" : undefined}
        className={`group flex items-center gap-3 rounded-xl py-1.5 pr-2 font-medium transition ${depth ? "pl-6 text-[15px]" : "pl-2"} ${
          on ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
        }`}
      >
        {depth ? <span className={`h-1.5 w-1.5 rounded-full ${on ? "bg-brand-600" : "bg-slate-300"}`} /> : <Tile icon={n.icon} mau={n.mau} />}
        <span className="min-w-0 flex-1 truncate">{n.ten}</span>
        {n.href === "/thong-bao" && unread > 0 && <span className="rounded-full bg-red-500 px-2 text-xs leading-5 font-semibold text-white">{unread}</span>}
        {ext && <Icon name="link" className="h-4 w-4 text-slate-400" />}
      </Link>
      {n.con.length > 0 && depth < 2 && (
        <div className="space-y-0.5">
          {n.con.map((c) => (
            <NavLink key={c.id} n={c} depth={depth + 1} unread={unread} onClick={onClick} />
          ))}
        </div>
      )}
    </>
  );
}

function MenuList({ tree, unread, onClick }: { tree: NavNode[]; unread: number; onClick?: () => void }) {
  return (
    <div className="space-y-4">
      {tree.map((n) =>
        n.loai === "nhom" ? (
          <div key={n.id}>
            <div className="mb-1 px-2 text-xs font-semibold tracking-wider text-slate-400 uppercase">{n.ten}</div>
            <div className="space-y-0.5">
              {n.con.map((c) => (
                <NavLink key={c.id} n={c} depth={0} unread={unread} onClick={onClick} />
              ))}
            </div>
          </div>
        ) : (
          <div key={n.id} className="space-y-0.5">
            <NavLink n={n} depth={0} unread={unread} onClick={onClick} />
          </div>
        ),
      )}
    </div>
  );
}

export function Nav({ tree, unread, me }: { tree: NavNode[]; unread: number; me: Me }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const active = useActive();
  useEffect(() => setOpen(false), [path]);
  const bottom = [
    { href: "/", label: "Tổng quan", icon: "home" },
    { href: "/viec", label: "Công việc", icon: "list" },
    me.giaoViec ? { href: "/viec/moi", label: "Giao việc", icon: "plus" } : me.traCuu ? { href: "/tra-cuu", label: "Tra cứu", icon: "search" } : { href: "/tai-khoan", label: "Tài khoản", icon: "user" },
    { href: "/thong-bao", label: "Thông báo", icon: "bell" },
  ];

  return (
    <>
      {/* Thanh bên trên máy tính */}
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r border-slate-200/70 bg-white lg:flex">
        <Link href="/" className="flex items-center gap-3 px-5 pt-5 pb-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-soft">
            <Icon name="check" className="h-5 w-5" strokeWidth={2.6} />
          </span>
          <span className="min-w-0">
            <span className="block leading-tight font-bold text-slate-900">Giao việc &amp; Chỉ tiêu</span>
            <span className="block truncate text-sm text-slate-500">{me.ten_xa}</span>
          </span>
        </Link>
        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          <MenuList tree={tree} unread={unread} />
        </nav>
        <div className="space-y-0.5 border-t border-slate-100 p-3">
          {me.admin && (
            <Link href="/quan-tri" className={`flex items-center gap-3 rounded-xl px-2 py-1.5 font-medium ${active("/quan-tri") ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-50"}`}>
              <Tile icon="cog" mau="slate" />
              Quản trị hệ thống
            </Link>
          )}
          <form action={logoutAction}>
            <button className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 font-medium text-slate-600 hover:bg-red-50 hover:text-red-700">
              <Tile icon="logout" mau="rose" />
              Đăng xuất
            </button>
          </form>
        </div>
      </aside>

      {/* Thanh trên cùng */}
      <header className="no-print sticky top-0 z-20 border-b border-slate-200/70 bg-white/90 backdrop-blur lg:ml-72">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-3 sm:px-5">
          <Link href="/" className="flex items-center gap-2 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white">
              <Icon name="check" className="h-5 w-5" strokeWidth={2.6} />
            </span>
            <span className="max-w-[46vw] truncate leading-tight font-bold text-slate-900">{me.ten_xa}</span>
          </Link>
          {me.traCuu ? (
            <form action="/tra-cuu" className="relative hidden flex-1 md:block">
              <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input name="q" className="input max-w-xl bg-slate-50 pl-10" placeholder="Tra cứu nhanh: “việc quá hạn của văn phòng tháng này”…" />
            </form>
          ) : (
            <div className="flex-1" />
          )}
          <div className="ml-auto flex items-center gap-1">
            {me.traCuu && (
              <Link href="/tra-cuu" className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 md:hidden" aria-label="Tra cứu">
                <Icon name="search" />
              </Link>
            )}
            <Link href="/thong-bao" className="relative rounded-xl p-2 text-slate-600 hover:bg-slate-100" aria-label="Thông báo">
              <Icon name="bell" />
              {unread > 0 && <span className="absolute top-1 right-1 min-w-5 rounded-full bg-red-500 px-1 text-center text-[11px] leading-5 font-semibold text-white">{unread > 99 ? "99+" : unread}</span>}
            </Link>
            <Link href="/tai-khoan" className="flex items-center gap-2 rounded-xl p-1 pr-2 hover:bg-slate-100">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">{initials(me.ho_ten)}</span>
              <span className="hidden text-left leading-tight sm:block">
                <span className="block max-w-40 truncate text-sm font-semibold text-slate-800">{me.ho_ten}</span>
                <span className="block max-w-40 truncate text-xs text-slate-500">{me.chuc_vu || me.don_vi}</span>
              </span>
            </Link>
          </div>
        </div>
      </header>

      {/* Thanh dưới trên điện thoại */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {bottom.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            className={`relative flex flex-col items-center gap-0.5 py-2 text-xs font-medium ${it.icon === "plus" ? "text-slate-600" : active(it.href) ? "text-brand-700" : "text-slate-500"}`}
          >
            {it.icon === "plus" ? (
              <span className="-mt-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lift">
                <Icon name="plus" />
              </span>
            ) : (
              <Icon name={it.icon} />
            )}
            <span>{it.label}</span>
            {it.href === "/thong-bao" && unread > 0 && <span className="absolute top-1 right-1/4 rounded-full bg-red-500 px-1.5 text-[11px] text-white">{unread}</span>}
          </Link>
        ))}
        <button onClick={() => setOpen(true)} className={`flex flex-col items-center gap-0.5 py-2 text-xs font-medium ${open ? "text-brand-700" : "text-slate-500"}`}>
          <Icon name="grid" />
          <span>Menu</span>
        </button>
      </nav>
      {open && (
        <div className="no-print fixed inset-0 z-40 bg-slate-900/40 lg:hidden" onClick={() => setOpen(false)}>
          <div
            className="absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-3xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-200" />
            <div className="mb-3 flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-700">{initials(me.ho_ten)}</span>
              <div className="min-w-0">
                <div className="truncate font-semibold">{me.ho_ten}</div>
                <div className="truncate text-sm text-slate-500">{[me.chuc_vu, me.don_vi].filter(Boolean).join(" · ")}</div>
              </div>
            </div>
            <MenuList tree={tree} unread={unread} onClick={() => setOpen(false)} />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Link href="/tai-khoan" className="btn btn-outline">
                <Icon name="user" className="h-5 w-5" /> Tài khoản
              </Link>
              {me.admin && (
                <Link href="/quan-tri" className="btn btn-outline">
                  <Icon name="cog" className="h-5 w-5" /> Quản trị
                </Link>
              )}
              <form action={logoutAction} className={me.admin ? "col-span-2" : ""}>
                <button className="btn btn-danger-soft w-full">
                  <Icon name="logout" className="h-5 w-5" /> Đăng xuất
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export { Tile };
