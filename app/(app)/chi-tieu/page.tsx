import Link from "next/link";
import { requirePerm } from "@/lib/auth";
import { db } from "@/lib/db";
import { kpiScope, canManageKpi } from "@/lib/perm";
import { loadKpis } from "@/lib/kpi";
import { getSettings } from "@/lib/settings";
import { KpiCount, KpiDot } from "@/components/Charts";
import { vnDate } from "@/lib/time";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";

export default async function KpiList({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const user = await requirePerm("ct.xem");
  const sql = await db();
  const cfg = await getSettings();
  const years = (await sql`SELECT DISTINCT nam FROM chi_tieu WHERE NOT huy ORDER BY nam DESC`).map((r) => r.nam as number);
  const cur = Number(vnDate().slice(0, 4));
  const nam = Number(sp.nam) || (years.includes(cur) ? cur : years[0] || cur);
  let kpis = await loadKpis(sql, (await kpiScope(sql, user)).q, cfg.nguong_nguy_co, nam);
  const allCount = kpis.length;
  if (sp.loc === "nguy_co") kpis = kpis.filter((k) => k.nguy_co);
  if (sp.loc === "cho_xac_nhan") kpis = kpis.filter((k) => k.cho_xac_nhan > 0);
  const top = kpis.filter((k) => !k.id_cha || !kpis.some((p) => p.id === k.id_cha));
  const keyOf = (k: (typeof kpis)[number]) => k.linh_vuc || "Chưa phân lĩnh vực";
  const groups = [...new Set(top.map(keyOf))].sort((a, b) => (a === "Chưa phân lĩnh vực" ? 1 : b === "Chưa phân lĩnh vực" ? -1 : a.localeCompare(b, "vi")));
  const manage = canManageKpi(user);
  const pending = kpis.filter((k) => k.cho_xac_nhan > 0).length;
  const openAll = sp.mo === "tat_ca" || !!sp.loc;
  const qsBase = `/chi-tieu?nam=${nam}${sp.loc ? `&loc=${sp.loc}` : ""}`;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="h1">Chỉ tiêu năm {nam}</h1>
        <div className="flex flex-wrap gap-2">
          {user.quyen.includes("bc.xuat") && (
            <a href={`/api/xuat/chi-tieu?nam=${nam}`} className="btn btn-outline btn-sm">
              Xuất Excel
            </a>
          )}
          {manage && (
            <>
              <Link href="/chi-tieu/nhap" className="btn btn-outline btn-sm">
                Nhập từ Excel
              </Link>
              <Link href="/chi-tieu/moi" className="btn btn-primary btn-sm">
                + Thêm chỉ tiêu
              </Link>
            </>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {years.length > 1 &&
          years.map((y) => (
            <Link key={y} href={`/chi-tieu?nam=${y}`} className={`tab ${y === nam ? "tab-on" : ""}`}>
              {y}
            </Link>
          ))}
        <Link href={`/chi-tieu?nam=${nam}`} className={`tab ${!sp.loc ? "tab-on" : ""}`}>
          Tất cả ({allCount})
        </Link>
        <Link href={`/chi-tieu?nam=${nam}&loc=nguy_co`} className={`tab ${sp.loc === "nguy_co" ? "tab-on" : ""}`}>
          Có nguy cơ
        </Link>
        {pending > 0 || sp.loc === "cho_xac_nhan" ? (
          <Link href={`/chi-tieu?nam=${nam}&loc=cho_xac_nhan`} className={`tab ${sp.loc === "cho_xac_nhan" ? "tab-on" : ""}`}>
            Chờ xác nhận số liệu ({pending})
          </Link>
        ) : null}
      </div>
      <p className="text-sm text-slate-500">
        Chỉ tiêu được thu gọn theo lĩnh vực. Bấm vào lĩnh vực để xem danh sách, bấm vào chỉ tiêu để xem chi tiết. Số % là mức hoàn thành so với kế hoạch năm; chậm hơn mức lẽ ra phải đạt quá {cfg.nguong_nguy_co} điểm % thì đánh dấu nguy cơ.
      </p>
      {groups.length === 0 && <div className="card text-slate-500">Chưa có chỉ tiêu nào{manage ? ". Bấm “Nhập từ Excel” để nhập chỉ tiêu Nghị quyết HĐND." : "."}</div>}
      {groups.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="flex flex-wrap gap-3 text-slate-700">
            <span className="inline-flex items-center gap-1"><KpiDot mau="xanh" /> Đúng tiến độ</span>
            <span className="inline-flex items-center gap-1"><KpiDot mau="vang" /> Chậm nhẹ</span>
            <span className="inline-flex items-center gap-1"><KpiDot mau="do" /> Nguy cơ</span>
            <span className="inline-flex items-center gap-1"><KpiDot mau="xam" /> Chưa có số liệu</span>
          </div>
          <div className="flex gap-3">
          <Link href={`${qsBase}&mo=tat_ca`} className="text-brand-700 underline">
            Mở tất cả
          </Link>
          <Link href={qsBase} className="text-brand-700 underline">
            Thu gọn tất cả
          </Link>
          </div>
        </div>
      )}
      <div className="space-y-3">
        {groups.map((g) => {
          const list = top.filter((k) => keyOf(k) === g);
          const n = { xanh: 0, vang: 0, do: 0, xam: 0 } as Record<string, number>;
          for (const k of list) n[k.mau]++;
          return (
            <details key={g} className="card group p-0" open={openAll || sp.mo === g}>
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                <span className="text-slate-400 transition group-open:rotate-90" aria-hidden>
                  ▶
                </span>
                <span className="min-w-0 flex-1 text-lg font-bold">{g}</span>
                <span className="text-sm text-slate-600">{list.length} chỉ tiêu</span>
                <span className="flex gap-2 text-sm">
                  {n.xanh > 0 && <KpiCount mau="xanh" n={n.xanh} />}
                  {n.vang > 0 && <KpiCount mau="vang" n={n.vang} />}
                  {n.do > 0 && <KpiCount mau="do" n={n.do} />}
                  {n.xam > 0 && <KpiCount mau="xam" n={n.xam} />}
                </span>
              </summary>
              <ul className="divide-y divide-slate-100 border-t border-slate-100">
                {list.map((k) => (
                  <li key={k.id} className="flex items-center">
                    <Link href={`/chi-tieu/${k.id}`} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 hover:bg-slate-50">
                      <KpiDot mau={k.mau} />
                      <span className="min-w-0 flex-1">
                        <span className="font-medium">{k.ten}</span>
                        {k.cho_xac_nhan > 0 && <span className="ml-2 text-sm font-semibold text-amber-700">· chờ xác nhận</span>}
                        <span className="block text-sm text-slate-500">
                          {k.so_phan_ra > 0 ? `${k.so_phan_ra} đơn vị phụ trách` : k.ten_don_vi || k.ten_phu_trach || "Chưa giao đơn vị"}
                        </span>
                      </span>
                      <span className="w-14 text-right font-semibold tabular-nums">{k.pct == null ? "–" : `${Math.round(k.pct)}%`}</span>
                      <span className="text-slate-400" aria-hidden>
                        ›
                      </span>
                    </Link>
                    {manage && !k.id_cha && (
                      <Link href={`/chi-tieu/${k.id}?don_vi=1#don-vi`} className="mr-2 shrink-0 rounded-lg px-2 py-1 text-sm text-brand-700 hover:bg-brand-50" title="Cập nhật đơn vị phụ trách" aria-label={`Cập nhật đơn vị phụ trách: ${k.ten}`}>
                        <Icon name="users" className="h-[18px] w-[18px]" />
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          );
        })}
      </div>
    </div>
  );
}
