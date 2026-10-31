import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { loadModule, lookups, recordRights } from "@/lib/records";
import { RecordForm } from "@/components/RecordForm";
import { Crumbs, crumbs } from "@/components/Crumbs";
import { Tile } from "@/components/Nav";

export const dynamic = "force-dynamic";

export default async function NewRecord({ params }: { params: Promise<{ ma: string }> }) {
  const { ma } = await params;
  const user = await requireUser();
  const sql = await db();
  const mod = await loadModule(sql, decodeURIComponent(ma));
  if (!mod || mod.m.loai !== "du_lieu") notFound();
  if (!recordRights(user, mod.m).them) redirect(`/m/${mod.m.ma}`);
  const up = await crumbs(sql, mod.m);
  return (
    <div className="space-y-5">
      <Crumbs up={up} last={{ ten: mod.m.ten, href: `/m/${mod.m.ma}` }} />
      <div className="flex items-center gap-3">
        <Tile icon={mod.m.bieu_tuong} mau={mod.m.mau} size="lg" />
        <h1 className="h1">Thêm mới: {mod.m.ten}</h1>
      </div>
      <div className="card">
        {mod.fields.length ? (
          <RecordForm ma={mod.m.ma} fields={mod.fields} lk={await lookups(sql)} />
        ) : (
          <p className="text-slate-500">Module chưa có trường dữ liệu. Quản trị cần thêm trường trong phần Thiết kế module.</p>
        )}
      </div>
    </div>
  );
}
