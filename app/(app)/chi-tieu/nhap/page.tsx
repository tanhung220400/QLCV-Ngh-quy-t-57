import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canManageKpi } from "@/lib/perm";
import { ActionForm, Submit } from "@/components/ActionForm";
import { importKpiAction } from "@/app/actions/kpi";

export const dynamic = "force-dynamic";

export default async function ImportKpi() {
  const user = await requireUser();
  if (!canManageKpi(user)) redirect("/chi-tieu");
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <h1 className="h1">Nhập chỉ tiêu từ Excel</h1>
      <div className="card space-y-3">
        <ol className="list-decimal space-y-1 pl-5 text-slate-700">
          <li>
            Tải <a href="/api/mau/chi-tieu" className="font-semibold text-brand-700 underline">tệp mẫu Excel</a>.
          </li>
          <li>Điền chỉ tiêu Nghị quyết HĐND xã và chỉ tiêu tỉnh giao (thường 20–40 dòng). Ghi đúng tên đơn vị phụ trách như trong phần mềm.</li>
          <li>Chọn tệp và bấm Nhập. Người phụ trách sẽ nhận thông báo.</li>
        </ol>
        <ActionForm action={importKpiAction} className="space-y-3">
          <input type="file" name="file" accept=".xlsx" className="input" required />
          <Submit>Nhập chỉ tiêu</Submit>
        </ActionForm>
      </div>
    </div>
  );
}
