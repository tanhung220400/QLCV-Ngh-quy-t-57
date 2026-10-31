import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canSeeModule, moduleHref, type MoDun } from "@/lib/modules";
import { loadModule, lookups, quickStats, recordRights, recordScope, showValue, type BanGhi } from "@/lib/records";
import { Icon } from "@/components/Icon";
import { Tile } from "@/components/Nav";
import { ActionForm, Submit } from "@/components/ActionForm";
import { importRecordsAction } from "@/app/actions/modules";
import { fmtDate } from "@/lib/time";
import { crumbs, Crumbs } from "@/components/Crumbs";

export const dynamic = "force-dynamic";
const PAGE = 50;

export default async function ModulePage({ params, searchParams }: { params: Promise<{ ma: string }>; searchParams: Promise<Record<string, string>> }) {
  const { ma } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  const sql = await db();
  const mod = await loadModule(sql, decodeURIComponent(ma));
  if (!mod) notFound();
  const { m, fields } = mod;
  if (m.loai === "he_thong" || m.loai === "lien_ket") redirect(moduleHref(m));
  const rt = recordRights(user, m);
  if (!rt.xem || (!m.hien && !user.quyen.includes("qt.mo_dun"))) redirect("/?khong_quyen=1");
  const up = await crumbs(sql, m);
  const children = ((await sql`SELECT * FROM mo_dun WHERE id_cha = ${m.id} AND hien ORDER BY thu_tu, id`) as unknown as MoDun[]).filter((c) => canSeeModule(user, c));
  const counts = children.length
    ? Object.fromEntries((await sql`SELECT id_mo_dun, count(*)::int AS n FROM mo_dun_ban_ghi WHERE id_mo_dun IN ${sql(children.map((c) => c.id))} GROUP BY id_mo_dun`).map((r) => [r.id_mo_dun, r.n]))
    : {};
  const designer = user.quyen.includes("qt.mo_dun");

  const header = (
    <div className="flex flex-wrap items-start gap-4">
      <Tile icon={m.bieu_tuong} mau={m.mau} size="lg" />
      <div className="min-w-0 flex-1">
        <h1 className="h1">{m.ten}</h1>
        {m.mo_ta && <p className="mt-1 text-slate-500">{m.mo_ta}</p>}
      </div>
      {designer && (
        <Link href={`/quan-tri/mo-dun/${m.id}`} className="btn btn-outline btn-sm">
          <Icon name="edit" className="h-4 w-4" /> Thiết kế module
        </Link>
      )}
    </div>
  );

  const childTiles = children.length > 0 && (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {children.map((c) => (
        <Link key={c.id} href={moduleHref(c)} className="card card-link flex items-center gap-3">
          <Tile icon={c.bieu_tuong} mau={c.mau} size="lg" />
          <div className="min-w-0">
            <div className="font-semibold text-slate-900">{c.ten}</div>
            <div className="truncate text-sm text-slate-500">{c.loai === "nhom" ? "Nhóm module" : c.loai === "du_lieu" ? `${counts[c.id] || 0} bản ghi` : c.mo_ta || "Mở"}</div>
          </div>
        </Link>
      ))}
    </div>
  );

  if (m.loai === "nhom") {
    return (
      <div className="space-y-5">
        <Crumbs up={up} />
        {header}
        {childTiles || <div className="card text-slate-500">Nhóm này chưa có module. {designer && <Link href="/quan-tri?muc=mo_dun" className="text-brand-700 underline">Thêm module</Link>}</div>}
      </div>
    );
  }

  // ----- Module nhập liệu -----
  const lk = await lookups(sql);
  const scope = (await recordScope(sql, user, m)).q;
  const q = (sp.q || "").trim();
  const pick = fields.find((f) => f.kieu === "lua_chon");
  const loc = pick && sp.loc ? sp.loc : "";
  const page = Math.max(1, Number(sp.trang) || 1);
  const where = sql`bg.id_mo_dun = ${m.id} AND (${scope})
    ${q ? sql`AND bo_dau(bg.du_lieu::text) ILIKE ${"%" + q.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase() + "%"}` : sql``}
    ${loc ? sql`AND coalesce(bg.du_lieu->>${pick!.khoa}, 'Chưa nhập') = ${loc}` : sql``}`;
  const total = (await sql`SELECT count(*)::int AS n FROM mo_dun_ban_ghi bg WHERE ${where}`)[0].n as number;
  const rows = (await sql`SELECT bg.*, n.ho_ten AS nguoi_tao FROM mo_dun_ban_ghi bg LEFT JOIN nguoi_dung n ON n.id = bg.id_nguoi_tao WHERE ${where}
    ORDER BY bg.cap_nhat_luc DESC, bg.id DESC LIMIT ${PAGE} OFFSET ${(page - 1) * PAGE}`) as unknown as BanGhi[];
  const allForStats = (await sql`SELECT bg.du_lieu FROM mo_dun_ban_ghi bg WHERE bg.id_mo_dun = ${m.id} AND (${scope})`) as unknown as BanGhi[];
  const st = quickStats(fields, allForStats);
  const cols = fields.filter((f) => f.hien_danh_sach).slice(0, 6);
  const link = (o: Record<string, string>) => {
    const p = new URLSearchParams({ ...(q ? { q } : {}), ...(loc ? { loc } : {}), ...o });
    for (const [k, v] of [...p.entries()]) if (!v) p.delete(k);
    return `/m/${m.ma}${p.toString() ? `?${p}` : ""}`;
  };

  return (
    <div className="space-y-5">
      <Crumbs up={up} />
      {header}
      {sp.xoa && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800">Đã xóa bản ghi (có thể khôi phục trong Thùng rác của quản trị).</p>}
      {childTiles}

      <div className="flex flex-wrap gap-2">
        {rt.them && (
          <Link href={`/m/${m.ma}/moi`} className="btn btn-primary">
            <Icon name="plus" className="h-5 w-5" /> Thêm mới
          </Link>
        )}
        <a href={`/api/m/${m.ma}/xuat${q || loc ? `?${new URLSearchParams({ ...(q ? { q } : {}), ...(loc ? { loc } : {}) })}` : ""}`} className="btn btn-outline">
          <Icon name="download" className="h-5 w-5" /> Xuất Excel
        </a>
        {rt.them && (
          <details className="group relative">
            <summary className="btn btn-outline list-none">
              <Icon name="upload" className="h-5 w-5" /> Nhập từ Excel
            </summary>
            <div className="card absolute z-10 mt-2 w-[min(92vw,420px)] shadow-lift">
              <ActionForm action={importRecordsAction} className="space-y-3">
                <input type="hidden" name="ma" value={m.ma} />
                <p className="text-sm text-slate-600">
                  Dòng đầu là tên cột như tệp mẫu. Cột đánh dấu * là bắt buộc.{" "}
                  <a href={`/api/m/${m.ma}/xuat?mau=1`} className="text-brand-700 underline">
                    Tải tệp mẫu
                  </a>
                </p>
                <input type="file" name="file" accept=".xlsx" className="input" required />
                <Submit>Nhập dữ liệu</Submit>
              </ActionForm>
            </div>
          </details>
        )}
      </div>

      {(st.counts.length > 0 || st.sums.length > 0) && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="card">
            <div className="text-sm text-slate-500">Tổng số bản ghi</div>
            <div className="mt-1 text-3xl font-bold text-slate-900 tabular-nums">{allForStats.length}</div>
          </div>
          {st.sums.map(([t, v]) => (
            <div key={t} className="card">
              <div className="truncate text-sm text-slate-500" title={t}>
                Tổng: {t}
              </div>
              <div className="mt-1 text-3xl font-bold text-slate-900 tabular-nums">{v.toLocaleString("vi-VN")}</div>
            </div>
          ))}
        </div>
      )}

      <div className="card space-y-3">
        <form className="flex flex-wrap gap-2" action={`/m/${m.ma}`}>
          <div className="relative min-w-60 flex-1">
            <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input name="q" defaultValue={q} className="input pl-10" placeholder="Tìm trong module (có dấu hoặc không dấu)" />
          </div>
          {loc && <input type="hidden" name="loc" value={loc} />}
          <button className="btn btn-outline">Tìm</button>
        </form>
        {pick && st.counts.length > 0 && (
          <div className="-mx-1 flex flex-wrap gap-2 px-1">
            <Link href={link({ loc: "", trang: "" })} className={`tab py-1 text-sm ${!loc ? "tab-on" : ""}`}>
              Tất cả {pick.ten.toLowerCase()}
            </Link>
            {st.counts.map(([o, n]) => (
              <Link key={o} href={link({ loc: o, trang: "" })} className={`tab py-1 text-sm ${loc === o ? "tab-on" : ""}`}>
                {o} <span className="ml-1 opacity-70">{n}</span>
              </Link>
            ))}
          </div>
        )}

        {rows.length === 0 ? (
          <div className="py-10 text-center text-slate-500">
            <Icon name="folder" className="mx-auto mb-2 h-10 w-10 text-slate-300" />
            {q || loc ? "Không có bản ghi phù hợp." : "Chưa có dữ liệu."}
          </div>
        ) : (
          <>
            {/* Bảng trên máy tính */}
            <div className="hidden overflow-x-auto md:block">
              <table className="tbl">
                <thead>
                  <tr>
                    <th className="w-10">#</th>
                    {cols.map((c) => (
                      <th key={c.id}>{c.ten}</th>
                    ))}
                    <th>Cập nhật</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.id}>
                      <td className="text-slate-400">{(page - 1) * PAGE + i + 1}</td>
                      {cols.map((c, j) => (
                        <td key={c.id} className={j === 0 ? "font-medium" : ""}>
                          {j === 0 ? (
                            <Link href={`/m/${m.ma}/${r.id}`} className="text-brand-700 hover:underline">
                              {showValue(c, r.du_lieu[c.khoa], lk) || `Bản ghi #${r.id}`}
                            </Link>
                          ) : c.kieu === "lien_ket" && r.du_lieu[c.khoa] ? (
                            <a href={String(r.du_lieu[c.khoa])} target="_blank" className="text-brand-700 underline">
                              Mở
                            </a>
                          ) : (
                            showValue(c, r.du_lieu[c.khoa], lk)
                          )}
                        </td>
                      ))}
                      <td className="text-sm whitespace-nowrap text-slate-500">
                        {fmtDate(r.cap_nhat_luc)}
                        <div className="text-xs">{r.nguoi_tao}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Thẻ trên điện thoại */}
            <div className="space-y-2 md:hidden">
              {rows.map((r) => (
                <Link key={r.id} href={`/m/${m.ma}/${r.id}`} className="block rounded-xl border border-slate-200 p-3 active:bg-slate-50">
                  <div className="font-semibold text-slate-900">{(cols[0] && showValue(cols[0], r.du_lieu[cols[0].khoa], lk)) || `Bản ghi #${r.id}`}</div>
                  <dl className="mt-1 space-y-0.5 text-[15px]">
                    {cols.slice(1, 4).map((c) =>
                      r.du_lieu[c.khoa] !== undefined && r.du_lieu[c.khoa] !== "" ? (
                        <div key={c.id} className="flex gap-2">
                          <dt className="shrink-0 text-slate-500">{c.ten}:</dt>
                          <dd className="min-w-0 truncate">{showValue(c, r.du_lieu[c.khoa], lk)}</dd>
                        </div>
                      ) : null,
                    )}
                  </dl>
                </Link>
              ))}
            </div>
            {total > PAGE && (
              <div className="flex items-center justify-between pt-2 text-sm">
                <span className="text-slate-500">
                  {(page - 1) * PAGE + 1}–{Math.min(total, page * PAGE)} / {total}
                </span>
                <div className="flex gap-2">
                  {page > 1 && (
                    <Link href={link({ trang: String(page - 1) })} className="btn btn-outline btn-sm">
                      ‹ Trước
                    </Link>
                  )}
                  {page * PAGE < total && (
                    <Link href={link({ trang: String(page + 1) })} className="btn btn-outline btn-sm">
                      Sau ›
                    </Link>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
