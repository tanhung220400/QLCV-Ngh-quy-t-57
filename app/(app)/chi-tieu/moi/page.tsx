import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canManageKpi } from "@/lib/perm";
import { db } from "@/lib/db";
import { kpiFormOptions } from "@/lib/kpiOptions";
import { KpiForm } from "@/components/KpiForm";

export const dynamic = "force-dynamic";

export default async function NewKpi({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const user = await requireUser();
  if (!canManageKpi(user)) redirect("/chi-tieu");
  const sql = await db();
  const parent = sp.cha ? (await sql`SELECT * FROM chi_tieu WHERE id = ${Number(sp.cha)}`)[0] : undefined;
  const o = await kpiFormOptions();
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <h1 className="h1">{parent ? `Phân rã: ${parent.ten}` : "Thêm chỉ tiêu"}</h1>
      {parent && <p className="text-slate-600">Giao một phần chỉ tiêu xuống đơn vị hoặc thôn. Với chỉ tiêu cộng dồn, tổng các phần nên bằng chỉ tiêu xã ({String(parent.ke_hoach_nam)} {parent.don_vi_tinh}).</p>}
      <div className="card">
        <KpiForm parent={parent} {...o} />
      </div>
    </div>
  );
}
