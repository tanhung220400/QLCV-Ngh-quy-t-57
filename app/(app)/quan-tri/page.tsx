import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCatalog, getSettings } from "@/lib/settings";
import { ActionForm, Submit } from "@/components/ActionForm";
import { saveUnitAction, saveUserAction, resetPasswordAction, importUsersAction, saveCatalogAction, saveHolidaysAction, saveSettingsAction } from "@/app/actions/admin";
import { VAI_TRO, LOAI_DON_VI } from "@/lib/const";
import { fmtDate, fmtDateTime } from "@/lib/time";

export const dynamic = "force-dynamic";

const MUC = [
  ["nguoi_dung", "Cán bộ, tài khoản"],
  ["don_vi", "Cơ cấu tổ chức"],
  ["danh_muc", "Danh mục"],
  ["ngay_nghi", "Ngày nghỉ, lễ"],
  ["cai_dat", "Cài đặt, mẫu báo cáo"],
  ["nhat_ky", "Nhật ký thao tác"],
];
const DM: Record<string, string> = { linh_vuc: "Lĩnh vực", nguon_giao: "Nguồn giao việc", san_pham: "Sản phẩm đầu ra", nhom_chi_tieu: "Nhóm chỉ tiêu", don_vi_tinh: "Đơn vị tính", nguon_chi_tieu: "Nguồn chỉ tiêu" };

export default async function Admin({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  await requireRole("quan_tri");
  const muc = sp.muc || "nguoi_dung";
  const sql = await db();
  const units = await sql`SELECT d.*, c.ten AS ten_cha, (SELECT count(*)::int FROM nguoi_dung n WHERE n.id_don_vi = d.id) AS so_nguoi FROM don_vi d LEFT JOIN don_vi c ON c.id = d.id_cha ORDER BY d.thu_tu, d.ten`;
  const linhVuc = await getCatalog("linh_vuc");

  return (
    <div className="space-y-4">
      <h1 className="h1">Quản trị hệ thống</h1>
      <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1">
        {MUC.map(([k, l]) => (
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
                        <UnitForm u={u} units={units as never} />
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

      {muc === "danh_muc" && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {await Promise.all(
            Object.entries(DM).map(async ([k, l]) => (
              <div key={k} className="card">
                <h2 className="h2">{l}</h2>
                <ActionForm action={saveCatalogAction} className="mt-2 space-y-2">
                  <input type="hidden" name="loai" value={k} />
                  <textarea name="ds" rows={8} className="input text-[15px]" defaultValue={(await getCatalog(k)).join("\n")} />
                  <p className="text-sm text-slate-500">Mỗi dòng một mục.</p>
                  <Submit className="btn btn-primary btn-sm">Lưu</Submit>
                </ActionForm>
              </div>
            )),
          )}
        </div>
      )}

      {muc === "ngay_nghi" && <Holidays />}
      {muc === "cai_dat" && <Settings />}
      {muc === "nhat_ky" && <Logs q={sp.q || ""} />}
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
    <ActionForm action={saveUserAction} className="grid gap-2 sm:grid-cols-2">
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
      <select name="vai_tro" className="input" defaultValue={u?.vai_tro || "cong_chuc"}>
        {Object.entries(VAI_TRO).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
      <input name="sdt" className="input" placeholder="Số điện thoại" defaultValue={u?.sdt ?? ""} />
      <div className="sm:col-span-2">
        <label className="label">Lĩnh vực phụ trách (chỉ với Phó Chủ tịch; để trống = toàn xã)</label>
        <div className="flex flex-wrap gap-2">
          {linhVuc.map((l) => (
            <label key={l} className="chip cursor-pointer border-slate-300 bg-white py-1">
              <input type="checkbox" name="linh_vuc_phu_trach" value={l} defaultChecked={(u?.linh_vuc_phu_trach as unknown as string[] | undefined)?.includes(l)} className="mr-1.5" />
              {l}
            </label>
          ))}
        </div>
      </div>
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
