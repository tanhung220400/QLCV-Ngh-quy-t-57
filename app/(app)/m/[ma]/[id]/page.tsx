import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { loadModule, lookups, recordRights, recordScope, recordTitle, showValue, type BanGhi } from "@/lib/records";
import { RecordForm } from "@/components/RecordForm";
import { Crumbs, crumbs } from "@/components/Crumbs";
import { Tile } from "@/components/Nav";
import { Icon } from "@/components/Icon";
import { ActionForm, Submit } from "@/components/ActionForm";
import { FileUpload } from "@/components/FileUpload";
import { deleteRecordAction } from "@/app/actions/modules";
import { fmtDateTime } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function RecordPage({ params, searchParams }: { params: Promise<{ ma: string; id: string }>; searchParams: Promise<Record<string, string>> }) {
  const { ma, id: idStr } = await params;
  const sp = await searchParams;
  const id = Number(idStr);
  if (!id) notFound();
  const user = await requireUser();
  const sql = await db();
  const mod = await loadModule(sql, decodeURIComponent(ma));
  if (!mod || mod.m.loai !== "du_lieu") notFound();
  const { m, fields } = mod;
  if (!recordRights(user, m).xem) redirect("/?khong_quyen=1");
  const scope = (await recordScope(sql, user, m)).q;
  const r = (
    await sql`SELECT bg.*, a.ho_ten AS nguoi_tao, b.ho_ten AS nguoi_sua, d.ten AS ten_don_vi FROM mo_dun_ban_ghi bg
      LEFT JOIN nguoi_dung a ON a.id = bg.id_nguoi_tao LEFT JOIN nguoi_dung b ON b.id = bg.id_nguoi_sua LEFT JOIN don_vi d ON d.id = bg.id_don_vi
      WHERE bg.id = ${id} AND bg.id_mo_dun = ${m.id} AND (${scope})`
  )[0] as unknown as (BanGhi & { ten_don_vi: string | null }) | undefined;
  if (!r) return <div className="card">Không tìm thấy bản ghi hoặc bạn không có quyền xem.</div>;
  const rt = recordRights(user, m, r);
  const lk = await lookups(sql);
  const up = await crumbs(sql, m);
  const editing = sp.sua === "1" && rt.sua;
  const files = await sql`SELECT id, ten_tep, kich_thuoc, tao_luc, la_minh_chung, (SELECT ho_ten FROM nguoi_dung WHERE id = id_nguoi_tai) AS nguoi FROM tep_dinh_kem WHERE doi_tuong = 'ban_ghi' AND id_doi_tuong = ${id} ORDER BY tao_luc`;
  const logs = await sql`SELECT k.thoi_gian, k.hanh_dong, n.ho_ten FROM nhat_ky k LEFT JOIN nguoi_dung n ON n.id = k.id_nguoi_dung WHERE k.doi_tuong = 'ban_ghi' AND k.id_doi_tuong = ${id} ORDER BY k.thoi_gian DESC LIMIT 30`;
  const extra = Object.keys(r.du_lieu).filter((k) => !fields.some((f) => f.khoa === k));

  return (
    <div key={`${m.id}-${id}-${editing ? 1 : 0}`} className="space-y-5">
      <Crumbs up={up} last={{ ten: m.ten, href: `/m/${m.ma}` }} />
      {sp.luu && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800">Đã lưu.</p>}
      <div className="flex flex-wrap items-center gap-3">
        <Tile icon={m.bieu_tuong} mau={m.mau} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="text-sm text-slate-500">{m.ten}</div>
          <h1 className="h1">{recordTitle(fields, r, lk)}</h1>
        </div>
        {rt.sua && !editing && (
          <Link href={`/m/${m.ma}/${id}?sua=1`} className="btn btn-primary">
            <Icon name="edit" className="h-5 w-5" /> Sửa
          </Link>
        )}
        {editing && (
          <Link href={`/m/${m.ma}/${id}`} className="btn btn-outline">
            Hủy sửa
          </Link>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="card">
          {editing ? (
            <RecordForm ma={m.ma} fields={fields} lk={lk} id={id} data={r.du_lieu} />
          ) : (
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              {fields.map((f) => {
                const v = r.du_lieu[f.khoa];
                const txt = showValue(f, v, lk);
                return (
                  <div key={f.id} className={["doan_van", "nhieu_lua_chon"].includes(f.kieu) ? "sm:col-span-2" : ""}>
                    <dt className="text-sm text-slate-500">{f.ten}</dt>
                    <dd className="mt-0.5 font-medium whitespace-pre-line text-slate-900">
                      {!txt ? (
                        <span className="font-normal text-slate-400">—</span>
                      ) : f.kieu === "lien_ket" ? (
                        <a href={String(v)} target="_blank" className="text-brand-700 underline">
                          {String(v)}
                        </a>
                      ) : f.kieu === "toa_do" ? (
                        <a href={`https://www.google.com/maps?q=${encodeURIComponent(String(v))}`} target="_blank" className="text-brand-700 underline">
                          📍 {txt}
                        </a>
                      ) : f.kieu === "so_dien_thoai" ? (
                        <a href={`tel:${v}`} className="text-brand-700 underline">
                          {txt}
                        </a>
                      ) : (
                        txt
                      )}
                    </dd>
                  </div>
                );
              })}
              {extra.length > 0 && (
                <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500 sm:col-span-2">
                  Dữ liệu của trường đã xóa: {extra.map((k) => `${k}: ${String(r.du_lieu[k])}`).join("; ")}
                </div>
              )}
            </dl>
          )}
        </div>

        <div className="space-y-4">
          <div className="card space-y-1 text-[15px]">
            <div>
              <span className="text-slate-500">Người nhập:</span> {r.nguoi_tao || "—"}
            </div>
            {r.ten_don_vi && (
              <div>
                <span className="text-slate-500">Đơn vị:</span> {r.ten_don_vi}
              </div>
            )}
            <div>
              <span className="text-slate-500">Tạo lúc:</span> {fmtDateTime(r.tao_luc)}
            </div>
            <div>
              <span className="text-slate-500">Cập nhật:</span> {fmtDateTime(r.cap_nhat_luc)}
              {r.nguoi_sua ? ` · ${r.nguoi_sua}` : ""}
            </div>
          </div>

          <div className="card">
            <h2 className="h2">Tệp, hình ảnh ({files.length})</h2>
            <ul className="mt-2 divide-y divide-slate-100">
              {files.map((f) => (
                <li key={f.id} className="py-2">
                  <a href={`/api/tep/${f.id}`} target="_blank" className="font-medium text-brand-700 underline">
                    {f.ten_tep}
                  </a>
                  <div className="text-sm text-slate-500">
                    {f.nguoi} · {fmtDateTime(f.tao_luc)}
                  </div>
                </li>
              ))}
            </ul>
            {rt.sua && (
              <div className="mt-2">
                <FileUpload doiTuong="ban_ghi" idDoiTuong={id} blob={!!process.env.BLOB_READ_WRITE_TOKEN} />
              </div>
            )}
          </div>

          {rt.xoa && (
            <details className="card">
              <summary className="cursor-pointer font-semibold text-red-700">Xóa bản ghi</summary>
              <ActionForm action={deleteRecordAction} confirm="Xóa bản ghi này? Có thể khôi phục trong Thùng rác." className="mt-2 space-y-2">
                <input type="hidden" name="id" value={id} />
                <input name="ly_do" className="input" placeholder="Lý do (không bắt buộc)" />
                <Submit className="btn btn-danger w-full">Xóa</Submit>
              </ActionForm>
            </details>
          )}

          {logs.length > 0 && (
            <details className="card">
              <summary className="cursor-pointer font-semibold">Lịch sử ({logs.length})</summary>
              <ul className="mt-2 space-y-1 text-sm">
                {logs.map((l, i) => (
                  <li key={i}>
                    <span className="text-slate-500">{fmtDateTime(l.thoi_gian)}</span> · {l.ho_ten || "Hệ thống"} · {l.hanh_dong === "them_ban_ghi" ? "Thêm mới" : l.hanh_dong === "sua_ban_ghi" ? "Sửa" : l.hanh_dong}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
