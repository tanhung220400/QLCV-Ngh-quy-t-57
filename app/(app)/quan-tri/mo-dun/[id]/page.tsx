import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePerm } from "@/lib/auth";
import { db } from "@/lib/db";
import { moduleHref, type MoDun, type Truong } from "@/lib/modules";
import { ModuleForm, FieldList, FieldForm } from "@/components/ModuleAdmin";
import { Tile } from "@/components/Nav";
import { ActionForm, Submit } from "@/components/ActionForm";
import { deleteModuleAction } from "@/app/actions/modules";

export const dynamic = "force-dynamic";

export default async function ModuleEdit({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  await requirePerm("qt.mo_dun");
  const { id: s } = await params;
  const sp = await searchParams;
  const id = Number(s);
  const sql = await db();
  const all = (await sql`SELECT * FROM mo_dun ORDER BY thu_tu, id`) as unknown as MoDun[];
  const m = all.find((x) => x.id === id);
  if (!m) notFound();
  const fields = (await sql`SELECT * FROM mo_dun_truong WHERE id_mo_dun = ${id} ORDER BY thu_tu, id`) as unknown as Truong[];
  const n = (await sql`SELECT count(*)::int AS n FROM mo_dun_ban_ghi WHERE id_mo_dun = ${id}`)[0].n as number;
  const kids = all.filter((x) => x.id_cha === id);

  return (
    <div className="space-y-5">
      <div className="text-sm">
        <Link href="/quan-tri?muc=mo_dun" className="text-brand-700 hover:underline">
          ‹ Module &amp; menu
        </Link>
      </div>
      {sp.moi && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800">Đã tạo module. {m.loai === "du_lieu" ? "Hãy thêm, sửa các trường dữ liệu bên dưới." : ""}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <Tile icon={m.bieu_tuong} mau={m.mau} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="h1">{m.ten}</h1>
          <p className="text-slate-500">
            Mã: <code>{m.ma}</code>
            {m.loai === "du_lieu" ? ` · ${n} bản ghi` : ""}
            {kids.length ? ` · ${kids.length} module con` : ""}
          </p>
        </div>
        <Link href={moduleHref(m)} className="btn btn-outline">
          Mở module
        </Link>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card">
          <h2 className="h2 mb-3">Thông tin, vị trí trên menu</h2>
          <ModuleForm m={m} all={all} />
        </div>
        <div className="space-y-5">
          {m.loai === "du_lieu" && (
            <div className="card">
              <h2 className="h2">Trường dữ liệu ({fields.length})</h2>
              <p className="mb-2 text-sm text-slate-500">Bấm vào trường để sửa. Trường đầu tiên được dùng làm tiêu đề bản ghi.</p>
              <FieldList fields={fields} idMoDun={id} />
              <details className="mt-3 rounded-xl border border-dashed border-brand-200 p-3" open={fields.length === 0}>
                <summary className="cursor-pointer font-semibold text-brand-700">+ Thêm trường</summary>
                <div className="mt-2">
                  <FieldForm idMoDun={id} />
                </div>
              </details>
            </div>
          )}
          {(m.loai === "du_lieu" || m.loai === "nhom") && (
            <div className="card">
              <h2 className="h2">Module con</h2>
              <ul className="mt-2 space-y-1">
                {kids.map((k) => (
                  <li key={k.id}>
                    <Link href={`/quan-tri/mo-dun/${k.id}`} className="text-brand-700 hover:underline">
                      {k.ten}
                    </Link>
                  </li>
                ))}
                {!kids.length && <li className="text-slate-500">Chưa có.</li>}
              </ul>
              <p className="mt-2 text-sm text-slate-500">Tạo module mới ở trang Module &amp; menu và chọn “Nằm trong: {m.ten}”.</p>
            </div>
          )}
          {m.loai !== "he_thong" ? (
            <div className="card border-red-100">
              <h2 className="h2 text-red-700">Xóa module</h2>
              <p className="mt-1 text-sm text-slate-600">
                Xóa cả module con và toàn bộ {n} bản ghi. Mọi thứ được chuyển vào Thùng rác và khôi phục được.
              </p>
              <ActionForm action={deleteModuleAction} confirm={`Xóa module “${m.ten}”?`} className="mt-2 flex flex-wrap gap-2">
                <input type="hidden" name="id" value={id} />
                <input name="ly_do" className="input max-w-xs flex-1" placeholder="Lý do (không bắt buộc)" />
                <Submit className="btn btn-danger">Xóa module</Submit>
              </ActionForm>
            </div>
          ) : (
            <p className="card text-sm text-slate-500">Đây là chức năng có sẵn của phần mềm: có thể đổi tên, biểu tượng, vị trí, ẩn/hiện nhưng không xóa.</p>
          )}
        </div>
      </div>
    </div>
  );
}
