import Link from "next/link";
import { requirePerm } from "@/lib/auth";
import { PermissionEditor } from "@/components/PermissionEditor";
import { tinhQuyen, LOAI_PHAM_VI } from "@/lib/quyen";
import { getSmsConfig, SU_KIEN_SMS, smsReady } from "@/lib/sms";
import { db } from "@/lib/db";
import { getCatalog, getSettings } from "@/lib/settings";
import { ActionForm, Submit } from "@/components/ActionForm";
import { catalogItemAction, trashAction, seedDemoAction, saveThemeAction } from "@/app/actions/admin";
import { ThemeUpload } from "@/components/ThemeUpload";
import { getTheme, themeImageUrl } from "@/lib/theme";
import { ModuleTree, ModuleForm, TemplateForm } from "@/components/ModuleAdmin";
import { Icon } from "@/components/Icon";
import type { MoDun } from "@/lib/modules";
import { saveUnitAction, saveUserAction, resetPasswordAction, importUsersAction, saveHolidaysAction, saveSettingsAction, saveSmsAction, testSmsAction } from "@/app/actions/admin";
import { VAI_TRO, LOAI_DON_VI } from "@/lib/const";
import { fmtDate, fmtDateTime } from "@/lib/time";

export const dynamic = "force-dynamic";

const MUC: [string, string, string][] = [
  ["mo_dun", "Module & menu", "qt.mo_dun"],
  ["nguoi_dung", "Cán bộ, phân quyền", "qt.nguoi_dung"],
  ["don_vi", "Cơ cấu tổ chức", "qt.co_cau"],
  ["danh_muc", "Danh mục", "qt.co_cau"],
  ["ngay_nghi", "Ngày nghỉ, lễ", "qt.co_cau"],
  ["giao_dien", "Giao diện, màn hình chào", "qt.cai_dat"],
  ["cai_dat", "Cài đặt, mẫu báo cáo", "qt.cai_dat"],
  ["sms", "Tin nhắn SMS", "qt.cai_dat"],
  ["thung_rac", "Thùng rác, dữ liệu", "qt.du_lieu"],
  ["nhat_ky", "Nhật ký thao tác", "qt.nhat_ky"],
];
const DM: Record<string, string> = { linh_vuc: "Lĩnh vực", nguon_giao: "Nguồn giao việc", san_pham: "Sản phẩm đầu ra", nhom_chi_tieu: "Nhóm chỉ tiêu", don_vi_tinh: "Đơn vị tính", nguon_chi_tieu: "Nguồn chỉ tiêu" };

