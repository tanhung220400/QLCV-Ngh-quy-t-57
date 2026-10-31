import Link from "next/link";
import type { db } from "@/lib/db";
import { moduleHref, type MoDun } from "@/lib/modules";
import { Icon } from "./Icon";

export async function crumbs(sql: Awaited<ReturnType<typeof db>>, m: MoDun) {
  const up = (await sql`WITH RECURSIVE up AS (SELECT id, id_cha, ten, ma, loai, duong_dan, 0 AS d FROM mo_dun WHERE id = ${m.id_cha ?? -1}
    UNION SELECT x.id, x.id_cha, x.ten, x.ma, x.loai, x.duong_dan, up.d + 1 FROM mo_dun x JOIN up ON x.id = up.id_cha) SELECT * FROM up ORDER BY d DESC`) as unknown as MoDun[];
  return up;
}

export function Crumbs({ up, last }: { up: MoDun[]; last?: { ten: string; href: string } }) {
  return (
    <nav className="flex flex-wrap items-center gap-1 text-sm text-slate-500">
      <Link href="/" className="hover:text-brand-700">
        Trang chủ
      </Link>
      {up.map((p) => (
        <span key={p.id} className="flex items-center gap-1">
          <Icon name="chevron" className="h-4 w-4" />
          <Link href={moduleHref(p)} className="hover:text-brand-700">
            {p.ten}
          </Link>
        </span>
      ))}
      {last && (
        <span className="flex items-center gap-1">
          <Icon name="chevron" className="h-4 w-4" />
          <Link href={last.href} className="hover:text-brand-700">
            {last.ten}
          </Link>
        </span>
      )}
    </nav>
  );
}

