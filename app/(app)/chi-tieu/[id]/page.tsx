import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canSeeKpi, taskScope } from "@/lib/perm";
import { kpiRights } from "@/lib/kpiRights";
import { loadKpis, fmtNum, periodLabel, currentPeriod } from "@/lib/kpi";
import { getSettings } from "@/lib/settings";
import { KpiBar, KpiStatus } from "@/components/Charts";
import { ActionForm, Submit } from "@/components/ActionForm";
import { addDataAction, confirmDataAction, savePlansAction, deleteKpiAction, adminKpiAction } from "@/app/actions/kpi";
import { LOAI_CHI_TIEU, KY_CAP_NHAT, TRANG_THAI } from "@/lib/const";
import { fmtDate, fmtDateTime } from "@/lib/time";
import { FileUpload } from "@/components/FileUpload";
import { KpiForm } from "@/components/KpiForm";
import { kpiFormOptions } from "@/lib/kpiOptions";

export const dynamic = "force-dynamic";

function periods(nam: number, ky: string): string[] {
  if (ky === "quy") return [1, 2, 3, 4].map((q) => `${nam}-Q${q}`);
  return Array.from({ length: 12 }, (_, i) => `${nam}-${String(i + 1).padStart(2, "0")}`);
}

export default async function KpiDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const { id: s } = await params;
  const sp = await searchParams;
  const id = Number(s);
  const user = await requireUser();
  const sql = await db();
  const cfg = await getSettings();
  const [k] = await loadKpis(sql, sql`ct.id = ${id}`, cfg.nguong_nguy_co);
  if (!k) notFound();
  if (!(await canSeeKpi(user, id))) return <div className="card">Bạn không được phân công xem chỉ tiêu này.</div>;
  const kids = await loadKpis(sql, sql`ct.id_cha = ${id}`, cfg.nguong_nguy_co);
  const tasksScope = (await taskScope(sql, user)).q;
  const parent = k.id_cha ? (await sql`SELECT id, ten FROM chi_tieu WHERE id = ${k.id_cha}`)[0] : null;
  // chỉ tiêu giao nhiều đơn vị: số liệu do từng đơn vị nhập ở phần của mình, xem chung tại đây
  const cacId = [id, ...kids.map((c) => c.id)];
  const tenDv = new Map<number, string>(kids.map((c) => [c.id, c.ten_don_vi || c.ten]));
  const data = await sql`
    SELECT s.*, a.ho_ten AS nguoi_nhap, b.ho_ten AS nguoi_xac_nhan,
      (SELECT count(*)::int FROM tep_dinh_kem t WHERE t.doi_tuong = 'so_lieu' AND t.id_doi_tuong = s.id) AS so_tep
    FROM chi_tieu_so_lieu s JOIN nguoi_dung a ON a.id = s.id_nguoi_nhap LEFT JOIN nguoi_dung b ON b.id = s.id_nguoi_xac_nhan
    WHERE s.id_chi_tieu IN ${sql(cacId)} ORDER BY s.ky DESC, s.thoi_gian DESC`;
  const files = await sql`SELECT t.id, t.ten_tep, t.id_doi_tuong FROM tep_dinh_kem t JOIN chi_tieu_so_lieu s ON s.id = t.id_doi_tuong WHERE t.doi_tuong = 'so_lieu' AND s.id_chi_tieu IN ${sql(cacId)}`;
  const plans = await sql`SELECT ky, gia_tri FROM chi_tieu_ke_hoach_ky WHERE id_chi_tieu = ${id}`;
  const tasks = await sql`SELECT cv.id, cv.ten, cv.trang_thai, n.ho_ten FROM cong_viec_chi_tieu x JOIN cong_viec cv ON cv.id = x.id_cong_viec JOIN nguoi_dung n ON n.id = cv.id_chu_tri WHERE x.id_chi_tieu = ${id} AND (${tasksScope}) ORDER BY cv.han`;
  const logs = await sql`SELECT k.*, n.ho_ten FROM nhat_ky k LEFT JOIN nguoi_dung n ON n.id = k.id_nguoi_dung WHERE k.doi_tuong = 'chi_tieu' AND k.id_doi_tuong = ${id} ORDER BY k.thoi_gian DESC LIMIT 100`;

  const { manage, enter, confirm } = await kpiRights(user, k);
  const quyenCon = new Map<number, { enter: boolean; confirm: boolean }>();
  for (const c of kids) quyenCon.set(c.id, await kpiRights(user, c));
  const quyenDong = (idCt: number) => (idCt === id ? { enter, confirm } : quyenCon.get(idCt) || { enter: false, confirm: false });
  // nơi nhập số liệu: phần của đơn vị mình (khi giao nhiều đơn vị) hoặc chính chỉ tiêu
  const nhapVao = kids.length ? kids.filter((c) => quyenCon.get(c.id)?.enter) : enter ? [k] : [];
  const hoSo = k.loai === "ho_so";
  const coXacNhan = kids.length ? kids.some((c) => quyenCon.get(c.id)?.confirm) : confirm;
  // toàn phường theo kỳ (tỷ lệ hồ sơ): tổng toàn trình ÷ tổng hồ sơ của các đơn vị
  const theoKy = new Map<string, { tt: number; mp: number; tr: number; dv: number }>();
  if (hoSo)
    for (const d of data.filter((x) => x.hieu_luc && x.xac_nhan)) {
      const t = theoKy.get(d.ky) || { tt: 0, mp: 0, tr: 0, dv: 0 };
      t.tt += Number(d.so_toan_trinh || 0);
      t.mp += Number(d.so_mot_phan || 0);
      t.tr += Number(d.so_truc_tiep || 0);
      t.dv += 1;
      theoKy.set(d.ky, t);
    }
  const pctHs = (tt: number, tong: number) => (tong ? `${fmtNum((tt / tong) * 100, 1)}%` : "–");
  const opts = manage ? await kpiFormOptions() : null;
  const kyNow = currentPeriod(k.ky_cap_nhat);
  const kyList = k.ky_cap_nhat === "tuan" ? [kyNow] : periods(k.nam, k.ky_cap_nhat);
  const highlight = Number(sp.so_lieu) || 0;
  const sumKids = kids.reduce((a, c) => a + Number(c.ke_hoach_nam), 0);

  return (
    <div key={id} className="space-y-4">
      <div className="text-sm">
        <Link href={`/chi-tieu?nam=${k.nam}`} className="text-brand-700 underline">
          ‹ Chỉ tiêu năm {k.nam}
        </Link>
        {parent && (
          <>
            {" / "}
            <Link href={`/chi-tieu/${parent.id}`} className="text-brand-700 underline">
              {parent.ten}
            </Link>
          </>
        )}
      </div>
      <div className="card">
        <div className="text-sm text-slate-500">
          {k.nhom} · {k.nguon}
        </div>
        <h1 className="mt-1 text-2xl font-bold">{k.ten}</h1>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <div className="text-sm text-slate-500">Thực hiện / Kế hoạch năm</div>
            <div className="text-2xl font-bold tabular-nums">
              {fmtNum(k.thuc_hien)} / {fmtNum(k.ke_hoach_nam)} <span className="text-base font-normal">{k.don_vi_tinh}</span>
            </div>
          </div>
          <div>
            <div className="text-sm text-slate-500">% hoàn thành · lẽ ra phải đạt</div>
            <div className="text-2xl font-bold tabular-nums">
              {k.pct == null ? "–" : `${k.pct.toFixed(1)}%`} <span className="text-base font-normal text-slate-500">· {k.pct_le_ra.toFixed(0)}%</span>
            </div>
          </div>
          <div className="self-center">
            <KpiStatus mau={k.mau} />
          </div>
        </div>
        <div className="mt-3">
          <KpiBar pct={k.pct} leRa={k.pct_le_ra} mau={k.mau} />
        </div>
        {hoSo && k.ho_so && (
          <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-[15px]">
            {kids.length ? "Toàn phường" : "Đơn vị"}: <b>{fmtNum(k.ho_so.toan_trinh, 0)}</b> hồ sơ toàn trình / <b>{fmtNum(k.ho_so.tong, 0)}</b> hồ sơ tiếp nhận (một phần {fmtNum(k.ho_so.mot_phan, 0)}, trực tiếp {fmtNum(k.ho_so.truc_tiep, 0)})
            {" → "}
            <b>{pctHs(k.ho_so.toan_trinh, k.ho_so.tong)}</b> toàn trình.
          </p>
        )}
        {kids.length > 0 && !hoSo && k.loai !== "cong_don" && (
          <p className="mt-3 text-sm text-slate-500">
            Toàn phường = {k.loai === "ty_le" ? "trung bình số liệu mới nhất của các đơn vị" : "đạt khi tất cả đơn vị đạt"} ({k.don_vi_co_so_lieu ?? 0}/{kids.length} đơn vị đã có số liệu).
          </p>
        )}
        <dl className="mt-4 grid gap-x-6 gap-y-1 text-[15px] sm:grid-cols-2">
          <div>
            {k.linh_vuc && <>Lĩnh vực: <b>{k.linh_vuc}</b> · </>}Loại: <b>{LOAI_CHI_TIEU[k.loai]}</b>, {k.chieu_tot === "thap" ? "càng thấp càng tốt" : "càng cao càng tốt"}
            {k.gia_tri_dau_nam != null ? ` · đầu năm ${fmtNum(k.gia_tri_dau_nam)}` : ""}
          </div>
          <div>
            Phụ trách: <b>{kids.length ? kids.map((c) => c.ten_don_vi).filter(Boolean).join(", ") : k.ten_don_vi || ""}</b>
            {k.ten_phu_trach ? ` · ${k.ten_phu_trach}` : ""}
          </div>
          <div>Lãnh đạo phụ trách: {k.ten_lanh_dao || "–"}</div>
          <div>
            Cập nhật: {KY_CAP_NHAT[k.ky_cap_nhat]}, chốt ngày {k.ngay_chot} · hết hạn {fmtDate(k.han)}
          </div>
        </dl>
        {k.chieu_tot === "thap" && (
          <p className="mt-2 text-sm text-slate-500">
            Cách tính: {k.gia_tri_dau_nam != null ? "theo mức giảm so với đầu năm = (đầu năm − thực hiện) ÷ (đầu năm − kế hoạch)" : "kế hoạch ÷ thực hiện"} × 100.
          </p>
        )}
      </div>

      {nhapVao.length > 0 && (
        <div className="card" id="nhap">
          <h2 className="h2">Cập nhật số liệu thực hiện</h2>
          <p className="text-sm text-slate-500">
            {hoSo
              ? "Nhập số hồ sơ phát sinh trong kỳ: toàn trình, một phần, trực tiếp. Phần mềm tự tính tỷ lệ toàn trình của đơn vị và của toàn phường."
              : k.loai === "cong_don"
                ? "Nhập số phát sinh trong kỳ (hệ thống tự cộng dồn)."
                : "Nhập giá trị tại thời điểm cuối kỳ."}
            {!(kids.length ? nhapVao.every((c) => quyenCon.get(c.id)?.confirm) : confirm) && " Số liệu cần trưởng đơn vị xác nhận trước khi lên báo cáo."}
          </p>
          <ActionForm action={addDataAction} className={`mt-3 grid gap-3 ${hoSo ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-4"}`}>
            {kids.length ? (
              <>
                <input type="hidden" name="ve" value={id} />
                <label className="block">
                  <span className="label">Đơn vị</span>
                  <select name="id" className="input" defaultValue={nhapVao[0].id}>
                    {nhapVao.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.ten_don_vi || c.ten}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : (
              <input type="hidden" name="id" value={id} />
            )}
            <label className="block">
              {(hoSo || kids.length > 0) && <span className="label">Kỳ</span>}
              <select name="ky" className="input" defaultValue={kyNow} aria-label="Kỳ số liệu">
                {kyList.map((p) => (
                  <option key={p} value={p}>
                    {periodLabel(p)}
                  </option>
                ))}
              </select>
            </label>
            {hoSo ? (
              <>
                <label className="block">
                  <span className="label">Số hồ sơ toàn trình</span>
                  <input name="so_toan_trinh" type="number" min={0} step={1} inputMode="numeric" className="input" required />
                </label>
                <label className="block">
                  <span className="label">Số hồ sơ một phần</span>
                  <input name="so_mot_phan" type="number" min={0} step={1} inputMode="numeric" className="input" defaultValue={0} />
                </label>
                <label className="block">
                  <span className="label">Số hồ sơ trực tiếp</span>
                  <input name="so_truc_tiep" type="number" min={0} step={1} inputMode="numeric" className="input" defaultValue={0} />
                </label>
              </>
            ) : k.loai === "dat_khong" ? (
              <label className="block">
                {kids.length > 0 && <span className="label">Kết quả</span>}
                <select name="gia_tri" className="input" aria-label="Kết quả">
                  <option value="1">Đạt</option>
                  <option value="0">Chưa đạt</option>
                </select>
              </label>
            ) : (
              <label className="block">
                {kids.length > 0 && <span className="label">Số thực hiện</span>}
                <input name="gia_tri" inputMode="decimal" className="input" placeholder={`Số thực hiện (${k.don_vi_tinh})`} required />
              </label>
            )}
            <label className="block">
              {(hoSo || kids.length > 0) && <span className="label">Ghi chú</span>}
              <input name="ghi_chu" className="input" placeholder="Ghi chú, nguồn số liệu" />
            </label>
            <div className="flex items-end">
              <Submit>Lưu số liệu</Submit>
            </div>
          </ActionForm>
          <p className="mt-2 text-sm text-slate-500">Sau khi lưu, đính kèm tệp minh chứng ở dòng số liệu trong bảng bên dưới.</p>
        </div>
      )}

      {hoSo && kids.length > 0 && theoKy.size > 0 && (
        <div className="card">
          <h2 className="h2">Toàn phường theo kỳ</h2>
          <div className="mt-2 overflow-x-auto">
            <table className="tbl min-w-[560px]">
              <thead>
                <tr>
                  <th>Kỳ</th>
                  <th className="text-right">Toàn trình</th>
                  <th className="text-right">Một phần</th>
                  <th className="text-right">Trực tiếp</th>
                  <th className="text-right">Tổng hồ sơ</th>
                  <th className="text-right">% toàn trình</th>
                  <th className="text-right">Đơn vị báo cáo</th>
                </tr>
              </thead>
              <tbody>
                {[...theoKy.entries()]
                  .sort((a, b) => (a[0] < b[0] ? 1 : -1))
                  .map(([ky, t]) => (
                    <tr key={ky}>
                      <td>{periodLabel(ky)}</td>
                      <td className="text-right tabular-nums">{fmtNum(t.tt, 0)}</td>
                      <td className="text-right tabular-nums">{fmtNum(t.mp, 0)}</td>
                      <td className="text-right tabular-nums">{fmtNum(t.tr, 0)}</td>
                      <td className="text-right tabular-nums">{fmtNum(t.tt + t.mp + t.tr, 0)}</td>
                      <td className="text-right font-semibold tabular-nums">{pctHs(t.tt, t.tt + t.mp + t.tr)}</td>
                      <td className="text-right tabular-nums">
                        {t.dv}/{kids.length}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="h2">Số liệu theo kỳ</h2>
        <div className="mt-2 overflow-x-auto">
          <table className="tbl min-w-[640px]">
            <thead>
              <tr>
                <th>Kỳ</th>
                {kids.length > 0 && <th>Đơn vị</th>}
                {hoSo ? (
                  <th className="text-right">Toàn trình / Một phần / Trực tiếp · Tổng</th>
                ) : null}
                <th className="text-right">{hoSo ? "% toàn trình" : "Giá trị"}</th>
                <th>Người nhập</th>
                <th>Xác nhận</th>
                <th>Minh chứng</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.id} className={`${!d.hieu_luc ? "text-slate-400 line-through" : ""} ${d.id === highlight ? "bg-amber-50" : ""}`}>
                  <td>
                    {periodLabel(d.ky)}
                    {!d.hieu_luc && <span className="block text-xs no-underline">(đã thay thế)</span>}
                  </td>
                  {kids.length > 0 && <td>{tenDv.get(d.id_chi_tieu) || "Chung"}</td>}
                  {hoSo && (
                    <td className="text-right tabular-nums">
                      {fmtNum(d.so_toan_trinh, 0)} / {fmtNum(d.so_mot_phan, 0)} / {fmtNum(d.so_truc_tiep, 0)} · <b>{fmtNum(Number(d.so_toan_trinh || 0) + Number(d.so_mot_phan || 0) + Number(d.so_truc_tiep || 0), 0)}</b>
                    </td>
                  )}
                  <td className="text-right font-semibold tabular-nums">{k.loai === "dat_khong" ? (Number(d.gia_tri) >= 1 ? "Đạt" : "Chưa đạt") : hoSo ? `${fmtNum(d.gia_tri, 1)}%` : fmtNum(d.gia_tri)}</td>
                  <td>
                    {d.nguoi_nhap}
                    <span className="block text-xs text-slate-500">{fmtDateTime(d.thoi_gian)}</span>
                    {d.ghi_chu && <span className="block text-sm text-slate-600">{d.ghi_chu}</span>}
                  </td>
                  <td>
                    {d.hieu_luc &&
                      (d.xac_nhan ? (
                        <span className="text-emerald-700">✓ {d.nguoi_xac_nhan}</span>
                      ) : quyenDong(d.id_chi_tieu).confirm ? (
                        <ActionForm action={confirmDataAction} className="flex flex-wrap gap-1">
                          <input type="hidden" name="id_so_lieu" value={d.id} />
                          <Submit name="ket_luan" value="dong_y" className="btn btn-success btn-sm">
                            Xác nhận
                          </Submit>
                          <Submit name="ket_luan" value="tra_lai" className="btn btn-outline btn-sm">
                            Trả lại
                          </Submit>
                        </ActionForm>
                      ) : (
                        <span className="font-semibold text-amber-700">Chờ xác nhận</span>
                      ))}
                  </td>
                  <td>
                    {files
                      .filter((f) => f.id_doi_tuong === d.id)
                      .map((f) => (
                        <a key={f.id} href={`/api/tep/${f.id}`} target="_blank" className="block text-sm text-brand-700 underline">
                          {f.ten_tep}
                        </a>
                      ))}
                    {d.hieu_luc && quyenDong(d.id_chi_tieu).enter && (d.id === highlight || d.so_tep === 0) && <FileUpload doiTuong="so_lieu" idDoiTuong={d.id} blob={!!process.env.BLOB_READ_WRITE_TOKEN} />}
                    {user.quyen.includes("qt.du_lieu") && (
                      <ActionForm action={adminKpiAction} confirm="Xóa dòng số liệu này? Có thể khôi phục trong Thùng rác." className="mt-1">
                        <input type="hidden" name="op" value="xoa_so_lieu" />
                        <input type="hidden" name="id" value={d.id} />
                        <button className="text-sm text-red-600 no-underline hover:underline">Xóa</button>
                      </ActionForm>
                    )}
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={5 + (kids.length ? 1 : 0) + (hoSo ? 1 : 0)} className="text-slate-500">
                    Chưa có số liệu.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {(kids.length > 0 || manage) && (
        <div className="card">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="h2">Đơn vị phụ trách ({kids.length})</h2>
            {manage && !k.id_cha && (
              <Link href={`/chi-tieu/moi?cha=${id}`} className="btn btn-outline btn-sm">
                + Giao thêm đơn vị
              </Link>
            )}
          </div>
          {kids.length > 0 && k.loai === "cong_don" && Math.abs(sumKids - Number(k.ke_hoach_nam)) > 1e-6 && (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-amber-900">
              Tổng các phần ({fmtNum(sumKids)}) chưa khớp chỉ tiêu xã ({fmtNum(k.ke_hoach_nam)}), còn {fmtNum(Number(k.ke_hoach_nam) - sumKids)} {k.don_vi_tinh} chưa giao.
            </p>
          )}
          <div className="mt-2 divide-y divide-slate-100">
            {kids.map((c) => (
              <Link key={c.id} href={`/chi-tieu/${c.id}`} className="grid gap-1 py-2 sm:grid-cols-[1fr_200px_160px] sm:items-center sm:gap-3">
                <div>
                  {c.ten}
                  <span className="block text-sm text-slate-500">
                    {c.ten_don_vi} ·{" "}
                    {hoSo && c.ho_so
                      ? `${fmtNum(c.ho_so.toan_trinh, 0)}/${fmtNum(c.ho_so.tong, 0)} hồ sơ toàn trình = ${pctHs(c.ho_so.toan_trinh, c.ho_so.tong)} (KH ${fmtNum(c.ke_hoach_nam)}%)`
                      : `${fmtNum(c.thuc_hien)}/${fmtNum(c.ke_hoach_nam)}`}
                    {c.cho_xac_nhan > 0 && <span className="ml-1 text-amber-700">· {c.cho_xac_nhan} chờ xác nhận</span>}
                  </span>
                </div>
                <KpiBar pct={c.pct} leRa={c.pct_le_ra} mau={c.mau} />
                <KpiStatus mau={c.mau} />
              </Link>
            ))}
          </div>
        </div>
      )}

      {manage && k.loai !== "dat_khong" && k.ky_cap_nhat !== "tuan" && (
        <details className="card">
          <summary className="h2 cursor-pointer">Kế hoạch theo {k.ky_cap_nhat === "quy" ? "quý" : "tháng"} (không bắt buộc)</summary>
          <p className="mt-1 text-sm text-slate-500">
            Nếu nhập, “tiến độ lẽ ra phải đạt” tính theo kế hoạch kỳ thay vì chia đều 12 tháng.{k.loai === "cong_don" ? " Tổng các kỳ phải bằng kế hoạch năm." : ""}
          </p>
          <ActionForm action={savePlansAction} className="mt-3">
            <input type="hidden" name="id" value={id} />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {periods(k.nam, k.ky_cap_nhat).map((p) => (
                <label key={p}>
                  <span className="text-sm text-slate-600">{periodLabel(p)}</span>
                  <input name={`ky_${p}`} inputMode="decimal" className="input" defaultValue={plans.find((x) => x.ky === p)?.gia_tri ?? ""} />
                </label>
              ))}
            </div>
            <Submit className="btn btn-primary mt-3">Lưu kế hoạch kỳ</Submit>
          </ActionForm>
        </details>
      )}

      <div className="card">
        <h2 className="h2">Công việc phục vụ chỉ tiêu ({tasks.length})</h2>
        <ul className="mt-2 divide-y divide-slate-100">
          {tasks.map((t) => (
            <li key={t.id} className="py-2">
              <Link href={`/viec/${t.id}`} className="font-medium text-brand-700 underline">
                {t.ten}
              </Link>
              <span className="ml-2 text-sm text-slate-600">
                {TRANG_THAI[t.trang_thai]} · {t.ho_ten}
              </span>
            </li>
          ))}
          {tasks.length === 0 && <li className="text-slate-500">Chưa có. Khi giao việc, chọn “Gắn với chỉ tiêu”.</li>}
        </ul>
      </div>

      {manage && opts && (
        <details className="card">
          <summary className="h2 cursor-pointer">Sửa chỉ tiêu</summary>
          <div className="mt-3">
            <KpiForm k={k as never} {...opts} donViCon={kids.map((c) => c.id_don_vi_phu_trach).filter((x): x is number => !!x)} />
          </div>
          <ActionForm action={deleteKpiAction} className="mt-4 flex gap-2 border-t border-slate-200 pt-4" confirm="Hủy chỉ tiêu này (kèm phần phân rã)? Lịch sử vẫn được lưu.">
            <input type="hidden" name="id" value={id} />
            <input name="ly_do" className="input" placeholder="Lý do hủy" required />
            <Submit className="btn btn-danger">Hủy chỉ tiêu</Submit>
          </ActionForm>
          {user.quyen.includes("qt.du_lieu") && (
            <ActionForm action={adminKpiAction} className="mt-3 flex flex-wrap gap-2" confirm="Xóa hẳn chỉ tiêu (kèm phần phân rã, số liệu) vào Thùng rác?">
              <input type="hidden" name="op" value="xoa" />
              <input type="hidden" name="id" value={id} />
              <input name="ly_do" className="input max-w-xs flex-1" placeholder="Lý do xóa (không bắt buộc)" />
              <Submit className="btn btn-danger-soft">Xóa hẳn (quản trị)</Submit>
            </ActionForm>
          )}
        </details>
      )}

      <details className="card">
        <summary className="h2 cursor-pointer">Lịch sử sửa số liệu ({logs.length})</summary>
        <ul className="mt-2 space-y-1 text-sm">
          {logs.map((l) => (
            <li key={String(l.id)} className="border-b border-slate-100 py-1">
              <span className="text-slate-500">{fmtDateTime(l.thoi_gian)}</span> · <b>{l.ho_ten || "Hệ thống"}</b> · {l.hanh_dong.replace(/_/g, " ")}
              {l.gia_tri_moi?.ky && (
                <>
                  {" "}
                  · {periodLabel(l.gia_tri_moi.ky)}: {l.gia_tri_cu?.gia_tri != null ? `${fmtNum(l.gia_tri_cu.gia_tri)} → ` : ""}
                  {fmtNum(l.gia_tri_moi.gia_tri)}
                </>
              )}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
