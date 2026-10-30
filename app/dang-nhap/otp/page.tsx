import { redirect } from "next/navigation";
import { ActionForm, Submit } from "@/components/ActionForm";
import { otpAction } from "@/app/actions/auth";
import { getPendingOtp } from "@/lib/auth";
import { AuthShell } from "@/components/AuthShell";

export const dynamic = "force-dynamic";

export default async function OtpPage() {
  if (!(await getPendingOtp())) redirect("/dang-nhap");
  return (
    <AuthShell title="Xác thực hai lớp">
      <p className="mb-4 text-slate-600">Mở ứng dụng xác thực trên điện thoại (Google Authenticator, Microsoft Authenticator...) và nhập mã 6 số.</p>
      <ActionForm action={otpAction} className="space-y-4">
        <input name="ma" inputMode="numeric" autoComplete="one-time-code" maxLength={7} className="input text-center text-2xl tracking-[0.4em]" required autoFocus />
        <Submit className="btn btn-primary w-full text-lg">Xác nhận</Submit>
      </ActionForm>
    </AuthShell>
  );
}
