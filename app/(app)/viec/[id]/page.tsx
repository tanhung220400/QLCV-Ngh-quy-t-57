import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { taskPerms, type TaskRow } from "@/lib/perm";
import { getHolidays, getSettings, getCatalog } from "@/lib/settings";
import { fmtDateTime, fmtDue, fmtDate, vnDate, vnTime } from "@/lib/time";
import { DINH_KY, UU_TIEN, TRANG_THAI } from "@/lib/const";
import { StatusChip, PriorityChip, DueChip, ProgressBar } from "@/components/TaskCard";
import { ActionForm, Submit } from "@/components/ActionForm";
import { taskAction } from "@/app/actions/task";
import { ProgressUpdate } from "@/components/ProgressUpdate";
import { FileUpload } from "@/components/FileUpload";
import { TaskForm } from "@/components/TaskForm";
import { taskFormOptions } from "@/lib/options";
import { nguoiDuocGiao } from "@/lib/giaoViec";
import { dueColor, onTime } from "@/lib/tasks";

export const dynamic = "force-dynamic";

function Hidden({ id, op }: { id: number; op: string }) {
  return (
    <>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="op" value={op} />
    </>
  );
}

const HANH_DONG: Record<string, string> = {
  giao_viec: "Giao việc",
  giao_lai: "Giao lại cho công chức",
  sua_viec: "Sửa thông tin",
  xin_gia_han: "Xin gia hạn",
  duyet_gia_han: "Duyệt gia hạn",
  tu_choi_gia_han: "Từ chối gia hạn",
  doi_chu_tri: "Đổi người chủ trì",
  cap_nhat_tien_do: "Cập nhật tiến độ",
  nhac_viec: "Nhắc việc",
  tai_tep: "Tải tệp",
  xoa_tep: "Xóa tệp",
  gan_chi_tieu: "Gắn chỉ tiêu",
  them_thanh_vien: "Thêm thành viên",
  checklist_them: "Thêm bước checklist",
  checklist_doi: "Đánh dấu checklist",
  checklist_xoa: "Xóa bước checklist",
  tao_dinh_ky: "Tạo kỳ mới (định kỳ)",
};
const actionLabel = (a: string) => (a.startsWith("trang_thai:") ? `Chuyển trạng thái (${a.slice(11)})` : HANH_DONG[a] || a);

