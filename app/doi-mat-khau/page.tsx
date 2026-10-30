import { redirect } from "next/navigation";
import { ActionForm, Submit } from "@/components/ActionForm";
import { changePasswordAction } from "@/app/actions/auth";
import { getUser } from "@/lib/auth";
import { AuthShell } from "@/components/AuthShell";

export const dynamic = "force-dynamic";

export default async function ChangePw() {
  const u = await getUser();
  if (!u) redirect("/dang-nhap");
  return (
    <AuthShell title="Đổi mật khẩu" sub={u.ho_ten}>
      {u.doi_mat_khau && <p className="mb-4 rounded-xl bg-amber-50 p-3 text-amber-900">Bạn cần đổi mật khẩu do quản trị cấp trước khi sử dụng.</p>}
      <PwForm />
    </AuthShell>
  );
}

function PwForm() {
  return (
    <ActionForm action={changePasswordAction} className="space-y-4">
      <div>
        <label className="label">Mật khẩu hiện tại</label>
        <input name="mat_khau_cu" type="password" className="input" autoComplete="current-password" required />
      </div>
      <div>
        <label className="label">Mật khẩu mới (ít nhất 8 ký tự)</label>
        <input name="mat_khau_moi" type="password" className="input" autoComplete="new-password" required minLength={8} />
      </div>
      <div>
        <label className="label">Nhập lại mật khẩu mới</label>
        <input name="nhap_lai" type="password" className="input" autoComplete="new-password" required minLength={8} />
      </div>
      <Submit className="btn btn-primary w-full">Đổi mật khẩu</Submit>
    </ActionForm>
  );
}
