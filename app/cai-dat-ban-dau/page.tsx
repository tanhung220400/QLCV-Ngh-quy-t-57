import { redirect } from "next/navigation";
import { ActionForm, Submit } from "@/components/ActionForm";
import { setupAction } from "@/app/actions/auth";
import { db, hasDatabase } from "@/lib/db";
import { AuthShell } from "@/components/AuthShell";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if (!hasDatabase()) {
    return (
      <AuthShell title="Chưa kết nối cơ sở dữ liệu">
        <div className="space-y-3 text-slate-700">
          <p>Phần mềm cần một cơ sở dữ liệu PostgreSQL để lưu công việc và chỉ tiêu.</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Vào Vercel, mở dự án này, chọn thẻ <b>Storage</b>.</li>
            <li>
              Bấm <b>Create Database</b>, chọn <b>Neon</b> (Postgres), vùng <b>Singapore</b>.
            </li>
            <li>
              Bấm <b>Connect</b> để gắn vào dự án, rồi <b>Redeploy</b>.
            </li>
          </ol>
          <p className="text-sm text-slate-500">Biến môi trường cần có: DATABASE_URL (hoặc POSTGRES_URL), AUTH_SECRET, SETUP_KEY.</p>
        </div>
      </AuthShell>
    );
  }
  const sql = await db();
  if ((await sql`SELECT count(*)::int AS n FROM nguoi_dung`)[0].n > 0) redirect("/dang-nhap");
  return (
    <AuthShell title="Khởi tạo phần mềm">
      <p className="mb-4 text-slate-600">Tạo tài khoản quản trị đầu tiên. Bước này chỉ làm một lần.</p>
      <ActionForm action={setupAction} className="space-y-4">
        <div>
          <label className="label req">Mã khởi tạo</label>
          <input name="ma_khoi_tao" className="input" required autoComplete="off" />
          <p className="mt-1 text-sm text-slate-500">Mã do người cài đặt cung cấp (biến SETUP_KEY trên Vercel).</p>
        </div>
        <div>
          <label className="label req">Tên xã</label>
          <input name="ten_xa" className="input" placeholder="Ví dụ: xã Tân Hưng" required />
        </div>
        <div>
          <label className="label req">Họ tên quản trị</label>
          <input name="ho_ten" className="input" required />
        </div>
        <div>
          <label className="label req">Tên đăng nhập</label>
          <input name="ten_dang_nhap" className="input" autoCapitalize="none" placeholder="quantri" required />
        </div>
        <div>
          <label className="label req">Mật khẩu (ít nhất 8 ký tự)</label>
          <input name="mat_khau" type="password" className="input" minLength={8} required autoComplete="new-password" />
        </div>
        <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3">
          <input type="checkbox" name="du_lieu_mau" value="1" defaultChecked className="mt-1 h-5 w-5" />
          <span>
            <b>Tạo dữ liệu mẫu để dùng thử</b>
            <br />
            <span className="text-sm text-slate-500">Một số phòng, cán bộ, công việc và chỉ tiêu mẫu. Có thể khóa tài khoản mẫu sau.</span>
          </span>
        </label>
        <Submit className="btn btn-primary w-full text-lg">Khởi tạo</Submit>
      </ActionForm>
    </AuthShell>
  );
}