export default async function TaskDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const { id: idStr } = await params;
  const sp = await searchParams;
  const id = Number(idStr);
  if (!id) notFound();
  const user = await requireUser();
  const sql = await db();
  const t = (
    await sql`
    SELECT cv.*, ct.ho_ten AS ten_chu_tri, ct.chuc_vu AS cv_chu_tri, ng.ho_ten AS ten_nguoi_giao, ng.chuc_vu AS cv_nguoi_giao,
      th.ho_ten AS ten_thuc_hien, dv.ten AS ten_don_vi, tao.ho_ten AS ten_nguoi_tao, cha.ten AS ten_cha
    FROM cong_viec cv
    JOIN nguoi_dung ct ON ct.id = cv.id_chu_tri
    JOIN nguoi_dung ng ON ng.id = cv.id_nguoi_giao
    JOIN nguoi_dung tao ON tao.id = cv.id_nguoi_tao
    LEFT JOIN nguoi_dung th ON th.id = cv.id_nguoi_thuc_hien
    LEFT JOIN don_vi dv ON dv.id = cv.id_don_vi_chu_tri
    LEFT JOIN cong_viec cha ON cha.id = cv.id_cha
    WHERE cv.id = ${id}`
  )[0];
  if (!t) notFound();
  const p = await taskPerms(user, t as unknown as TaskRow);
  if (!p.xem) return <div className="card">Bạn không có quyền xem công việc này.</div>;

  const [holidays, cfg] = await Promise.all([getHolidays(), getSettings()]);
  const members = await sql`SELECT tv.vai_tro, n.id, n.ho_ten FROM cong_viec_thanh_vien tv JOIN nguoi_dung n ON n.id = tv.id_nguoi_dung WHERE tv.id_cong_viec = ${id}`;
  const subs = await sql`SELECT cv.id, cv.ten, cv.trang_thai, cv.han, cv.han_co_gio, cv.phan_tram, cv.ngay_hoan_thanh, n.ho_ten FROM cong_viec cv JOIN nguoi_dung n ON n.id = cv.id_chu_tri WHERE cv.id_cha = ${id} ORDER BY cv.han`;
  const checklist = await sql`SELECT * FROM checklist WHERE id_cong_viec = ${id} ORDER BY thu_tu, id`;
  const comments = await sql`SELECT b.*, n.ho_ten FROM binh_luan b JOIN nguoi_dung n ON n.id = b.id_nguoi_dung WHERE b.id_cong_viec = ${id} ORDER BY b.thoi_gian`;
  const files = await sql`SELECT id, ten_tep, loai_mime, kich_thuoc, gps, thoi_gian_chup, la_minh_chung, tao_luc, duong_dan, (SELECT ho_ten FROM nguoi_dung WHERE id = id_nguoi_tai) AS nguoi FROM tep_dinh_kem WHERE doi_tuong = 'cong_viec' AND id_doi_tuong = ${id} ORDER BY tao_luc`;
  const exts = await sql`SELECT g.*, a.ho_ten AS nguoi_xin, b.ho_ten AS nguoi_duyet FROM gia_han g JOIN nguoi_dung a ON a.id = g.id_nguoi_xin LEFT JOIN nguoi_dung b ON b.id = g.id_nguoi_duyet WHERE g.id_cong_viec = ${id} ORDER BY g.tao_luc DESC`;
  const kpis = await sql`SELECT ct.id, ct.ten FROM cong_viec_chi_tieu x JOIN chi_tieu ct ON ct.id = x.id_chi_tieu WHERE x.id_cong_viec = ${id}`;
  const logs = await sql`SELECT k.*, n.ho_ten FROM nhat_ky k LEFT JOIN nguoi_dung n ON n.id = k.id_nguoi_dung WHERE k.doi_tuong = 'cong_viec' AND k.id_doi_tuong = ${id} ORDER BY k.thoi_gian DESC LIMIT 100`;
  const pendingExt = exts.find((e) => e.trang_thai_duyet === "cho_duyet");
  const duocGiao = p.giao_lai ? await nguoiDuocGiao(sql, user, id) : new Set<number>();
  const unitPeople = p.giao_lai
    ? (await sql`SELECT id, ho_ten FROM nguoi_dung WHERE trang_thai = 'hoat_dong' AND (id_don_vi = ${t.id_don_vi_chu_tri ?? -1} OR id_don_vi_kiem_nhiem = ${t.id_don_vi_chu_tri ?? -1}) AND id <> ${t.id_chu_tri} ORDER BY ho_ten`).filter((x) => duocGiao.has(x.id))
    : [];
  const needOpts = p.viec_con || p.quan_ly;
  const opts = needOpts ? await taskFormOptions(user, id) : null;
  const linhVuc = await getCatalog("linh_vuc");
  const adminData = p.admin
    ? {
        people: await sql`SELECT n.id, n.ho_ten, d.ten AS don_vi FROM nguoi_dung n LEFT JOIN don_vi d ON d.id = n.id_don_vi WHERE n.trang_thai = 'hoat_dong' OR n.id IN ${sql([t.id_chu_tri, t.id_nguoi_giao, t.id_nguoi_thuc_hien ?? -1])} ORDER BY n.ho_ten`,
        nguon: await getCatalog("nguon_giao"),
        sanPham: await getCatalog("san_pham"),
      }
    : null;
  const hasSub = subs.length + checklist.length > 0;
  const c = dueColor(t as never, holidays, cfg.nguong_vang);
  const blob = !!process.env.BLOB_READ_WRITE_TOKEN;

  return (
    <div key={id} className="space-y-4">
      <div className="no-print flex items-center gap-2 text-sm">
        <Link href="/viec" className="text-brand-700 underline">
          ‹ Công việc
        </Link>
        {t.id_cha && (
          <>
            <span className="text-slate-400">/</span>
            <Link href={`/viec/${t.id_cha}`} className="text-brand-700 underline">
              {t.ten_cha}
            </Link>
          </>
        )}
      </div>
      {sp.moi && <p className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-emerald-800">Đã giao việc và gửi thông báo cho người chủ trì.</p>}

      <div className={`card border-t-4 ${c.mau === "do" ? "border-t-red-600" : c.mau === "vang" ? "border-t-amber-500" : c.mau === "xanh" ? "border-t-emerald-500" : "border-t-slate-400"}`}>
        <div className="flex flex-wrap items-center gap-1.5">
          <PriorityChip p={t.uu_tien} />
          <StatusChip s={t.trang_thai} />
          <DueChip t={t as never} holidays={holidays} nguong={cfg.nguong_vang} />
          {t.dinh_ky && <span className="chip border-slate-300 bg-white">{DINH_KY[t.dinh_ky]}</span>}
          {p.admin && (
            <span className="no-print ml-auto flex gap-2">
              <a href="?qt=sua#quan-tri" className="btn btn-soft btn-sm">
                ✎ Sửa
              </a>
              <a href="?qt=xoa#quan-tri" className="btn btn-danger-soft btn-sm">
                🗑 Xóa
              </a>
            </span>
          )}
        </div>
        <h1 className="mt-2 text-2xl leading-snug font-bold break-words">{t.ten}</h1>
        {t.mo_ta && <p className="mt-2 whitespace-pre-line text-slate-700">{t.mo_ta}</p>}
        <dl className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
          <Info k="Người chủ trì" v={`${t.ten_chu_tri}${t.cv_chu_tri ? ` (${t.cv_chu_tri})` : ""}`} />
          <Info k="Đơn vị chủ trì" v={t.ten_don_vi} />
          {t.ten_thuc_hien && <Info k="Công chức thực hiện" v={t.ten_thuc_hien} />}
          <Info k="Người giao" v={`${t.ten_nguoi_giao}${t.cv_nguoi_giao ? ` (${t.cv_nguoi_giao})` : ""}${t.id_nguoi_tao !== t.id_nguoi_giao ? ` · nhập bởi ${t.ten_nguoi_tao}` : ""}`} />
          <Info k="Hạn hoàn thành" v={`${fmtDue(t.han, t.han_co_gio)}${new Date(t.han_goc).getTime() !== new Date(t.han).getTime() ? ` (hạn gốc ${fmtDue(t.han_goc, t.han_co_gio)})` : ""}`} strong />
          <Info k="Sản phẩm đầu ra" v={t.san_pham} strong />
          <Info k="Nguồn giao" v={[t.nguon_giao, t.so_hieu_vb && `VB số ${t.so_hieu_vb}`, t.cuoc_hop].filter(Boolean).join(" · ")} />
          <Info k="Lĩnh vực" v={t.linh_vuc} />
          {members.filter((m) => m.vai_tro === "phoi_hop").length > 0 && <Info k="Phối hợp" v={members.filter((m) => m.vai_tro === "phoi_hop").map((m) => m.ho_ten).join(", ")} />}
          {members.filter((m) => m.vai_tro === "theo_doi").length > 0 && <Info k="Theo dõi" v={members.filter((m) => m.vai_tro === "theo_doi").map((m) => m.ho_ten).join(", ")} />}
          <Info k="Giao lúc" v={fmtDateTime(t.tao_luc)} />
          {t.ngay_nhan && <Info k="Nhận lúc" v={fmtDateTime(t.ngay_nhan)} />}
          {t.ngay_hoan_thanh && <Info k="Hoàn thành" v={`${fmtDateTime(t.ngay_hoan_thanh)} · ${onTime(t as never) ? "đúng hạn" : "trễ hạn"}`} />}
          {(t.so_lan_gia_han > 0 || t.so_lan_lam_lai > 0) && <Info k="Gia hạn / làm lại" v={`${t.so_lan_gia_han} lần gia hạn · ${t.so_lan_lam_lai} lần làm lại`} />}
          {kpis.length > 0 && (
            <div className="sm:col-span-2">
              <dt className="text-sm text-slate-500">Phục vụ chỉ tiêu</dt>
              <dd>
                {kpis.map((k) => (
                  <Link key={k.id} href={`/chi-tieu/${k.id}`} className="mr-3 text-brand-700 underline">
                    {k.ten}
                  </Link>
                ))}
              </dd>
            </div>
          )}
        </dl>
        <div className="mt-4 flex items-center gap-3">
          <ProgressBar value={t.phan_tram} className="h-3" />
          <span className="w-14 text-right text-lg font-bold">{t.phan_tram}%</span>
        </div>
        {t.trang_thai === "tra_lai" && t.ly_do_tra_lai && (
          <p className="mt-3 rounded-xl border border-orange-300 bg-orange-50 p-3 text-orange-900">
            <b>Lý do trả lại:</b> {t.ly_do_tra_lai}
          </p>
        )}
        {t.ket_qua && (
          <p className="mt-3 rounded-xl border border-violet-200 bg-violet-50 p-3">
            <b>Kết quả báo cáo:</b> {t.ket_qua}
          </p>
        )}
      </div>

      {/* Thao tác */}
      <div className="no-print grid gap-3 lg:grid-cols-2">
        {(p.nhan || p.tra_lai) && (
          <div className="card space-y-3">
            <h2 className="h2">Nhận việc</h2>
            {p.nhan && (
              <ActionForm action={taskAction}>
                <Hidden id={id} op="nhan" />
                <Submit className="btn btn-success w-full text-lg">✓ Xác nhận đã nhận việc</Submit>
              </ActionForm>
            )}
            {p.tra_lai && (
              <details>
                <summary className="cursor-pointer font-semibold text-orange-700">Trả lại việc (giao sai người, sai thẩm quyền)</summary>
                <ActionForm action={taskAction} className="mt-2 space-y-2">
                  <Hidden id={id} op="tra_lai" />
                  <textarea name="ly_do" className="input" rows={2} placeholder="Lý do trả lại" required />
                  <Submit className="btn btn-outline">Trả lại</Submit>
                </ActionForm>
              </details>
            )}
          </div>
        )}

        {p.giao_lai && unitPeople.length > 0 && (
          <div className="card">
            <h2 className="h2">Giao cho công chức thực hiện</h2>
            <p className="muted text-sm">Bạn vẫn là người chủ trì, chịu trách nhiệm chính.</p>
            <ActionForm action={taskAction} className="mt-2 flex gap-2">
              <Hidden id={id} op="giao_lai" />
              <select name="id_nguoi" className="input" defaultValue={t.id_nguoi_thuc_hien || ""} required>
                <option value="">Chọn công chức</option>
                {unitPeople.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.ho_ten}
                  </option>
                ))}
              </select>
              <Submit className="btn btn-primary">Giao</Submit>
            </ActionForm>
          </div>
        )}

        {p.cap_nhat && (
          <div className="card">
            <h2 className="h2">Cập nhật tiến độ</h2>
            <ProgressUpdate id={id} current={t.phan_tram} auto={hasSub} />
          </div>
        )}

        {p.bao_cao && (
          <div className="card" id="bao-cao">
            <h2 className="h2">Báo cáo hoàn thành</h2>
            <p className="muted text-sm">Đính kèm sản phẩm ({t.san_pham}) hoặc ảnh chụp ở mục Tệp đính kèm bên dưới trước khi gửi.</p>
            <ActionForm action={taskAction} className="mt-2 space-y-2">
              <Hidden id={id} op="bao_cao" />
              <textarea name="ket_qua" className="input" rows={3} placeholder="Kết quả đã làm, sản phẩm đã nộp..." required />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="khong_tep" value="1" className="h-5 w-5" /> Không có tệp đính kèm
              </label>
              <Submit className="btn btn-success w-full">Gửi báo cáo hoàn thành</Submit>
            </ActionForm>
          </div>
        )}

        {p.duyet && t.trang_thai === "cho_duyet" && (
          <div className="card border-2 border-violet-300" id="duyet">
            <h2 className="h2">Duyệt kết quả</h2>
            <ActionForm action={taskAction} className="mt-2 space-y-2">
              <Hidden id={id} op="duyet" />
              <textarea name="y_kien" className="input" rows={2} placeholder="Ý kiến (bắt buộc nếu yêu cầu làm lại)" />
              <div className="flex gap-2">
                <Submit name="ket_luan" value="dong_y" className="btn btn-success flex-1">
                  Đồng ý hoàn thành
                </Submit>
                <Submit name="ket_luan" value="lam_lai" className="btn btn-outline flex-1">
                  Yêu cầu làm lại
                </Submit>
              </div>
            </ActionForm>
          </div>
        )}

        {pendingExt && (
          <div className="card border-2 border-amber-300">
            <h2 className="h2">Đề nghị gia hạn đang chờ duyệt</h2>
            <p className="mt-1">
              {pendingExt.nguoi_xin} xin gia hạn từ <b>{fmtDue(pendingExt.han_cu, t.han_co_gio)}</b> đến <b>{fmtDue(pendingExt.han_moi, t.han_co_gio)}</b>
            </p>
            <p className="mt-1 text-slate-700">Lý do: {pendingExt.ly_do}</p>
            {p.duyet && (
              <ActionForm action={taskAction} className="mt-2 space-y-2">
                <Hidden id={id} op="duyet_gia_han" />
                <input type="hidden" name="id_gia_han" value={pendingExt.id} />
                <input name="y_kien" className="input" placeholder="Ý kiến (không bắt buộc)" />
                <div className="flex gap-2">
                  <Submit name="ket_luan" value="dong_y" className="btn btn-success flex-1">
                    Đồng ý gia hạn
                  </Submit>
                  <Submit name="ket_luan" value="tu_choi" className="btn btn-outline flex-1">
                    Không đồng ý
                  </Submit>
                </div>
              </ActionForm>
            )}
          </div>
        )}

        {p.xin_gia_han && !pendingExt && (
          <details className="card">
            <summary className="h2 cursor-pointer">Xin gia hạn</summary>
            <ActionForm action={taskAction} className="mt-2 space-y-2">
              <Hidden id={id} op="xin_gia_han" />
              <div className="flex gap-2">
                <input type="date" name="han_ngay" className="input" required min={vnDate(t.han)} />
                {t.han_co_gio && <input type="time" name="han_gio" className="input w-32" defaultValue={vnTime(t.han)} />}
              </div>
              <textarea name="ly_do" className="input" rows={2} placeholder="Lý do xin gia hạn" required />
              <Submit className="btn btn-primary">Gửi đề nghị</Submit>
            </ActionForm>
            <p className="mt-2 text-sm text-slate-500">Số lần gia hạn được lưu để phục vụ đánh giá.</p>
          </details>
        )}

        {p.admin && adminData && (
          <details id="quan-tri" className="card scroll-mt-20 border-violet-200" open={!!sp.qt}>
            <summary className="h2 cursor-pointer text-violet-800">Quản trị dữ liệu: sửa toàn bộ, xóa</summary>
            <p className="mt-1 text-sm text-slate-500">Dành cho tài khoản có quyền quản trị dữ liệu. Mọi thay đổi được ghi nhật ký.</p>
            <ActionForm key={`qt${id}`} action={taskAction} className="mt-3 space-y-3">
              <Hidden id={id} op="sua_admin" />
              <div>
                <label className="label req">Tên công việc</label>
                <input name="ten" defaultValue={t.ten} className="input" required />
              </div>
              <textarea name="mo_ta" defaultValue={t.mo_ta || ""} className="input" rows={2} placeholder="Mô tả" />
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label">Trạng thái</label>
                  <select name="trang_thai" className="input" defaultValue={t.trang_thai}>
                    {Object.entries(TRANG_THAI).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Tiến độ (%)</label>
                  <input name="phan_tram" type="number" min={0} max={100} defaultValue={t.phan_tram} className="input" />
                </div>
                {(["id_nguoi_giao", "id_chu_tri", "id_nguoi_thuc_hien"] as const).map((k) => (
                  <div key={k}>
                    <label className="label">{k === "id_nguoi_giao" ? "Người giao" : k === "id_chu_tri" ? "Người chủ trì" : "Công chức thực hiện"}</label>
                    <select name={k} className="input" defaultValue={t[k] ?? ""}>
                      {k === "id_nguoi_thuc_hien" && <option value="">— Không —</option>}
                      {adminData.people.map((u) => (
                        <option key={u.id} value={u.id}>{u.ho_ten}{u.don_vi ? ` — ${u.don_vi}` : ""}</option>
                      ))}
                    </select>
                  </div>
                ))}
                <div>
                  <label className="label">Nguồn giao</label>
                  <select name="nguon_giao" className="input" defaultValue={t.nguon_giao}>
                    {[...new Set([t.nguon_giao, ...adminData.nguon])].map((o) => (<option key={o}>{o}</option>))}
                  </select>
                </div>
                <div>
                  <label className="label">Số hiệu văn bản</label>
                  <input name="so_hieu_vb" defaultValue={t.so_hieu_vb || ""} className="input" />
                </div>
                <div>
                  <label className="label">Cuộc họp</label>
                  <input name="cuoc_hop" defaultValue={t.cuoc_hop || ""} className="input" />
                </div>
                <div>
                  <label className="label">Lĩnh vực</label>
                  <select name="linh_vuc" className="input" defaultValue={t.linh_vuc}>
                    {[...new Set([t.linh_vuc, ...linhVuc])].map((o) => (<option key={o}>{o}</option>))}
                  </select>
                </div>
                <div>
                  <label className="label">Sản phẩm đầu ra</label>
                  <select name="san_pham" className="input" defaultValue={t.san_pham}>
                    {[...new Set([t.san_pham, ...adminData.sanPham])].map((o) => (<option key={o}>{o}</option>))}
                  </select>
                </div>
                <div>
                  <label className="label">Mức ưu tiên</label>
                  <select name="uu_tien" className="input" defaultValue={t.uu_tien}>
                    {Object.entries(UU_TIEN).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
                  </select>
                </div>
                <div>
                  <label className="label req">Hạn</label>
                  <div className="flex gap-2">
                    <input type="date" name="han_ngay" className="input" defaultValue={vnDate(t.han)} required />
                    <input type="time" name="han_gio" className="input w-32" defaultValue={t.han_co_gio ? vnTime(t.han) : ""} />
                  </div>
                </div>
              </div>
              <Submit>Lưu (quản trị)</Submit>
            </ActionForm>
            <ActionForm action={taskAction} confirm={`Xóa công việc “${t.ten}”${subs.length ? ` và ${subs.length} việc con` : ""}? Có thể khôi phục trong Thùng rác.`} className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
              <Hidden id={id} op="xoa" />
              <input name="ly_do" className="input max-w-xs flex-1" placeholder="Lý do xóa (không bắt buộc)" />
              <Submit className="btn btn-danger">Xóa công việc</Submit>
            </ActionForm>
          </details>
        )}

        {p.quan_ly && (
          <details className="card">
            <summary className="h2 cursor-pointer">Quản lý công việc</summary>
            <div className="mt-3 space-y-4">
              {!["hoan_thanh", "huy"].includes(t.trang_thai) && (
                <ActionForm action={taskAction}>
                  <Hidden id={id} op="nhac" />
                  <Submit className="btn btn-outline w-full">🔔 Nhắc người chủ trì</Submit>
                </ActionForm>
              )}
              {t.trang_thai === "tra_lai" && opts && (
                <ActionForm action={taskAction} className="space-y-2">
                  <Hidden id={id} op="doi_chu_tri" />
                  <label className="label">Giao lại cho người / đơn vị khác chủ trì</label>
                  <select name="chu_tri" className="input" required defaultValue="">
                    <option value="" disabled>
                      Chọn
                    </option>
                    <optgroup label="Đơn vị">
                      {opts.units.map((u) => (
                        <option key={u.id} value={`d:${u.id}`}>
                          {u.ten}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Cá nhân">
                      {opts.people.map((u) => (
                        <option key={u.id} value={`u:${u.id}`}>
                          {u.ten} {u.don_vi ? `— ${u.don_vi}` : ""}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                  <Submit className="btn btn-primary">Giao lại</Submit>
                </ActionForm>
              )}
              {!["hoan_thanh", "huy"].includes(t.trang_thai) && (
                <details>
                  <summary className="cursor-pointer font-semibold">Sửa thông tin, đổi hạn</summary>
                  <ActionForm action={taskAction} className="mt-2 space-y-2">
                    <Hidden id={id} op="sua" />
                    <input name="ten" defaultValue={t.ten} className="input" required />
                    <textarea name="mo_ta" defaultValue={t.mo_ta || ""} className="input" rows={2} placeholder="Mô tả" />
                    <div className="flex gap-2">
                      <input type="date" name="han_ngay" defaultValue={vnDate(t.han)} className="input" required />
                      <input type="time" name="han_gio" defaultValue={t.han_co_gio ? vnTime(t.han) : ""} className="input w-32" />
                    </div>
                    <input name="san_pham" defaultValue={t.san_pham} className="input" required />
                    <input name="so_hieu_vb" defaultValue={t.so_hieu_vb || ""} className="input" placeholder="Số hiệu văn bản" />
                    <select name="linh_vuc" defaultValue={t.linh_vuc} className="input">
                      {linhVuc.map((l) => (
                        <option key={l}>{l}</option>
                      ))}
                    </select>
                    <select name="uu_tien" defaultValue={t.uu_tien} className="input">
                      {Object.entries(UU_TIEN).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                    <Submit className="btn btn-primary">Lưu</Submit>
                  </ActionForm>
                </details>
              )}
              {opts && (
                <details>
                  <summary className="cursor-pointer font-semibold">Thêm người phối hợp / theo dõi, gắn chỉ tiêu</summary>
                  <ActionForm action={taskAction} className="mt-2 flex flex-wrap gap-2">
                    <Hidden id={id} op="them_thanh_vien" />
                    <select name="id_nguoi" className="input flex-1" required defaultValue="">
                      <option value="" disabled>
                        Chọn người
                      </option>
                      {opts.allPeople.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.ten}
                        </option>
                      ))}
                    </select>
                    <select name="vai_tro" className="input w-40">
                      <option value="phoi_hop">Phối hợp</option>
                      <option value="theo_doi">Theo dõi</option>
                    </select>
                    <Submit className="btn btn-outline">Thêm</Submit>
                  </ActionForm>
                  {opts.kpis.length > 0 && (
                    <ActionForm action={taskAction} className="mt-2 flex gap-2">
                      <Hidden id={id} op="gan_chi_tieu" />
                      <select name="id_chi_tieu" className="input flex-1" required defaultValue="">
                        <option value="" disabled>
                          Chọn chỉ tiêu
                        </option>
                        {opts.kpis.map((k) => (
                          <option key={k.id} value={k.id}>
                            {k.ten}
                          </option>
                        ))}
                      </select>
                      <Submit className="btn btn-outline">Gắn</Submit>
                    </ActionForm>
                  )}
                </details>
              )}
              <div className="flex flex-wrap gap-2">
                {["moi_giao", "da_nhan", "dang_thuc_hien"].includes(t.trang_thai) && (
                  <ActionForm action={taskAction} confirm="Tạm dừng công việc này?">
                    <Hidden id={id} op="tam_dung" />
                    <Submit className="btn btn-outline btn-sm">Tạm dừng</Submit>
                  </ActionForm>
                )}
                {t.trang_thai === "tam_dung" && (
                  <ActionForm action={taskAction}>
                    <Hidden id={id} op="tiep_tuc" />
                    <Submit className="btn btn-outline btn-sm">Tiếp tục</Submit>
                  </ActionForm>
                )}
              </div>
              {!["hoan_thanh", "huy"].includes(t.trang_thai) && (
                <details>
                  <summary className="cursor-pointer font-semibold text-red-700">Hủy việc</summary>
                  <ActionForm action={taskAction} className="mt-2 space-y-2" confirm="Hủy công việc này? Việc đã hủy vẫn được lưu lịch sử.">
                    <Hidden id={id} op="huy" />
                    <input name="ly_do" className="input" placeholder="Lý do hủy" required />
                    <Submit className="btn btn-danger btn-sm">Hủy việc</Submit>
                  </ActionForm>
                </details>
              )}
            </div>
          </details>
        )}
      </div>

      {/* Việc con */}
      {(subs.length > 0 || p.viec_con) && (
        <div className="card">
          <h2 className="h2">Việc con ({subs.length})</h2>
          <div className="mt-2 divide-y divide-slate-100">
            {subs.map((s) => (
              <Link key={s.id} href={`/viec/${s.id}`} className="flex flex-wrap items-center gap-2 py-2">
                <StatusChip s={s.trang_thai} />
                <span className="min-w-0 flex-1 font-medium">{s.ten}</span>
                <span className="text-sm text-slate-600">
                  {s.ho_ten} · {fmtDue(s.han, s.han_co_gio)}
                </span>
                <DueChip t={s as never} holidays={holidays} nguong={cfg.nguong_vang} />
              </Link>
            ))}
          </div>
          {p.viec_con && opts && (
            <details className="mt-2 rounded-xl border border-slate-200 p-3">
              <summary className="cursor-pointer font-semibold text-brand-700">+ Thêm việc con</summary>
              <div className="mt-3">
                <TaskForm
                  idCha={id}
                  compact
                  units={opts.units}
                  people={opts.people}
                  linhVuc={opts.linhVuc}
                  nguon={opts.nguon}
                  sanPham={opts.sanPham}
                  kpis={[]}
                  leaders={[]}
                  showGiao={false}
                  defaults={{ han: vnDate(t.han) }}
                />
              </div>
            </details>
          )}
        </div>
      )}

      {/* Checklist */}
      {(checklist.length > 0 || p.viec_con) && (
        <div className="card">
          <h2 className="h2">
            Checklist ({checklist.filter((c) => c.da_xong).length}/{checklist.length})
          </h2>
          <ul className="mt-2 space-y-1">
            {checklist.map((c) => (
              <li key={c.id} className="flex items-center gap-2">
                <ActionForm action={taskAction} className="flex flex-1 items-center">
                  <Hidden id={id} op="checklist_doi" />
                  <input type="hidden" name="id_checklist" value={c.id} />
                  <button disabled={!(p.cap_nhat || p.viec_con)} className="flex flex-1 items-center gap-3 rounded-lg px-1 py-1.5 text-left hover:bg-slate-50">
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${c.da_xong ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-400"}`}>{c.da_xong ? "✓" : ""}</span>
                    <span className={c.da_xong ? "text-slate-500 line-through" : ""}>{c.noi_dung}</span>
                  </button>
                </ActionForm>
                {p.viec_con && (
                  <ActionForm action={taskAction} confirm="Xóa bước này?">
                    <Hidden id={id} op="checklist_xoa" />
                    <input type="hidden" name="id_checklist" value={c.id} />
                    <button className="px-2 text-slate-400 hover:text-red-600" aria-label="Xóa">
                      ✕
                    </button>
                  </ActionForm>
                )}
              </li>
            ))}
          </ul>
          {p.viec_con && (
            <ActionForm action={taskAction} className="mt-2 flex gap-2">
              <Hidden id={id} op="checklist_them" />
              <input name="noi_dung" className="input" placeholder="Thêm bước nhỏ..." required />
              <Submit className="btn btn-outline">Thêm</Submit>
            </ActionForm>
          )}
        </div>
      )}

      {/* Tệp */}
      <div className="card">
        <h2 className="h2">Tệp đính kèm, minh chứng ({files.length})</h2>
        <ul className="mt-2 divide-y divide-slate-100">
          {files.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center gap-2 py-2">
              <a href={`/api/tep/${f.id}`} target="_blank" className="font-medium text-brand-700 underline">
                {f.ten_tep}
              </a>
              {f.la_minh_chung && <span className="chip border-emerald-300 bg-emerald-50 text-emerald-800">Ảnh chụp</span>}
              <span className="text-sm text-slate-500">
                {f.nguoi} · {fmtDateTime(f.tao_luc)}
                {f.kich_thuoc ? ` · ${(f.kich_thuoc / 1048576).toFixed(1)} MB` : ""}
              </span>
              {f.gps && (
                <a className="text-sm text-slate-600 underline" target="_blank" href={`https://www.google.com/maps?q=${f.gps}`}>
                  📍 {f.gps}
                  {f.thoi_gian_chup ? ` · chụp ${fmtDateTime(f.thoi_gian_chup)}` : ""}
                </a>
              )}
            </li>
          ))}
        </ul>
        {!["huy"].includes(t.trang_thai) && <FileUpload doiTuong="cong_viec" idDoiTuong={id} blob={blob} />}
      </div>

      {/* Trao đổi */}
      <div className="card" id="trao-doi">
        <h2 className="h2">Trao đổi, diễn biến</h2>
        <ul className="mt-3 space-y-3">
          {comments.map((b) => (
            <li key={b.id} className={`rounded-xl p-3 ${b.loai === "binh_luan" ? "bg-slate-50" : b.loai === "tien_do" ? "border border-blue-100 bg-blue-50/50" : "border border-dashed border-slate-200"}`}>
              <div className="text-sm text-slate-500">
                <b className="text-slate-800">{b.ho_ten}</b> · {fmtDateTime(b.thoi_gian)}
              </div>
              <div className={`mt-0.5 break-words whitespace-pre-line ${b.loai === "he_thong" ? "text-slate-600 italic" : ""}`}>{b.noi_dung}</div>
              {p.admin && (
                <ActionForm action={taskAction} confirm="Xóa nội dung trao đổi này?" className="mt-1">
                  <Hidden id={id} op="xoa_binh_luan" />
                  <input type="hidden" name="id_binh_luan" value={b.id} />
                  <button className="text-sm text-red-600 hover:underline">Xóa</button>
                </ActionForm>
              )}
            </li>
          ))}
          {comments.length === 0 && <li className="text-slate-500">Chưa có trao đổi.</li>}
        </ul>
        <ActionForm action={taskAction} className="mt-3 space-y-2">
          <Hidden id={id} op="binh_luan" />
          <textarea name="noi_dung" className="input" rows={2} placeholder="Viết trao đổi... Gõ @tên_đăng_nhập để nhắc tên" required />
          <Submit className="btn btn-primary">Gửi</Submit>
        </ActionForm>
      </div>

      {/* Gia hạn + Lịch sử */}
      {exts.length > 0 && (
        <div className="card">
          <h2 className="h2">Lịch sử gia hạn ({exts.length})</h2>
          <div className="mt-2 overflow-x-auto">
          <table className="tbl min-w-[520px]">
            <thead>
              <tr>
                <th>Ngày xin</th>
                <th>Hạn cũ → mới</th>
                <th>Lý do</th>
                <th>Kết quả</th>
              </tr>
            </thead>
            <tbody>
              {exts.map((g) => (
                <tr key={g.id}>
                  <td>{fmtDate(g.tao_luc)}</td>
                  <td>
                    {fmtDate(g.han_cu)} → {fmtDate(g.han_moi)}
                  </td>
                  <td>{g.ly_do}</td>
                  <td>{g.trang_thai_duyet === "cho_duyet" ? "Chờ duyệt" : `${g.trang_thai_duyet === "dong_y" ? "Đồng ý" : "Không đồng ý"} (${g.nguoi_duyet})`}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
      <details className="card">
        <summary className="h2 cursor-pointer">Nhật ký thao tác ({logs.length})</summary>
        <p className="mt-1 text-sm text-slate-500">Nhật ký chỉ được ghi thêm, không ai sửa hoặc xóa được.</p>
        <ul className="mt-2 space-y-1 text-sm">
          {logs.map((l) => (
            <li key={String(l.id)} className="border-b border-slate-100 py-1">
              <span className="text-slate-500">{fmtDateTime(l.thoi_gian)}</span> · <b>{l.ho_ten || "Hệ thống"}</b> · {actionLabel(l.hanh_dong)}
              {l.gia_tri_moi?.trang_thai && <> → {TRANG_THAI[l.gia_tri_moi.trang_thai] || l.gia_tri_moi.trang_thai}</>}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function Info({ k, v, strong }: { k: string; v: string | null | undefined; strong?: boolean }) {
  if (!v) return null;
  return (
    <div>
      <dt className="text-sm text-slate-500">{k}</dt>
      <dd className={strong ? "font-semibold" : ""}>{v}</dd>
    </div>
  );
}
