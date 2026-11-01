"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { logoutAction } from "@/app/actions/auth";
import { Icon } from "./Icon";
import { MAU_MODULE } from "@/lib/modules";

export { Icon };

export type NavNode = { id: number; ten: string; href: string; icon: string; mau: string; loai: string; con: NavNode[] };
type Me = { menuImg: string | null; phu: number; ho_ten: string; chuc_vu: string; don_vi: string; ten_xa: string; admin: boolean; traCuu: boolean; giaoViec: boolean };

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

/** Màu ký hiệu module (không nền): sáng trên nền menu tối, đậm trên nền trắng */
const TONE: Record<string, { dark: string; light: string }> = {
  blue: { dark: "text-sky-300", light: "text-blue-600" },
  sky: { dark: "text-sky-300", light: "text-sky-600" },
  teal: { dark: "text-teal-300", light: "text-teal-600" },
  emerald: { dark: "text-emerald-300", light: "text-emerald-600" },
  amber: { dark: "text-amber-300", light: "text-amber-600" },
  orange: { dark: "text-orange-300", light: "text-orange-600" },
  rose: { dark: "text-rose-300", light: "text-rose-600" },
  violet: { dark: "text-violet-300", light: "text-violet-600" },
  indigo: { dark: "text-indigo-300", light: "text-indigo-600" },
  slate: { dark: "text-slate-200", light: "text-slate-600" },
};
const tone = (mau: string, dark: boolean) => (TONE[mau] || TONE.blue)[dark ? "dark" : "light"];

const MO_KEY = "qlcv_menu_mo";
function readMo(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(MO_KEY) || "{}");
  } catch {
    return {};
  }
}

/** Trạng thái mở/đóng mục con: nhớ trên máy; đang ở trang con thì luôn mở */
function useMo(id: number, childOn: boolean): [boolean, () => void] {
  const [mo, setMo] = useState(childOn);
  useEffect(() => {
    const v = readMo()[id];
    if (childOn) setMo(true);
    else if (v !== undefined) setMo(v);
  }, [id, childOn]);
  const toggle = () =>
    setMo((cu) => {
      try {
        localStorage.setItem(MO_KEY, JSON.stringify({ ...readMo(), [id]: !cu }));
      } catch {}
      return !cu;
    });
  return [mo, toggle];
}

