import QRCode from "qrcode";
import { requireUser, otpUri } from "@/lib/auth";
import { db } from "@/lib/db";
import { ActionForm, Submit } from "@/components/ActionForm";
import { changePasswordAction, enableOtpAction, disableOtpAction, startOtpSetup, delegateAction, cancelDelegateAction, logoutAction } from "@/app/actions/auth";
import { VAI_TRO } from "@/lib/const";
import { fmtDate, vnDate } from "@/lib/time";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function Account({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const sql = await db();
  const cfg = await getSettings();
  let qr: string | null = null;
  let secret: string | null = null;
  if (!user.otp_bat) {
    const cur = (await sql`SELECT otp_bi_mat FROM nguoi_dung WHERE id = ${user.id}`)[0].otp_bi_mat as string | null;
    secret = cur || (await startOtpSetup());
    qr = await QRCode.toDataURL(otpUri(secret, user.ten_dang_nhap), { margin: 1, width: 220 });
  }
  const canDelegate = ["lanh_dao", "truong_don_vi"].includes(user.vai_tro);
  const delegs = canDelegate
    ? await sql`SELECT u.*, n.ho_ten FROM uy_quyen u JOIN nguoi_dung n ON n.id = u.id_nguoi_duoc WHERE u.id_nguoi_uy_quyen = ${user.id} AND NOT u.huy AND u.den_ngay >= ${vnDate()} ORDER BY u.tu_ngay`
    : [];
  const people = canDelegate ? await sql`SELECT id, ho_ten, chuc_vu FROM nguoi_dung WHERE trang_thai = 'hoat_dong' AND id <> ${user.id} AND vai_tro IN ('lanh_dao','truong_don_vi','cong_chuc','tong_hop') ORDER BY ho_ten` : [];
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="h1">Tài khoản</h1>
      <div className="card">
        <div className="text-xl font-bold">{user.ho_ten}</div>
        <div className="text-slate-600">
          {user.chuc_vu} · {user.ten_don_vi} · {VAI_TRO[user.vai_tro]}
        </div>
        <div className="text-slate-500">Tên đăng nhập: {user.ten_dang_nhap}</div>
        {user.linh_vuc_phu_trach.length > 0 && <div className="mt-1 text-sm text-slate-600">Lĩnh vực phụ trách: {user.linh_vuc_phu_trach.join(", ")}</div>}
        <form action={logoutAction} className="mt-3">
          <button className="btn btn-outline">Đăng xuất</button>
        </form>
      </div>

      {canDelegate && (
        <div className="card">
          <h2 className="h2">Ủy quyền khi đi công tác, nghỉ phép</h2>
          <p className="text-sm text-slate-500">Người được ủy quyền xem và xử lý (duyệt, giao việc) thay bạn trong thời gian ủy quyền. Mọi thao tác vẫn ghi tên người thực hiện.</p>
          {delegs.length > 0 && (
            <ul className="mt-2 space-y-2">
              {delegs.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-indigo-50 px-3 py-2">
                  <span className="flex-1">
                    <b>{d.ho_ten}</b> · {fmtDate(d.tu_ngay)} – {fmtDate(d.den_ngay)}
                  </span>
                  <ActionForm action={cancelDelegateAction}>
                    <input type="hidden" name="id" value={d.id} />
                    <Submit className="btn btn-outline btn-sm">Thu hồi</Submit>
                  </ActionForm>
                </li>
              ))}
            </ul>
          )}
          <ActionForm action={delegateAction} className="mt-3 grid gap-2 sm:grid-cols-2">
            <select name="id_nguoi_duoc" className="input sm:col-span-2" required defaultValue="">
              <option value="" disabled>
                Chọn người nhận ủy quyền
              </option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.ho_ten}
                  {p.chuc_vu ? ` — ${p.chuc_vu}` : ""}
                </option>
              ))}
            </select>
            <label>
              <span className="text-sm">Từ ngày</span>
              <input type="date" name="tu_ngay" className="input" defaultValue={vnDate()} required />
            </label>
            <label>
              <span className="text-sm">Đến ngày</span>
              <input type="date" name="den_ngay" className="input" required />
            </label>
            <input name="ghi_chu" className="input sm:col-span-2" placeholder="Ghi chú (đi công tác, nghỉ phép...)" />
            <Submit>Ủy quyền</Submit>
          </ActionForm>
        </div>
      )}

      <div className="card" id="otp">
        <h2 className="h2">Xác thực hai lớp (OTP)</h2>
        {sp.bat_otp && !user.otp_bat && <p className="mt-2 rounded-xl bg-amber-50 p-3 text-amber-900">Quản trị yêu cầu bật xác thực hai lớp cho mọi tài khoản.</p>}
        {user.otp_bat ? (
          <>
            <p className="mt-1 text-emerald-700">✓ Đang bật. Mỗi lần đăng nhập cần nhập mã 6 số từ ứng dụng trên điện thoại.</p>
            {!cfg.bat_buoc_otp && (
              <ActionForm action={disableOtpAction} className="mt-3 flex gap-2">
                <input name="ma" inputMode="numeric" className="input w-40" placeholder="Mã 6 số" required />
                <Submit className="btn btn-outline">Tắt OTP</Submit>
              </ActionForm>
            )}
          </>
        ) : (
          <div className="mt-2 grid gap-4 sm:grid-cols-[220px_1fr]">
            {qr && <img src={qr} alt="Mã QR để quét bằng ứng dụng xác thực" width={220} height={220} className="rounded-lg border" />}
            <div className="space-y-2">
              <ol className="list-decimal space-y-1 pl-5 text-slate-700">
                <li>Cài ứng dụng Google Authenticator hoặc Microsoft Authenticator trên điện thoại.</li>
                <li>Quét mã QR (hoặc nhập khóa: <code className="rounded bg-slate-100 px-1 text-sm break-all">{secret}</code>).</li>
                <li>Nhập mã 6 số ứng dụng hiển thị để bật.</li>
              </ol>
              <ActionForm action={enableOtpAction} className="flex gap-2">
                <input name="ma" inputMode="numeric" className="input w-40" placeholder="Mã 6 số" required />
                <Submit>Bật OTP</Submit>
              </ActionForm>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="h2">Đổi mật khẩu</h2>
        <ActionForm action={changePasswordAction} className="mt-2 grid gap-2 sm:grid-cols-3">
          <input name="mat_khau_cu" type="password" className="input" placeholder="Mật khẩu hiện tại" autoComplete="current-password" required />
          <input name="mat_khau_moi" type="password" className="input" placeholder="Mật khẩu mới (≥ 8 ký tự)" autoComplete="new-password" required minLength={8} />
          <input name="nhap_lai" type="password" className="input" placeholder="Nhập lại" autoComplete="new-password" required minLength={8} />
          <Submit>Đổi mật khẩu</Submit>
        </ActionForm>
      </div>

      <div className="card">
        <h2 className="h2">Cài phần mềm lên điện thoại</h2>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-700">
          <li>
            <b>Android (Chrome):</b> bấm menu ⋮ → “Cài đặt ứng dụng” hoặc “Thêm vào màn hình chính”.
          </li>
          <li>
            <b>iPhone (Safari):</b> bấm nút Chia sẻ → “Thêm vào MH chính”.
          </li>
        </ul>
      </div>
    </div>
  );
}
