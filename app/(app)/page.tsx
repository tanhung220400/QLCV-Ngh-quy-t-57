import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { taskScope, kpiScope, identities, seesAll } from "@/lib/perm";
import { headline, byUnit, trend, periodRange } from "@/lib/stats";
import { loadKpis, fmtNum } from "@/lib/kpi";
import { getHolidays, getSettings } from "@/lib/settings";
import { queryTasks } from "@/lib/taskQuery";
import { UnitBars, TrendLine, KpiBar, KpiStatus } from "@/components/Charts";
import { TaskCard } from "@/components/TaskCard";
import { ActionForm, Submit } from "@/components/ActionForm";
import { taskAction } from "@/app/actions/task";
import { fmtDue, vnDate, workingDaysUntil } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const sql = await db();
  const ids = await identities(user);
  const leader = user.quyen.includes("bc.dashboard");
  const scope = (await taskScope(sql, user)).q;
  const [cfg, holidays, h] = await Promise.all([getSettings(), getHolidays(), headline(sql, scope)]);
  const kpis = (await loadKpis(sql, (await kpiScope(sql, user)).q, cfg.nguong_nguy_co, Number(vnDate().slice(0, 4)))).filter((k) => !k.id_cha);
  const risky = kpis.filter((k) => k.nguy_co).length;
  const hello = new Date().getUTCHours() + 7 < 11 ? "Chào buổi sáng" : new Date().getUTCHours() + 7 < 18 ? "Chào buổi chiều" : "Chào buổi tối";

  const stat = (label: string, value: string | number, href: string, tone: "plain" | "bad" | "good" = "plain", sub?: string) => (
    <Link href={href} className={`card block ${tone === "bad" && Number(value) > 0 ? "border-red-300 bg-red-50" : ""}`}>
      <div className="text-[15px] text-slate-600">{label}</div>
      <div className={`mt-1 text-4xl font-bold tabular-nums ${tone === "bad" && Number(value) > 0 ? "text-red-700" : "text-slate-900"}`}>{value}</div>
      {sub && <div className="mt-0.5 text-sm text-slate-500">{sub}</div>}
    </Link>
  );

  // Việc cá nhân
  const mine = await queryTasks(user, { tab: "cua_toi", trang_thai: "dang_mo" }, 50);
  const myTodo = mine.filter((t) => ["moi_giao", "da_nhan", "dang_thuc_hien"].includes(t.trang_thai));
  const toApprove = leader || user.quyen.includes("cv.duyet") ? await queryTasks(user, { tab: "toi_giao", trang_thai: "cho_duyet" }, 20) : [];
  const extPending = await sql`
    SELECT g.id, cv.id AS id_cv, cv.ten, g.han_moi, n.ho_ten FROM gia_han g JOIN cong_viec cv ON cv.id = g.id_cong_viec JOIN nguoi_dung n ON n.id = g.id_nguoi_xin
    WHERE g.trang_thai_duyet = 'cho_duyet' AND cv.id_nguoi_giao IN ${sql(ids.map((i) => i.id))} ORDER BY g.tao_luc`;

  const deny = sp.khong_quyen ? (
    <p className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900">Tài khoản của bạn chưa được phân quyền vào mục vừa chọn. Liên hệ quản trị nếu cần.</p>
  ) : null;
  if (!leader) {
    const overdue = myTodo.filter((t) => new Date(t.han) < new Date());
    return (
      <div className="space-y-5">
        {deny}
        <div>
          <h1 className="h1">
            {hello}, {user.ho_ten.split(" ").slice(-1)[0]}
          </h1>
          <p className="muted">{user.chuc_vu}{user.ten_don_vi ? ` · ${user.ten_don_vi}` : ""}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {stat("Việc đang làm", myTodo.length, "/viec?tab=cua_toi&trang_thai=dang_mo")}
          {stat("Quá hạn", overdue.length, "/viec?tab=qua_han", "bad")}
          {stat("Chờ nhận", myTodo.filter((t) => t.trang_thai === "moi_giao").length, "/viec?tab=cua_toi&trang_thai=moi_giao")}
          {user.quyen.includes("ct.xem") ? stat("Chỉ tiêu được xem", kpis.length, "/chi-tieu", "plain", risky ? `${risky} có nguy cơ` : undefined) : stat("Chờ duyệt", myTodo.filter((t) => t.trang_thai === "cho_duyet").length, "/viec?tab=cua_toi&trang_thai=cho_duyet")}
        </div>
        <section>
          <h2 className="h2 mb-2">Việc cần làm</h2>
          {myTodo.length === 0 ? (
            <div className="card text-slate-500">Không có việc nào đang chờ bạn. 🎉</div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {myTodo.map((t) => (
                <TaskCard key={t.id} t={t} holidays={holidays} nguong={cfg.nguong_vang} />
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }

  const ky = ["thang", "quy", "nam"].includes(sp.ky) ? sp.ky : "nam";
  const range = periodRange(ky);
  const [units, tr] = await Promise.all([byUnit(sql, scope, range.from), trend(sql, scope, 6)]);
  const overdueList = await sql`
    SELECT cv.id, cv.ten, cv.han, cv.han_co_gio, cv.uu_tien, ct.ho_ten, dv.ten AS don_vi
    FROM cong_viec cv JOIN nguoi_dung ct ON ct.id = cv.id_chu_tri LEFT JOIN don_vi dv ON dv.id = cv.id_don_vi_chu_tri
    WHERE (${scope}) AND cv.trang_thai IN ('moi_giao','da_nhan','dang_thuc_hien') AND cv.han < now()
    ORDER BY cv.han LIMIT 15`;

  return (
    <div className="space-y-5">
      {deny}
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="h1">Tình hình {seesAll(ids[0]) ? "toàn xã" : user.pham_vi.loai === "don_vi" ? user.ten_don_vi || "đơn vị" : user.pham_vi.loai === "linh_vuc" ? "lĩnh vực phụ trách" : "công việc của tôi"}</h1>
          <p className="muted">
            {hello}, {user.ho_ten}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stat("Việc đang làm", h.dang_lam, "/viec?tab=tat_ca&trang_thai=dang_mo", "plain", h.cho_duyet ? `${h.cho_duyet} chờ duyệt` : undefined)}
        {stat("Việc quá hạn", h.qua_han, "/viec?tab=qua_han", "bad")}
        {stat("Đúng hạn trong tháng", h.ty_le == null ? "–" : `${Math.round(h.ty_le)}%`, "/bao-cao", "plain", `${h.dung_han}/${h.den_han} việc đến hạn`)}
        {stat("Chỉ tiêu có nguy cơ", risky, "/chi-tieu?loc=nguy_co", "bad", `trên ${kpis.length} chỉ tiêu`)}
      </div>

      {(toApprove.length > 0 || extPending.length > 0) && (
        <section className="card border-violet-200">
          <h2 className="h2">Chờ bạn duyệt</h2>
          <ul className="mt-2 divide-y divide-slate-100">
            {toApprove.map((t) => (
              <li key={t.id} className="py-2">
                <Link href={`/viec/${t.id}#duyet`} className="font-medium text-brand-700 underline">
                  {t.ten}
                </Link>
                <span className="ml-2 text-sm text-slate-600">Kết quả · {t.ten_chu_tri}</span>
              </li>
            ))}
            {extPending.map((g) => (
              <li key={`g${g.id}`} className="py-2">
                <Link href={`/viec/${g.id_cv}`} className="font-medium text-brand-700 underline">
                  {g.ten}
                </Link>
                <span className="ml-2 text-sm text-slate-600">
                  Xin gia hạn đến {fmtDue(g.han_moi, false)} · {g.ho_ten}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <div className="flex items-center justify-between">
          <h2 className="h2">Việc quá hạn cần can thiệp</h2>
          <Link href="/viec?tab=qua_han" className="text-brand-700 underline">
            Xem tất cả
          </Link>
        </div>
        {overdueList.length === 0 ? (
          <p className="mt-2 text-slate-500">Không có việc quá hạn.</p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100">
            {overdueList.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-2 py-2.5">
                <span className="chip border-red-300 bg-red-100 font-bold text-red-800">{Math.max(1, -workingDaysUntil(t.han, holidays))} ngày</span>
                <Link href={`/viec/${t.id}`} className="min-w-0 flex-1 font-medium hover:underline">
                  {t.ten}
                  <span className="block text-sm font-normal text-slate-600">
                    {t.ho_ten}
                    {t.don_vi ? ` · ${t.don_vi}` : ""} · hạn {fmtDue(t.han, t.han_co_gio)}
                  </span>
                </Link>
                <ActionForm action={taskAction}>
                  <input type="hidden" name="id" value={t.id} />
                  <input type="hidden" name="op" value="nhac" />
                  <Submit className="btn btn-outline btn-sm">🔔 Nhắc</Submit>
                </ActionForm>
                <Link href={`/viec/${t.id}#trao-doi`} className="btn btn-outline btn-sm">
                  Bình luận
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="h2">Theo đơn vị · {range.label}</h2>
            <div className="flex gap-1 text-sm">
              {[
                ["thang", "Tháng"],
                ["quy", "Quý"],
                ["nam", "Năm"],
              ].map(([k, l]) => (
                <Link key={k} href={`/?ky=${k}`} className={`rounded-full border px-3 py-1 ${ky === k ? "border-slate-800 bg-slate-800 text-white" : "border-slate-300"}`}>
                  {l}
                </Link>
              ))}
            </div>
          </div>
          <div className="mt-3">
            <UnitBars rows={units} />
          </div>
        </section>
        <section className="card">
          <h2 className="h2">Tỷ lệ hoàn thành đúng hạn theo tháng</h2>
          <p className="text-sm text-slate-500">Trong số việc có hạn rơi vào tháng, bao nhiêu việc xong trước hạn.</p>
          <div className="mt-2">
            <TrendLine points={tr} />
          </div>
        </section>
      </div>

      <section className="card">
        <div className="flex items-center justify-between">
          <h2 className="h2">Chỉ tiêu năm {vnDate().slice(0, 4)}</h2>
          <Link href="/chi-tieu" className="text-brand-700 underline">
            Chi tiết
          </Link>
        </div>
        <p className="text-sm text-slate-500">Vạch đen là mức lẽ ra phải đạt đến kỳ này.</p>
        <div className="mt-3 divide-y divide-slate-100">
          {kpis.map((k) => (
            <Link key={k.id} href={`/chi-tieu/${k.id}`} className="grid gap-1 py-2.5 sm:grid-cols-[1fr_220px_160px] sm:items-center sm:gap-4">
              <div>
                <div className="font-medium">{k.ten}</div>
                <div className="text-sm text-slate-600">
                  {fmtNum(k.thuc_hien)} / {fmtNum(k.ke_hoach_nam)} {k.don_vi_tinh} · {k.ten_don_vi || k.ten_phu_trach}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <KpiBar pct={k.pct} leRa={k.pct_le_ra} mau={k.mau} />
                <span className="w-12 text-right text-sm font-semibold tabular-nums">{k.pct == null ? "–" : `${Math.round(k.pct)}%`}</span>
              </div>
              <KpiStatus mau={k.mau} />
            </Link>
          ))}
          {kpis.length === 0 && <p className="py-2 text-slate-500">Chưa có chỉ tiêu.</p>}
        </div>
      </section>

      {myTodo.length > 0 && (
        <section>
          <h2 className="h2 mb-2">Việc của tôi</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {myTodo.slice(0, 6).map((t) => (
              <TaskCard key={t.id} t={t} holidays={holidays} nguong={cfg.nguong_vang} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
