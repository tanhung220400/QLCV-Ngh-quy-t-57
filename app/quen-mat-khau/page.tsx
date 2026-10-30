import Link from "next/link";
import { ActionForm, Submit } from "@/components/ActionForm";
import { forgotRequestAction, forgotResetAction } from "@/app/actions/auth";
import { AuthShell } from "@/components/AuthShell";

export const dynamic = "force-dynamic";

export default async function ForgotPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const step2 = sp.b === "2";
  return (
    <AuthShell title="Quên mật khẩu">
      {!step2 ? (
        <>
          <p className="mb-4 text-slate-600">Nhập tên đăng nhập. Phần mềm gửi mã xác nhận qua SMS tới số điện thoại đã đăng ký. Nếu chưa có số điện thoại, yêu cầu được chuyển cho quản trị hệ thống.</p>
          <ActionForm action={forgotRequestAction} className="space-y-4">
            <div>
              <label className="label">Tên đăng nhập</label>
              <input name="ten_dang_nhap" className="input" autoCapitalize="none" autoComplete="username" required autoFocus defaultValue={sp.u || ""} />
            </div>
            <Submit className="btn btn-primary w-full text-lg">Gửi mã xác nhận</Submit>
          </ActionForm>
        </>
      ) : (
        <>
          <p className="mb-4 rounded-xl bg-blue-50 p-3 text-blue-900">
            Nếu tài khoản có số điện thoại, mã 6 số đã được gửi qua SMS (hiệu lực 10 phút). Nếu không nhận được tin, quản trị hệ thống đã nhận yêu cầu và sẽ cấp mật khẩu tạm cho bạn.
          </p>
          <ActionForm action={forgotResetAction} className="space-y-4">
            <input type="hidden" name="ten_dang_nhap" value={sp.u || ""} />
            <div>
              <label className="label">Mã xác nhận (6 số)</label>
              <input name="ma" inputMode="numeric" autoComplete="one-time-code" maxLength={7} className="input text-center text-2xl tracking-[0.4em]" required autoFocus />
            </div>
            <div>
              <label className="label">Mật khẩu mới (ít nhất 8 ký tự)</label>
              <input name="mat_khau_moi" type="password" className="input" autoComplete="new-password" minLength={8} required />
            </div>
            <div>
              <label className="label">Nhập lại mật khẩu mới</label>
              <input name="nhap_lai" type="password" className="input" autoComplete="new-password" minLength={8} required />
            </div>
            <Submit className="btn btn-primary w-full text-lg">Đặt lại mật khẩu</Submit>
          </ActionForm>
          <p className="mt-3 text-center text-sm">
            <Link href={`/quen-mat-khau?u=${encodeURIComponent(sp.u || "")}`} className="text-brand-700 underline">
              Gửi lại mã
            </Link>
          </p>
        </>
      )}
      <p className="mt-6 text-center">
        <Link href="/dang-nhap" className="text-brand-700 underline">
          ‹ Quay lại đăng nhập
        </Link>
      </p>
    </AuthShell>
  );
}
