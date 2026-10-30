"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { markNotificationsRead } from "@/app/actions/task";

export function MarkRead({ id, href, all, label, children }: { id?: number; href?: string; all?: boolean; label?: string; children?: React.ReactNode }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (all)
    return (
      <button disabled={pending} onClick={() => start(async () => { await markNotificationsRead(); router.refresh(); })} className="btn btn-outline btn-sm">
        {label}
      </button>
    );
  return (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault();
        start(async () => {
          await markNotificationsRead(id ? [id] : undefined);
          if (href && href !== "#") router.push(href);
          else router.refresh();
        });
      }}
      className="block hover:bg-slate-50"
    >
      {children}
    </a>
  );
}
