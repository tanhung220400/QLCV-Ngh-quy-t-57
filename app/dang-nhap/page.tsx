import { redirect } from "next/navigation";
import { ActionForm, Submit } from "@/components/ActionForm";
import { loginAction } from "@/app/actions/auth";
import { getUser } from "@/lib/auth";
import { db, hasDatabase } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { AuthShell } from "@/components/AuthShell";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (!hasDatabase()) redirect("/cai-dat-ban-dau");
  const sql = await db();
  if ((await sql`SELECT count(*)::int AS n FROM nguoi_dung`)[0].n === 0) redirect("/cai-dat-ban-dau");
  if (await getUser()) redirect("/");
  const cfg = await getSettings();
  const demo = (await sql`SELECT 1 FROM nguoi_dung WHERE ten_dang_nhap = 'chutich' LIMIT 1`).length > 0;
  return (
    <AuthShell title="Đăng nhập" sub={cfg.ten_don_vi}>
      <ActionForm action={loginAction} className="space-y-4">
        <div>
          <label className="label" htmlFor="u">
            Tên đăng nhập
          </label>
          <input id="u" name="ten_dang_nhap" className="input" autoComplete="username" autoCapitalize="none" required autoFocus />
        </div>
        <div>
          <label className="label" htmlFor="p">
            Mật khẩu
          </label>
          <input id="p" name="mat_khau" type="password" className="input" autoComplete="current-password" required />
        </div>
        <Submit className="btn btn-primary w-full text-lg">Đăng nhập</Submit>
      </ActionForm>
      {demo && (
        <details className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <summary className="cursor-pointer font-semibold">Tài khoản dùng thử (dữ liệu mẫu)</summary>
          <p className="mt-2">
            Mật khẩu chung: <b>Demo@2026</b>
          </p>
          <ul className="mt-1 list-disc pl-5">
            <li>chutich — Chủ tịch UBND (xem toàn xã)</li>
            <li>pct.kinhte — Phó Chủ tịch phụ trách kinh tế</li>
            <li>tp.kinhte — Trưởng phòng Kinh tế</li>
            <li>cv.kinhte1 — Chuyên viên</li>
            <li>vanphong — Văn phòng (tổng hợp)</li>
            <li>thon.dong — Trưởng thôn</li>
          </ul>
          <p className="mt-2">Quản trị nên khóa các tài khoản này khi dùng thật.</p>
        </details>
      )}
    </AuthShell>
  );
}
