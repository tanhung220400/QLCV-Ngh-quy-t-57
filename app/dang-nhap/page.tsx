import { redirect } from "next/navigation";
import { ActionForm, Submit } from "@/components/ActionForm";
import { loginAction } from "@/app/actions/auth";
import { getUser } from "@/lib/auth";
import { db, hasDatabase } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { AuthShell } from "@/components/AuthShell";
import { LoginFields } from "@/components/LoginFields";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  if (!hasDatabase()) redirect("/cai-dat-ban-dau");
  const sql = await db();
  if (!(await sql`SELECT 1 FROM nguoi_dung LIMIT 1`).length) redirect("/cai-dat-ban-dau");
  if (await getUser()) redirect("/");
  const cfg = await getSettings();
  return (
    <AuthShell title="Đăng nhập" sub={cfg.ten_hien_thi || cfg.ten_don_vi}>
      {sp.dat_lai && <p className="mb-4 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-emerald-800">Đã đặt lại mật khẩu. Mời đăng nhập.</p>}
      <ActionForm action={loginAction} className="space-y-4">
        <LoginFields />
        <Submit className="btn btn-primary w-full text-lg">Đăng nhập</Submit>
      </ActionForm>
    </AuthShell>
  );
}
