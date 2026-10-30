import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { kpiScope, canManageKpi } from "@/lib/perm";
import { loadKpis, fmtNum } from "@/lib/kpi";
import { getSettings } from "@/lib/settings";
import { KpiBar, KpiStatus } from "@/components/Charts";
import { LOAI_CHI_TIEU } from "@/lib/const";
import { vnDate } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function KpiList({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const user = await requireUser();
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
  const groups = [...new Set(top.map((k) => k.nhom))];
  const manage = canManageKpi(user);
  const pending = kpis.filter((k) => k.cho_xac_nhan > 0).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="h1">Chỉ tiêu năm {nam}</h1>
        <div className="flex flex-wrap gap-2">
          <a href={`/api/xuat/chi-tieu?nam=${nam}`} className="btn btn-outline btn-sm">
            Xuất Excel
          </a>
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
        Thanh màu là % hoàn thành so với kế hoạch năm, vạch đen là mức lẽ ra phải đạt đến kỳ này. Chậm hơn quá {cfg.nguong_nguy_co} điểm % thì đánh dấu nguy cơ.
      </p>
      {groups.length === 0 && <div className="card text-slate-500">Chưa có chỉ tiêu nào{manage ? ". Bấm “Nhập từ Excel” để nhập chỉ tiêu Nghị quyết HĐND." : "."}</div>}
      {groups.map((g) => (
        <section key={g} className="card">
          <h2 className="h2">{g}</h2>
          <div className="mt-2 divide-y divide-slate-100">
            {top
              .filter((k) => k.nhom === g)
              .map((k) => (
                <div key={k.id}>
                  <Link href={`/chi-tieu/${k.id}`} className="grid gap-1 py-3 md:grid-cols-[1fr_240px_170px] md:items-center md:gap-4">
                    <div>
                      <div className="font-semibold">{k.ten}</div>
                      <div className="text-sm text-slate-600">
                        Kế hoạch {fmtNum(k.ke_hoach_nam)} {k.don_vi_tinh} · Thực hiện <b>{fmtNum(k.thuc_hien)}</b> · {LOAI_CHI_TIEU[k.loai]}
                        {k.chieu_tot === "thap" ? " · càng thấp càng tốt" : ""}
                      </div>
                      <div className="text-sm text-slate-500">
                        {k.ten_don_vi || ""}
                        {k.ten_phu_trach ? ` · ${k.ten_phu_trach}` : ""}
                        {k.cho_xac_nhan > 0 && <span className="ml-1 font-semibold text-amber-700">· {k.cho_xac_nhan} số liệu chờ xác nhận</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <KpiBar pct={k.pct} leRa={k.pct_le_ra} mau={k.mau} />
                      <span className="w-12 text-right font-semibold tabular-nums">{k.pct == null ? "–" : `${Math.round(k.pct)}%`}</span>
                    </div>
                    <KpiStatus mau={k.mau} />
                  </Link>
                  {kpis
                    .filter((c) => c.id_cha === k.id)
                    .map((c) => (
                      <Link key={c.id} href={`/chi-tieu/${c.id}`} className="ml-4 grid gap-1 border-l-2 border-slate-200 py-2 pl-3 text-[15px] md:grid-cols-[1fr_220px_170px] md:items-center md:gap-4">
                        <div>
                          {c.ten} <span className="text-slate-500">· {fmtNum(c.thuc_hien)}/{fmtNum(c.ke_hoach_nam)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <KpiBar pct={c.pct} leRa={c.pct_le_ra} mau={c.mau} />
                          <span className="w-12 text-right text-sm tabular-nums">{c.pct == null ? "–" : `${Math.round(c.pct)}%`}</span>
                        </div>
                        <KpiStatus mau={c.mau} />
                      </Link>
                    ))}
                </div>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