function NavLink({ n, depth, unread, onClick, dark }: { n: NavNode; depth: number; unread: number; onClick?: () => void; dark?: boolean }) {
  const active = useActive();
  const on = active(n.href);
  const ext = n.href.startsWith("http");
  const kids = depth < 2 ? n.con : [];
  const hasActive = (x: NavNode): boolean => x.con.some((c) => active(c.href) || hasActive(c));
  const childOn = kids.length > 0 && hasActive(n);
  const [mo, toggle] = useMo(n.id, childOn);
  const cls = dark
    ? on
      ? "bg-white text-brand-800 shadow-lift"
      : "text-white hover:bg-white/12"
    : on
      ? "bg-brand-50 text-brand-700"
      : "text-slate-700 hover:bg-slate-50 hover:text-slate-900";
  return (
    <div>
      <div className={`group flex items-center rounded-xl transition ${cls} ${childOn && !on ? (dark ? "bg-white/8" : "bg-slate-50") : ""}`}>
        <Link
          href={n.href}
          onClick={onClick}
          target={ext ? "_blank" : undefined}
          title={n.ten}
          className={`flex min-w-0 flex-1 items-center gap-3 py-2 pl-2.5 pr-2 ${depth ? "font-medium" : "font-semibold"}`}
        >
          <Icon name={n.icon} className={`h-[22px] w-[22px] shrink-0 ${tone(n.mau, !!dark && !on)}`} strokeWidth={depth ? 1.8 : 2} />
          <span className={`line-clamp-2 min-w-0 flex-1 leading-snug ${dark && !on ? "[text-shadow:0_1px_2px_rgb(0_0_0/0.35)]" : ""}`}>{n.ten}</span>
          {n.href === "/thong-bao" && unread > 0 && <span className="rounded-full bg-red-500 px-2 text-xs leading-5 font-semibold text-white">{unread}</span>}
          {ext && <Icon name="link" className={`h-4 w-4 ${dark && !on ? "text-white/60" : "text-slate-400"}`} />}
        </Link>
        {kids.length > 0 && (
          <button
            type="button"
            onClick={toggle}
            aria-expanded={mo}
            aria-label={mo ? `Thu gọn ${n.ten}` : `Mở ${n.ten}`}
            title={mo ? "Thu gọn" : `Xem ${kids.length} mục con`}
            className={`mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${dark && !on ? "text-white/80 hover:bg-white/15" : "text-slate-500 hover:bg-slate-200/70"}`}
          >
            <Icon name="chevron" className={`h-[18px] w-[18px] transition-transform ${mo ? "rotate-90" : ""}`} />
          </button>
        )}
      </div>
      {kids.length > 0 && (
        <div hidden={!mo} className={`mt-0.5 ml-[21px] space-y-0.5 border-l-2 pl-2 ${dark ? "border-white/25" : "border-slate-200"}`}>
          {kids.map((c) => (
            <NavLink key={c.id} n={c} depth={depth + 1} unread={unread} onClick={onClick} dark={dark} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Màu nhấn cho tiêu đề nhóm */
const NHAN: Record<string, { bar: string; text: string; soft: string }> = {
  blue: { bar: "bg-sky-300", text: "text-sky-700", soft: "bg-sky-50 border-sky-200" },
  sky: { bar: "bg-sky-300", text: "text-sky-700", soft: "bg-sky-50 border-sky-200" },
  teal: { bar: "bg-teal-300", text: "text-teal-700", soft: "bg-teal-50 border-teal-200" },
  emerald: { bar: "bg-emerald-300", text: "text-emerald-700", soft: "bg-emerald-50 border-emerald-200" },
  amber: { bar: "bg-amber-300", text: "text-amber-700", soft: "bg-amber-50 border-amber-200" },
  orange: { bar: "bg-orange-300", text: "text-orange-700", soft: "bg-orange-50 border-orange-200" },
  rose: { bar: "bg-rose-300", text: "text-rose-700", soft: "bg-rose-50 border-rose-200" },
  violet: { bar: "bg-violet-300", text: "text-violet-700", soft: "bg-violet-50 border-violet-200" },
  indigo: { bar: "bg-indigo-300", text: "text-indigo-700", soft: "bg-indigo-50 border-indigo-200" },
  slate: { bar: "bg-slate-300", text: "text-slate-700", soft: "bg-slate-50 border-slate-200" },
};

/**
 * Nhóm menu (hoặc module cấp cao nhất có module con): thanh tiêu đề tô màu, mũi tên mở/đóng,
 * các mục bên trong lùi đầu dòng với đường kẻ dọc. Module có trang riêng thì bấm tên để mở trang.
 */
function NavGroup({ n, unread, onClick, dark }: { n: NavNode; unread: number; onClick?: () => void; dark?: boolean }) {
  const active = useActive();
  const hasActive = (x: NavNode): boolean => x.con.some((c) => active(c.href) || hasActive(c));
  const [mo, toggle] = useMo(n.id, hasActive(n));
  const c = NHAN[n.mau] || NHAN.blue;
  const link = n.loai !== "nhom";
  const on = link && active(n.href);
  const box = `mb-1.5 flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition ${
    dark ? `border-white/15 backdrop-blur-sm ${on ? "bg-white/25" : "bg-white/10 hover:bg-white/18"}` : `${c.soft} ${on ? "ring-2 ring-brand-300" : "hover:brightness-[0.98]"}`
  }`;
  const title = (
    <>
      <span className={`h-6 w-1.5 shrink-0 rounded-full ${c.bar}`} />
      <Icon name={n.icon} className={`h-5 w-5 shrink-0 ${dark ? "text-white" : c.text}`} />
      <span className={`min-w-0 flex-1 truncate text-[15px] font-bold tracking-wide uppercase ${dark ? "text-white [text-shadow:0_1px_3px_rgb(0_0_0/0.45)]" : c.text}`}>{n.ten}</span>
    </>
  );
  const chev = <Icon name="chevron" className={`h-[18px] w-[18px] shrink-0 transition-transform ${mo ? "rotate-90" : ""} ${dark ? "text-white/85" : c.text}`} />;
  const label = { "aria-expanded": mo, "aria-label": mo ? `Thu gọn ${n.ten}` : `Mở ${n.ten}`, title: mo ? "Thu gọn" : `Xem ${n.con.length} mục` };
  return (
    <div data-nhom={n.id}>
      {link ? (
        <div className={`${box} py-0 pr-1`}>
          <Link href={n.href} onClick={onClick} title={n.ten} className="flex min-w-0 flex-1 items-center gap-2.5 py-2">
            {title}
          </Link>
          <button type="button" onClick={toggle} {...label} className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${dark ? "hover:bg-white/15" : "hover:bg-black/5"}`}>
            {chev}
          </button>
        </div>
      ) : (
        <button type="button" onClick={toggle} {...label} className={box}>
          {title}
          {chev}
        </button>
      )}
      <div hidden={!mo} className={`ml-[21px] space-y-0.5 border-l-2 pl-2 ${dark ? "border-white/25" : "border-slate-200"}`}>
        {n.con.map((x) => (
          <NavLink key={x.id} n={x} depth={0} unread={unread} onClick={onClick} dark={dark} />
        ))}
      </div>
    </div>
  );
}

function MenuList({ tree, unread, onClick, dark }: { tree: NavNode[]; unread: number; onClick?: () => void; dark?: boolean }) {
  return (
    <div className="space-y-5">
      {tree.map((n) =>
        n.loai === "nhom" || n.con.length > 0 ? (
          <NavGroup key={n.id} n={n} unread={unread} onClick={onClick} dark={dark} />
        ) : (
          <div key={n.id} className="space-y-0.5">
            <NavLink n={n} depth={0} unread={unread} onClick={onClick} dark={dark} />
          </div>
        ),
      )}
    </div>
  );
}

const SIDE_KEY = "qlcv_side_w";
const SIDE_MIN = 220;
const SIDE_MAX = 440;
const SIDE_DEF = 288;
const setSide = (w: number) => document.documentElement.style.setProperty("--side-w", `${w}px`);

/** Thanh kéo ở mép phải cột menu: kéo để đổi độ rộng, bấm đúp để về mặc định */
function Resizer() {
  const [w, setW] = useState(SIDE_DEF);
  const [drag, setDrag] = useState(false);
  useEffect(() => {
    try {
      const v = Number(localStorage.getItem(SIDE_KEY));
      if (v >= SIDE_MIN && v <= SIDE_MAX) {
        setW(v);
        setSide(v);
      }
    } catch {}
  }, []);
  const apply = (v: number, save = true) => {
    const x = Math.round(Math.min(SIDE_MAX, Math.max(SIDE_MIN, v)));
    setW(x);
    setSide(x);
    if (save)
      try {
        localStorage.setItem(SIDE_KEY, String(x));
      } catch {}
  };
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Kéo để đổi độ rộng cột menu"
      aria-valuemin={SIDE_MIN}
      aria-valuemax={SIDE_MAX}
      aria-valuenow={w}
      tabIndex={0}
      title="Kéo để đổi độ rộng cột menu (bấm đúp để về mặc định)"
      data-resizer
      className={`group absolute inset-y-0 right-0 z-20 w-2 cursor-col-resize touch-none outline-none ${drag ? "bg-amber-300/60" : "hover:bg-white/25 focus-visible:bg-amber-300/60"}`}
      onPointerDown={(e) => {
        e.preventDefault();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        setDrag(true);
        document.body.style.userSelect = "none";
      }}
      onPointerMove={(e) => drag && apply(e.clientX, false)}
      onPointerUp={(e) => {
        if (!drag) return;
        setDrag(false);
        document.body.style.userSelect = "";
        apply(e.clientX);
      }}
      onDoubleClick={() => apply(SIDE_DEF)}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") apply(w - 16);
        if (e.key === "ArrowRight") apply(w + 16);
      }}
    >
      <span className="pointer-events-none absolute top-1/2 right-0.5 h-10 w-1 -translate-y-1/2 rounded-full bg-white/40 opacity-0 transition group-hover:opacity-100" />
    </div>
  );
}

/** Số trang đã đi qua trong phiên (để biết có trang trước trong phần mềm hay không) */
let visited = 0;

/** Nút quay lại trang trước (hoặc trang cha nếu mở thẳng đường dẫn) */
function BackButton() {
  const router = useRouter();
  const path = usePathname();
  useEffect(() => {
    visited++;
  }, [path]);
  if (path === "/") return null;
  const up = path.split("/").slice(0, -1).join("/") || "/";
  const parent = up === "/m" ? "/" : up === "/quan-tri/mo-dun" ? "/quan-tri?muc=mo_dun" : up === "/in" ? "/bao-cao" : up;
  return (
    <button
      type="button"
      onClick={() => (visited > 1 ? router.back() : router.push(parent))}
      className="flex shrink-0 items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 font-semibold text-slate-700 shadow-soft hover:border-brand-200 hover:text-brand-700"
      aria-label="Quay lại trang trước"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
        <path d="M15 18l-6-6 6-6" />
      </svg>
      <span>Quay lại</span>
    </button>
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
      {/* Thanh bên trên máy tính: ảnh nền + lớp phủ màu để tên module luôn rõ */}
      <aside className="side-bg no-print fixed inset-y-0 left-0 z-30 hidden w-(--side-w) flex-col overflow-hidden text-white lg:flex">
        <script dangerouslySetInnerHTML={{ __html: `try{var w=+localStorage.getItem("${SIDE_KEY}");if(w>=${SIDE_MIN}&&w<=${SIDE_MAX})document.documentElement.style.setProperty("--side-w",w+"px")}catch(e){}` }} />
        {me.menuImg && <div className="side-bg-img" style={{ backgroundImage: `url(${me.menuImg})` }} />}
        <div className="side-shade" style={{ ["--phu" as string]: me.menuImg ? me.phu : 0.15 }} />
        <Link href="/" className="relative flex items-center gap-3 border-b border-white/10 px-5 pt-5 pb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/cong-an-hieu-128.png" alt="Công an hiệu" className="h-12 w-[3.6rem] shrink-0 object-contain drop-shadow-[0_2px_6px_rgb(0_0_0/0.45)]" />
          <span className="min-w-0">
            <span className="block leading-tight font-bold text-white">QLCV Nghị quyết 57-NQ/TW</span>
            <span className="block truncate text-sm text-white/75">{me.ten_xa}</span>
          </span>
        </Link>
        <nav className="relative flex-1 overflow-y-auto px-3 pt-4 pb-4 [scrollbar-color:rgb(255_255_255/0.25)_transparent]">
          <MenuList tree={tree} unread={unread} dark />
        </nav>
        <div className="relative space-y-0.5 border-t border-white/10 bg-black/10 p-3">
          {me.admin && (
            <Link href="/quan-tri" className={`flex items-center gap-3 rounded-xl px-2.5 py-2 font-semibold ${active("/quan-tri") ? "bg-white text-brand-800" : "text-white hover:bg-white/12"}`}>
              <Icon name="cog" className="h-[22px] w-[22px]" />
              Quản trị hệ thống
            </Link>
          )}
          <form action={logoutAction}>
            <button className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 font-semibold text-white hover:bg-red-500/25">
              <Icon name="logout" className="h-[22px] w-[22px] text-rose-300" />
              Đăng xuất
            </button>
          </form>
        </div>
        <Resizer />
      </aside>

      {/* Thanh trên cùng */}
      <header className="no-print sticky top-0 z-20 border-b border-slate-200/70 bg-white/90 backdrop-blur lg:ml-(--side-w)">
        <div className="flex h-16 w-full items-center gap-2 px-3 sm:gap-3 sm:px-5 lg:px-6 2xl:px-8">
          <BackButton />
          <Link href="/" className={`min-w-0 shrink items-center gap-2 lg:hidden ${path === "/" ? "flex" : "hidden sm:flex"}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/cong-an-hieu-128.png" alt="Công an hiệu" className="h-9 w-11 shrink-0 object-contain" />
            <span className="max-w-[38vw] truncate leading-tight font-bold text-slate-900">{me.ten_xa}</span>
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