export default async function Admin({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const me = await requirePerm("qt.nguoi_dung", "qt.co_cau", "qt.cai_dat", "qt.nhat_ky", "qt.mo_dun", "qt.du_lieu");
  const allowed = MUC.filter((m) => me.quyen.includes(m[2]));
  const muc = allowed.some((m) => m[0] === sp.muc) ? sp.muc : allowed[0][0];
  const sql = await db();
  const units = await sql`SELECT d.*, c.ten AS ten_cha, (SELECT count(*)::int FROM nguoi_dung n WHERE n.id_don_vi = d.id) AS so_nguoi FROM don_vi d LEFT JOIN don_vi c ON c.id = d.id_cha ORDER BY d.thu_tu, d.ten`;
  const linhVuc = await getCatalog("linh_vuc");

  return (
    <div className="space-y-4">
      <h1 className="h1">Quản trị hệ thống</h1>
      <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1">
        {allowed.map(([k, l]) => (
          <Link key={k} href={`/quan-tri?muc=${k}`} className={`tab ${muc === k ? "tab-on" : ""}`}>
            {l}
          </Link>
        ))}
      </div>

      {muc === "nguoi_dung" && <Users units={units as never} linhVuc={linhVuc} edit={Number(sp.sua) || 0} q={sp.q || ""} />}

      {muc === "don_vi" && (
        <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
          <div className="card overflow-x-auto">
            <table className="tbl min-w-[560px]">
              <thead>
                <tr>
                  <th>Đơn vị</th>
                  <th>Loại</th>
                  <th>Trực thuộc</th>
                  <th>Cán bộ</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {units.map((u) => (
                  <tr key={u.id} className={u.hoat_dong ? "" : "text-slate-400"}>
                    <td className="font-medium">{u.ten}</td>
                    <td>{LOAI_DON_VI[u.loai]}</td>
                    <td>{u.ten_cha || ""}</td>
                    <td>{u.so_nguoi}</td>
                    <td>
                      <details>
                        <summary className="cursor-pointer text-brand-700">Sửa</summary>
                        <UnitForm u={u as never} units={units as never} />
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card">
            <h2 className="h2">Thêm đơn vị</h2>
            <UnitForm units={units as never} />
          </div>
        </div>
      )}

      {muc === "danh_muc" && <Catalogs open={sp.loai || "linh_vuc"} />}
      {muc === "mo_dun" && <Modules deleted={!!sp.xoa} />}
      {muc === "thung_rac" && <Trash />}
      {muc === "giao_dien" && <Theme />}
      {muc === "ngay_nghi" && <Holidays />}
      {muc === "cai_dat" && <Settings />}
      {muc === "nhat_ky" && <Logs q={sp.q || ""} />}
      {muc === "sms" && <Sms />}
    </div>
  );
}

function UnitForm({ u, units }: { u?: Record<string, never>; units: { id: number; ten: string }[] }) {
  return (
    <ActionForm action={saveUnitAction} className="mt-2 space-y-2">
      {u && <input type="hidden" name="id" value={u.id} />}
      <input name="ten" className="input" defaultValue={u?.ten} placeholder="Tên đơn vị" required />
      <select name="loai" className="input" defaultValue={u?.loai || "phong"}>
        {Object.entries(LOAI_DON_VI).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
      <select name="id_cha" className="input" defaultValue={u?.id_cha ?? ""}>
        <option value="">Không trực thuộc</option>
        {units
          .filter((x) => x.id !== u?.id)
          .map((x) => (
            <option key={x.id} value={x.id}>
              {x.ten}
            </option>
          ))}
      </select>
      <input name="thu_tu" type="number" className="input" defaultValue={u?.thu_tu ?? 0} placeholder="Thứ tự" />
      {u && (
        <select name="hoat_dong" className="input" defaultValue={u.hoat_dong ? "1" : "0"}>
          <option value="1">Đang hoạt động</option>
          <option value="0">Ngừng (ẩn khỏi danh sách giao)</option>
        </select>
      )}
      <Submit className="btn btn-primary btn-sm">Lưu</Submit>
    </ActionForm>
  );
}

async function Users({ units, linhVuc, edit, q }: { units: { id: number; ten: string }[]; linhVuc: string[]; edit: number; q: string }) {
  const sql = await db();
  const users = await sql`SELECT n.*, d.ten AS ten_don_vi FROM nguoi_dung n LEFT JOIN don_vi d ON d.id = n.id_don_vi
    WHERE ${q ? sql`(n.ho_ten ILIKE ${"%" + q + "%"} OR n.ten_dang_nhap ILIKE ${"%" + q + "%"})` : sql`TRUE`}
    ORDER BY d.thu_tu NULLS LAST, n.ho_ten`;
  const cur = edit ? users.find((u) => u.id === edit) : null;
  const form = (u?: Record<string, never> | null) => (
    <ActionForm key={u?.id ?? "moi"} action={saveUserAction} className="grid gap-2 sm:grid-cols-2">
      {u && <input type="hidden" name="id" value={u.id} />}
      <input name="ho_ten" className="input" placeholder="Họ tên" defaultValue={u?.ho_ten} required />
      <input name="ten_dang_nhap" className="input" placeholder="Tên đăng nhập (không dấu)" defaultValue={u?.ten_dang_nhap} autoCapitalize="none" required />
      <select name="id_don_vi" className="input" defaultValue={u?.id_don_vi ?? ""}>
        <option value="">— Đơn vị —</option>
        {units.map((x) => (
          <option key={x.id} value={x.id}>
            {x.ten}
          </option>
        ))}
      </select>
      <input name="chuc_vu" className="input" placeholder="Chức vụ" defaultValue={u?.chuc_vu ?? ""} />
      <input name="sdt" className="input" inputMode="tel" placeholder="Số điện thoại (nhận SMS nhắc việc)" defaultValue={u?.sdt ?? ""} />
      <div className="sm:col-span-2">
        <label className="label">Lĩnh vực phụ trách (với lãnh đạo; để trống = toàn xã)</label>
        <div className="flex flex-wrap gap-2">
          {linhVuc.map((l) => (
            <label key={l} className="chip cursor-pointer border-slate-300 bg-white py-1">
              <input type="checkbox" name="linh_vuc_phu_trach" value={l} defaultChecked={(u?.linh_vuc_phu_trach as unknown as string[] | undefined)?.includes(l)} className="mr-1.5" />
              {l}
            </label>
          ))}
        </div>
      </div>
      <PermissionEditor
        key={u?.id ?? "moi"}
        vaiTro={(u?.vai_tro as unknown as string) || "cong_chuc"}
        quyen={u ? [...tinhQuyen(u.vai_tro as unknown as string, u.quyen as never)] : null}
        phamVi={(u?.pham_vi as never) ?? null}
        units={units}
        linhVuc={linhVuc}
      />
      {u && (
        <select name="trang_thai" className="input" defaultValue={u.trang_thai}>
          <option value="hoat_dong">Đang hoạt động</option>
          <option value="khoa">Khóa tài khoản</option>
        </select>
      )}
      <Submit className="btn btn-primary">{u ? "Lưu thay đổi" : "Tạo tài khoản"}</Submit>
    </ActionForm>
  );
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="h2">{cur ? `Sửa: ${cur.ho_ten}` : "Thêm cán bộ"}</h2>
          <p className="mb-2 text-sm text-slate-500">Phân quyền theo chức vụ + đơn vị. Khi luân chuyển cán bộ, chỉ cần đổi đơn vị, chức vụ, vai trò.</p>
          {form(cur as never)}
          {cur && (
            <ActionForm action={resetPasswordAction} className="mt-3 border-t border-slate-200 pt-3" confirm="Cấp lại mật khẩu tạm cho cán bộ này?">
              <input type="hidden" name="id" value={cur.id} />
              <Submit className="btn btn-outline btn-sm">Cấp lại mật khẩu</Submit>
            </ActionForm>
          )}
        </div>
        <div className="card">
          <h2 className="h2">Nhập danh sách cán bộ từ Excel</h2>
          <p className="text-sm text-slate-500">
            Tải <a href="/api/mau/can-bo" className="text-brand-700 underline">tệp mẫu</a>. Đơn vị chưa có sẽ tự tạo. Mỗi tài khoản nhận mật khẩu tạm, phải đổi khi đăng nhập lần đầu.
          </p>
          <ActionForm action={importUsersAction} className="mt-2 space-y-2">
            <input type="file" name="file" accept=".xlsx" className="input" required />
            <Submit className="btn btn-primary">Nhập</Submit>
          </ActionForm>
        </div>
      </div>
      <div className="card overflow-x-auto">
        <form className="mb-3 flex gap-2" action="/quan-tri">
          <input type="hidden" name="muc" value="nguoi_dung" />
          <input name="q" defaultValue={q} placeholder="Tìm theo tên" className="input max-w-xs" />
          <button className="btn btn-outline">Tìm</button>
        </form>
        <table className="tbl min-w-[720px]">
          <thead>
            <tr>
              <th>Họ tên</th>
              <th>Tên đăng nhập</th>
              <th>Đơn vị · Chức vụ</th>
              <th>Vai trò</th>
              <th>OTP</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={u.trang_thai === "khoa" ? "text-slate-400" : ""}>
                <td className="font-medium">
                  {u.ho_ten}
                  {u.trang_thai === "khoa" && " (đã khóa)"}
                </td>
                <td>{u.ten_dang_nhap}</td>
                <td>
                  {u.ten_don_vi}
                  {u.chuc_vu ? ` · ${u.chuc_vu}` : ""}
                </td>
                <td>
                  {VAI_TRO[u.vai_tro]}
                  {u.linh_vuc_phu_trach?.length ? <span className="block text-xs text-slate-500">{u.linh_vuc_phu_trach.join(", ")}</span> : null}
                  {u.pham_vi?.loai && <span className="block text-xs text-indigo-700">Phạm vi: {LOAI_PHAM_VI[u.pham_vi.loai as keyof typeof LOAI_PHAM_VI]}</span>}
                  {u.quyen && (u.quyen.them?.length || u.quyen.bo?.length) ? (
                    <span className="block text-xs text-amber-700">
                      Quyền riêng: {u.quyen.them?.length ? `+${u.quyen.them.length}` : ""} {u.quyen.bo?.length ? `−${u.quyen.bo.length}` : ""}
                    </span>
                  ) : null}
                </td>
                <td>{u.otp_bat ? "✓" : ""}</td>
                <td>
                  <Link href={`/quan-tri?muc=nguoi_dung&sua=${u.id}`} className="text-brand-700 underline">
                    Sửa
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

async function Holidays() {
  const sql = await db();
  const rows = await sql`SELECT to_char(ngay, 'DD/MM/YYYY') AS d, ten FROM ngay_nghi ORDER BY ngay`;
  return (
    <div className="card max-w-2xl">
      <h2 className="h2">Ngày nghỉ lễ, Tết</h2>
      <p className="text-sm text-slate-500">Dùng để tính hạn theo ngày làm việc (trừ thứ Bảy, Chủ nhật và các ngày dưới đây). Mỗi dòng: dd/mm/yyyy - Tên. Kiểm tra lại theo thông báo nghỉ lễ chính thức hằng năm.</p>
      <ActionForm action={saveHolidaysAction} className="mt-2 space-y-2">
        <textarea name="ds" rows={16} className="input font-mono text-sm" defaultValue={rows.map((r) => `${r.d} - ${r.ten}`).join("\n")} />
        <Submit>Lưu ngày nghỉ</Submit>
      </ActionForm>
    </div>
  );
}

async function Settings() {
  const c = await getSettings();
  return (
    <ActionForm action={saveSettingsAction} className="grid gap-4 lg:grid-cols-2">
      <div className="card space-y-3">
        <h2 className="h2">Thông tin đơn vị và mẫu báo cáo Word</h2>
        <label className="block">
          <span className="label">Tên cơ quan cấp trên (dòng 1 góc trái, có thể để trống)</span>
          <input name="ten_cap_tren" className="input" defaultValue={c.ten_cap_tren} />
        </label>
        <label className="block">
          <span className="label req">Tên cơ quan ban hành</span>
          <input name="ten_don_vi" className="input" defaultValue={c.ten_don_vi} required />
        </label>
        <label className="block">
          <span className="label">Tên hiển thị trên phần mềm (góc trên bên trái, màn hình chào, trang đăng nhập)</span>
          <input name="ten_hien_thi" className="input" defaultValue={c.ten_hien_thi} placeholder={`Để trống thì dùng “${c.ten_don_vi}”`} />
          <span className="text-sm text-slate-500">Không ảnh hưởng tên cơ quan in trên báo cáo Word.</span>
        </label>
        <label className="block">
          <span className="label">Địa danh (ví dụ: Tân Hưng)</span>
          <input name="dia_danh" className="input" defaultValue={c.dia_danh} />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="label">Chức vụ người ký</span>
            <input name="chuc_vu_ky" className="input" defaultValue={c.chuc_vu_ky} />
          </label>
          <label className="block">
            <span className="label">Họ tên người ký</span>
            <input name="nguoi_ky" className="input" defaultValue={c.nguoi_ky} />
          </label>
        </div>
        <label className="block">
          <span className="label">Nơi nhận</span>
          <textarea name="noi_nhan" rows={4} className="input" defaultValue={c.noi_nhan} />
        </label>
      </div>
      <div className="card space-y-3">
        <h2 className="h2">Nhắc việc và cảnh báo</h2>
        <label className="block">
          <span className="label">Cảnh báo vàng khi còn (ngày làm việc)</span>
          <input name="nguong_vang" type="number" min={1} className="input" defaultValue={c.nguong_vang} />
        </label>
        <label className="block">
          <span className="label">Nhắc trước hạn (ngày làm việc, cách nhau dấu phẩy)</span>
          <input name="nhac_truoc" className="input" defaultValue={c.nhac_truoc.join(", ")} />
        </label>
        <label className="block">
          <span className="label">Báo người giao và lãnh đạo lĩnh vực khi quá hạn (ngày làm việc)</span>
          <input name="bao_cap_tren_sau" type="number" min={1} className="input" defaultValue={c.bao_cap_tren_sau} />
        </label>
        <label className="block">
          <span className="label">Nhắc người giao khi chưa nhận việc sau (giờ)</span>
          <input name="nhac_nhan_viec_gio" type="number" min={1} className="input" defaultValue={c.nhac_nhan_viec_gio} />
        </label>
        <label className="block">
          <span className="label">Giờ gửi tin tóm tắt hằng ngày</span>
          <input name="gio_tom_tat" type="time" className="input" defaultValue={c.gio_tom_tat} />
        </label>
        <label className="block">
          <span className="label">Ngưỡng nguy cơ chỉ tiêu (điểm %)</span>
          <input name="nguong_nguy_co" type="number" min={1} className="input" defaultValue={c.nguong_nguy_co} />
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="bat_buoc_otp" value="1" defaultChecked={c.bat_buoc_otp} className="h-5 w-5" /> Bắt buộc mọi tài khoản bật xác thực hai lớp (OTP)
        </label>
        <Submit>Lưu cài đặt</Submit>
      </div>
    </ActionForm>
  );
}

async function Logs({ q }: { q: string }) {
  const sql = await db();
  const rows = await sql`SELECT k.*, n.ho_ten FROM nhat_ky k LEFT JOIN nguoi_dung n ON n.id = k.id_nguoi_dung
    WHERE ${q ? sql`(k.hanh_dong ILIKE ${"%" + q + "%"} OR n.ho_ten ILIKE ${"%" + q + "%"})` : sql`TRUE`}
    ORDER BY k.id DESC LIMIT 300`;
  const total = (await sql`SELECT count(*)::int AS n FROM nhat_ky`)[0].n;
  return (
    <div className="card overflow-x-auto">
      <p className="text-sm text-slate-500">
        {total} bản ghi. Nhật ký được khóa ở mức cơ sở dữ liệu: không ai (kể cả quản trị) sửa hoặc xóa được. Hiển thị 300 bản ghi gần nhất.
      </p>
      <form className="my-3 flex gap-2" action="/quan-tri">
        <input type="hidden" name="muc" value="nhat_ky" />
        <input name="q" defaultValue={q} placeholder="Lọc theo người hoặc hành động" className="input max-w-xs" />
        <button className="btn btn-outline">Lọc</button>
      </form>
      <table className="tbl min-w-[720px] text-sm">
        <thead>
          <tr>
            <th>Thời gian</th>
            <th>Người</th>
            <th>Hành động</th>
            <th>Đối tượng</th>
            <th>Chi tiết</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={String(r.id)}>
              <td className="whitespace-nowrap">{fmtDateTime(r.thoi_gian)}</td>
              <td>{r.ho_ten || "Hệ thống"}</td>
              <td>{r.hanh_dong}</td>
              <td>
                {r.doi_tuong === "cong_viec" && r.id_doi_tuong ? (
                  <Link className="text-brand-700 underline" href={`/viec/${r.id_doi_tuong}`}>
                    Việc #{r.id_doi_tuong}
                  </Link>
                ) : r.doi_tuong === "chi_tieu" && r.id_doi_tuong ? (
                  <Link className="text-brand-700 underline" href={`/chi-tieu/${r.id_doi_tuong}`}>
                    Chỉ tiêu #{r.id_doi_tuong}
                  </Link>
                ) : (
                  `${r.doi_tuong}${r.id_doi_tuong ? ` #${r.id_doi_tuong}` : ""}`
                )}
              </td>
              <td className="max-w-md truncate text-slate-500" title={JSON.stringify(r.gia_tri_moi)}>
                {r.gia_tri_moi ? JSON.stringify(r.gia_tri_moi).slice(0, 120) : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-slate-400">{fmtDate(new Date())}</p>
    </div>
  );
}

async function Sms() {
  const c = await getSmsConfig(true);
  const sql = await db();
  const log = await sql`SELECT s.*, n.ho_ten FROM sms_hang_doi s LEFT JOIN nguoi_dung n ON n.id = s.id_nguoi_nhan ORDER BY s.id DESC LIMIT 40`;
  const stat = (await sql`SELECT trang_thai, count(*)::int AS n FROM sms_hang_doi WHERE tao_luc > now() - interval '30 days' GROUP BY trang_thai`) as unknown as { trang_thai: string; n: number }[];
  const noPhone = (await sql`SELECT count(*)::int AS n FROM nguoi_dung WHERE trang_thai = 'hoat_dong' AND vai_tro <> 'quan_tri' AND (sdt IS NULL OR sdt = '')`)[0].n;
  const mask = (v: string) => (v ? "•".repeat(Math.min(12, v.length)) : "");
  const ready = smsReady(c);
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
      <ActionForm action={saveSmsAction} className="card space-y-3">
        <h2 className="h2">Gửi thông báo qua SMS</h2>
        <p className={`rounded-xl px-3 py-2 ${ready ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>
          {ready ? "Đang bật, SMS được gửi tự động." : c.bat ? "Đã bật nhưng còn thiếu khóa API." : "Đang tắt. Thông báo chỉ hiện trong ứng dụng."}
        </p>
        <label className="flex items-center gap-2 font-semibold">
          <input type="checkbox" name="bat" value="1" defaultChecked={c.bat} className="h-5 w-5" /> Bật gửi SMS
        </label>
        <label className="block">
          <span className="label">Nhà cung cấp</span>
          <select name="nha_cung_cap" className="input" defaultValue={c.nha_cung_cap}>
            <option value="esms">eSMS.vn</option>
            <option value="speedsms">SpeedSMS.vn</option>
            <option value="twilio">Twilio</option>
            <option value="webhook">Cổng riêng (webhook của tỉnh / nhà mạng)</option>
          </select>
        </label>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block">
            <span className="label">API Key / Access token</span>
            <input name="api_key" className="input" placeholder={mask(c.api_key) || "eSMS, SpeedSMS"} autoComplete="off" />
          </label>
          <label className="block">
            <span className="label">Secret Key</span>
            <input name="secret_key" className="input" placeholder={mask(c.secret_key) || "chỉ eSMS"} autoComplete="off" />
          </label>
          <label className="block">
            <span className="label">Brandname (tên người gửi)</span>
            <input name="brandname" className="input" defaultValue={c.brandname} placeholder="Đã đăng ký với nhà mạng" />
          </label>
          <label className="block">
            <span className="label">Loại tin (SmsType)</span>
            <input name="sms_type" className="input" defaultValue={c.sms_type} />
          </label>
          <label className="block">
            <span className="label">Twilio Account SID</span>
            <input name="twilio_sid" className="input" placeholder={mask(c.twilio_sid)} autoComplete="off" />
          </label>
          <label className="block">
            <span className="label">Twilio Auth Token</span>
            <input name="twilio_token" className="input" placeholder={mask(c.twilio_token)} autoComplete="off" />
          </label>
          <label className="block">
            <span className="label">Twilio số gửi</span>
            <input name="twilio_from" className="input" defaultValue={c.twilio_from} />
          </label>
          <label className="block">
            <span className="label">Webhook URL</span>
            <input name="webhook_url" className="input" defaultValue={c.webhook_url} placeholder="https://..." />
          </label>
          <label className="block">
            <span className="label">Webhook token</span>
            <input name="webhook_token" className="input" placeholder={mask(c.webhook_token)} autoComplete="off" />
          </label>
          <label className="block">
            <span className="label">Tiền tố đầu tin</span>
            <input name="tien_to" className="input" defaultValue={c.tien_to} />
          </label>
        </div>
        <p className="text-sm text-slate-500">Ô khóa để trống thì giữ nguyên khóa đã lưu. Tin được gửi không dấu, kèm đường dẫn mở công việc.</p>
        <fieldset>
          <legend className="label">Gửi SMS khi</legend>
          {Object.entries(SU_KIEN_SMS).map(([k, v]) => (
            <label key={k} className="flex items-center gap-2 py-0.5">
              <input type="checkbox" name="su_kien" value={k} defaultChecked={c.su_kien.includes(k)} className="h-5 w-5" /> {v}
            </label>
          ))}
        </fieldset>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="label">Không gửi từ</span>
            <input type="time" name="im_lang_tu" className="input" defaultValue={c.im_lang_tu} />
          </label>
          <label className="block">
            <span className="label">đến</span>
            <input type="time" name="im_lang_den" className="input" defaultValue={c.im_lang_den} />
          </label>
        </div>
        <Submit>Lưu cài đặt SMS</Submit>
      </ActionForm>
      <div className="space-y-4">
        <ActionForm action={testSmsAction} className="card space-y-2">
          <h2 className="h2">Gửi tin thử</h2>
          <input name="sdt" className="input" inputMode="tel" placeholder="Số điện thoại nhận thử" required />
          <Submit className="btn btn-outline">Gửi thử</Submit>
        </ActionForm>
        <div className="card">
          <h2 className="h2">30 ngày qua</h2>
          <p className="mt-1">
            Đã gửi: <b>{stat.find((x) => x.trang_thai === "da_gui")?.n ?? 0}</b> · Chờ: <b>{stat.find((x) => x.trang_thai === "cho")?.n ?? 0}</b> · Lỗi: <b>{stat.find((x) => x.trang_thai === "loi")?.n ?? 0}</b>
          </p>
          {noPhone > 0 && (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {noPhone} cán bộ chưa có số điện thoại nên sẽ không nhận được SMS. Bổ sung ở mục Cán bộ, phân quyền.
            </p>
          )}
          <ul className="mt-3 max-h-96 space-y-2 overflow-y-auto text-sm">
            {log.map((r) => (
              <li key={r.id} className="border-b border-slate-100 pb-1">
                <span className={r.trang_thai === "da_gui" ? "text-emerald-700" : r.trang_thai === "loi" ? "text-red-700" : "text-slate-500"}>
                  {r.trang_thai === "da_gui" ? "✓ Đã gửi" : r.trang_thai === "loi" ? "✕ Lỗi" : "… Chờ"}
                </span>{" "}
                · {r.ho_ten || r.sdt} · {fmtDateTime(r.tao_luc)}
                <span className="block text-slate-600">{r.noi_dung}</span>
                {r.loi && <span className="block text-red-700">{r.loi}</span>}
              </li>
            ))}
            {log.length === 0 && <li className="text-slate-500">Chưa có tin nào.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}

const LOAI_RAC: Record<string, string> = { cong_viec: "Công việc", chi_tieu: "Chỉ tiêu", ban_ghi: "Bản ghi", mo_dun: "Module", so_lieu: "Số liệu", binh_luan: "Trao đổi", tep: "Tệp" };

async function Catalogs({ open }: { open: string }) {
  const sql = await db();
  return (
    <div className="space-y-3">
      <p className="text-slate-600">Thêm, đổi tên, xóa, sắp xếp từng mục. Đổi tên sẽ tự cập nhật các công việc, chỉ tiêu, cán bộ, bản ghi đang dùng tên cũ.</p>
      <div className="grid gap-4 lg:grid-cols-2">
        {await Promise.all(
          Object.entries(DM).map(async ([k, l]) => {
            const rows = await sql`SELECT id, ten FROM danh_muc WHERE loai = ${k} ORDER BY thu_tu, id`;
            const used = new Map<string, number>();
            const col: Record<string, [string, string][]> = {
              linh_vuc: [["cong_viec", "linh_vuc"], ["chi_tieu", "linh_vuc"]],
              nguon_giao: [["cong_viec", "nguon_giao"]],
              san_pham: [["cong_viec", "san_pham"]],
              nhom_chi_tieu: [["chi_tieu", "nhom"]],
              don_vi_tinh: [["chi_tieu", "don_vi_tinh"]],
              nguon_chi_tieu: [["chi_tieu", "nguon"]],
            };
            for (const [t, c] of col[k]) for (const r of await sql`SELECT ${sql(c)} AS v, count(*)::int AS n FROM ${sql(t)} GROUP BY 1`) used.set(r.v, (used.get(r.v) || 0) + r.n);
            const list = rows.length ? rows : (await getCatalog(k)).map((ten, i) => ({ id: -i - 1, ten }));
            return (
              <details key={k} className="card" open={open === k}>
                <summary className="flex cursor-pointer list-none items-center justify-between">
                  <span className="h2">{l}</span>
                  <span className="chip border-slate-200 bg-slate-50 text-slate-600">{list.length} mục</span>
                </summary>
                <ul className="mt-3 divide-y divide-slate-100">
                  {list.map((r) => (
                    <li key={r.id} className="flex items-center gap-1 py-1.5">
                      {r.id > 0 ? (
                        <>
                          <ActionForm action={catalogItemAction} className="flex min-w-0 flex-1 items-center gap-2">
                            <input type="hidden" name="loai" value={k} />
                            <input type="hidden" name="id" value={r.id} />
                            <input type="hidden" name="op" value="sua" />
                            <input name="ten" defaultValue={r.ten} className="input min-h-9 border-transparent px-2 py-1 hover:border-slate-300" aria-label={`Tên: ${r.ten}`} />
                            <Submit className="btn btn-soft btn-sm">Lưu</Submit>
                          </ActionForm>
                          <span className="w-10 text-right text-sm text-slate-400" title="Số nội dung đang dùng">{used.get(r.ten) || ""}</span>
                          {(["len", "xuong"] as const).map((op) => (
                            <ActionForm key={op} action={catalogItemAction}>
                              <input type="hidden" name="loai" value={k} />
                              <input type="hidden" name="id" value={r.id} />
                              <input type="hidden" name="op" value={op} />
                              <button className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" title={op === "len" ? "Lên" : "Xuống"}>
                                <Icon name={op === "len" ? "up" : "down"} className="h-4 w-4" />
                              </button>
                            </ActionForm>
                          ))}
                          <ActionForm action={catalogItemAction} confirm={`Xóa “${r.ten}” khỏi danh mục?`}>
                            <input type="hidden" name="loai" value={k} />
                            <input type="hidden" name="id" value={r.id} />
                            <input type="hidden" name="op" value="xoa" />
                            <button className="rounded-lg p-1.5 text-red-500 hover:bg-red-50" title="Xóa">
                              <Icon name="trash" className="h-4 w-4" />
                            </button>
                          </ActionForm>
                        </>
                      ) : (
                        <span className="px-2 py-1">{r.ten}</span>
                      )}
                    </li>
                  ))}
                </ul>
                <ActionForm action={catalogItemAction} className="mt-3 flex gap-2">
                  <input type="hidden" name="loai" value={k} />
                  <input type="hidden" name="op" value="them" />
                  <input name="ten" className="input" placeholder={`Thêm ${l.toLowerCase()} mới`} required />
                  <Submit className="btn btn-primary shrink-0">Thêm</Submit>
                </ActionForm>
              </details>
            );
          }),
        )}
      </div>
    </div>
  );
}

async function Modules({ deleted }: { deleted: boolean }) {
  const sql = await db();
  const rows = (await sql`SELECT m.*, (SELECT count(*)::int FROM mo_dun_ban_ghi b WHERE b.id_mo_dun = m.id) AS so_ban_ghi FROM mo_dun m ORDER BY thu_tu, id`) as unknown as (MoDun & { so_ban_ghi: number })[];
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_400px]">
      <div className="card">
        <h2 className="h2">Cây menu, module</h2>
        <p className="mb-2 text-sm text-slate-500">Dùng mũi tên để sắp xếp, con mắt để ẩn/hiện. Bấm tên để sửa thông tin, trường dữ liệu, vị trí.</p>
        {deleted && <p className="mb-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800">Đã xóa module vào Thùng rác.</p>}
        <ModuleTree rows={rows} />
      </div>
      <div className="space-y-5">
        <div className="card">
          <h2 className="h2 mb-3">Thêm module mới</h2>
          <ModuleForm all={rows} />
        </div>
        <div className="card">
          <h2 className="h2">Tạo nhanh từ mẫu</h2>
          <p className="mb-3 text-sm text-slate-500">Mẫu có sẵn trường dữ liệu theo nhiệm vụ Nghị quyết 57 và quản lý địa bàn cấp xã.</p>
          <TemplateForm all={rows} />
        </div>
      </div>
    </div>
  );
}

async function Trash() {
  const sql = await db();
  const rows = await sql`SELECT t.id, t.loai, t.tieu_de, t.ly_do, t.xoa_luc, t.trang_thai, n.ho_ten FROM thung_rac t LEFT JOIN nguoi_dung n ON n.id = t.id_nguoi_xoa ORDER BY t.xoa_luc DESC LIMIT 200`;
  const demo = (await sql`SELECT gia_tri FROM cai_dat WHERE khoa = 'demo_nq57'`)[0];
  return (
    <div className="space-y-5">
      <div className="card">
        <h2 className="h2">Thùng rác</h2>
        <p className="text-sm text-slate-500">Nội dung bị xóa được giữ lại đầy đủ (kèm việc con, số liệu, tệp) để khôi phục khi cần.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="tbl min-w-[640px]">
            <thead>
              <tr>
                <th>Nội dung</th>
                <th>Người xóa</th>
                <th>Thời gian</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={r.trang_thai === "trong_thung" ? "" : "text-slate-400"}>
                  <td>
                    <span className="chip mr-2 border-slate-200 bg-slate-50 text-slate-600">{LOAI_RAC[r.loai] || r.loai}</span>
                    <span className="font-medium">{r.tieu_de}</span>
                    {r.ly_do && <div className="text-sm text-slate-500">Lý do: {r.ly_do}</div>}
                  </td>
                  <td>{r.ho_ten}</td>
                  <td className="whitespace-nowrap">{fmtDateTime(r.xoa_luc)}</td>
                  <td className="whitespace-nowrap">
                    {r.trang_thai === "trong_thung" ? (
                      <div className="flex gap-1">
                        <ActionForm action={trashAction}>
                          <input type="hidden" name="id" value={r.id} />
                          <input type="hidden" name="op" value="khoi_phuc" />
                          <Submit className="btn btn-soft btn-sm">Khôi phục</Submit>
                        </ActionForm>
                        <ActionForm action={trashAction} confirm="Xóa vĩnh viễn, không khôi phục được nữa?">
                          <input type="hidden" name="id" value={r.id} />
                          <input type="hidden" name="op" value="xoa_han" />
                          <Submit className="btn btn-danger-soft btn-sm">Xóa hẳn</Submit>
                        </ActionForm>
                      </div>
                    ) : r.trang_thai === "da_khoi_phuc" ? (
                      "Đã khôi phục"
                    ) : (
                      "Đã xóa hẳn"
                    )}
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-500">
                    Thùng rác trống.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card">
        <h2 className="h2">Dữ liệu mẫu Nghị quyết 57</h2>
        <p className="mt-1 text-slate-600">
          Nạp bộ dữ liệu mẫu để chạy thử: các công việc, chỉ tiêu chuyển đổi số theo Nghị quyết 57 (có số liệu từng tháng), bản ghi cho các module Tổ công nghệ số, Bình dân học vụ số, Hạ tầng số,
          Sáng kiến, Sản phẩm lên sàn, Phản ánh kiến nghị. Dữ liệu mẫu có dấu “[Mẫu]” để dễ nhận biết và có thể xóa sau.
        </p>
        {demo ? (
          <p className="mt-2 text-emerald-700">Đã nạp dữ liệu mẫu lúc {fmtDateTime(demo.gia_tri?.luc)}.</p>
        ) : null}
        <ActionForm action={seedDemoAction} className="mt-3 flex flex-wrap gap-2" confirm="Nạp dữ liệu mẫu Nghị quyết 57 vào phần mềm?">
          <Submit name="op" value="nap" className="btn btn-primary">
            {demo ? "Nạp thêm dữ liệu mẫu" : "Nạp dữ liệu mẫu"}
          </Submit>
          {demo && (
            <Submit name="op" value="xoa" className="btn btn-danger-soft">
              Xóa toàn bộ dữ liệu mẫu
            </Submit>
          )}
        </ActionForm>
      </div>
    </div>
  );
}

async function Theme() {
  const sql = await db();
  const t = await getTheme(sql);
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="card">
        <ThemeUpload loai="menu" label="Ảnh nền cột menu" src={themeImageUrl("menu", t.menu_v)} hint="Nên dùng ảnh dọc hoặc ảnh có chủ thể ở giữa. Phần mềm phủ một lớp màu xanh lên ảnh để tên module luôn rõ, dễ đọc." />
      </div>
      <div className="card">
        <ThemeUpload loai="chao" label="Ảnh màn hình chào mừng" src={themeImageUrl("chao", t.chao_v)} hint="Nên dùng ảnh ngang, rõ nét (trụ sở, quang cảnh địa phương). Trên điện thoại ảnh được cắt giữa cho vừa màn hình dọc." />
      </div>
      <ActionForm action={saveThemeAction} className="card space-y-4 lg:col-span-2">
        <h2 className="h2">Tùy chỉnh</h2>
        <label className="flex items-center gap-3">
          <input type="checkbox" name="chao_bat" value="1" defaultChecked={t.chao_bat} className="h-5 w-5 accent-brand-600" />
          Hiện màn hình chào mừng mỗi lần mở phần mềm
        </label>
        <label className="block max-w-md">
          <span className="label">Độ đậm lớp phủ trên ảnh menu ({Math.round(t.phu_menu * 100)}%)</span>
          <input type="range" name="phu_menu" min={0.55} max={0.95} step={0.05} defaultValue={t.phu_menu} className="w-full accent-brand-600" />
          <span className="text-sm text-slate-500">Kéo sang phải nếu ảnh nhiều chi tiết làm chữ khó đọc.</span>
        </label>
        <div className="flex flex-wrap gap-2">
          <Submit>Lưu</Submit>
          <a href="/?chao=1" className="btn btn-outline">Xem thử màn hình chào</a>
        </div>
      </ActionForm>
    </div>
  );
}
