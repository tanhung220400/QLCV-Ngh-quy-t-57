import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { oldYears } from "@/lib/taskQuery";
import { kpiPeople, kpiUnits, kyRange, tongHop, DIEM, XEP_LOAI, type KpiRow } from "@/lib/kpiDanhGia";
import { kpiViewScope } from "@/lib/kpiScope";
import { KpiTable, XepLoai, DiemKpi } from "@/components/KpiDanhGia";
import { vnDate } from "@/lib/time";

export const dynamic = "force-dynamic";

const SAP_XEP: Record<string, [string, (a: KpiRow, b: KpiRow) => number]> = {
  diem: ["Điểm KPI cao nhất", (a, b) => (b.diem ?? -1) - (a.diem ?? -1) || b.tong - a.tong],
  qua_han: ["Quá hạn nhiều nhất", (a, b) => b.qua_han - a.qua_han || b.tre - a.tre],
  ton: ["Tồn việc nhiều nhất", (a, b) => b.ton - a.ton],
  som: ["Vượt tiến độ nhiều nhất", (a, b) => b.som - a.som || b.nhanh - a.nhanh],
  ten: ["Theo đơn vị, tên", () => 0],
};

export default async function DanhGiaKpi({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const scope = await kpiViewScope(user);
  if (scope === false) redirect("/?khong_quyen=1");
  const sp = await searchParams;
  const sql = await db();
  const cur = Number(vnDate().slice(0, 4));
  const years = [cur, ...(await oldYears())];
  const nam = years.includes(Number(sp.nam)) ? Number(sp.nam) : cur;
  const thang = Number(sp.thang) >= 1 && Number(sp.thang) <= 12 ? Number(sp.thang) : 0;
  const quy = !thang && [1, 2, 3, 4].includes(Number(sp.quy)) ? Number(sp.quy) : 0;
  const ky = { nam, quy, thang };
  const { label } = kyRange(ky);
  const xem = sp.xem === "can_bo" ? "can_bo" : "don_vi";
  const sx = SAP_XEP[sp.sx] ? sp.sx : "diem";
  const unitList = (await sql`SELECT id, ten FROM don_vi WHERE hoat_dong ${scope ? sql`AND id IN ${sql(scope)}` : sql``} ORDER BY thu_tu, ten`) as unknown as { id: number; ten: string }[];
  const dv = unitList.some((u) => u.id === Number(sp.dv)) ? Number(sp.dv) : 0;

  const [units, people] = await Promise.all([kpiUnits(sql, ky, scope), kpiPeople(sql, ky, scope, dv || undefined)]);
  const all = xem === "don_vi" ? units : people;
  const rows = sx === "ten" ? all : [...all].sort(SAP_XEP[sx][1]);
  const total = tongHop(xem === "don_vi" ? units : people);
  const sum = tongHop(people.length ? people : units);
  const canhBao = [...people].filter((p) => p.qua_han > 0).sort((a, b) => b.qua_han - a.qua_han).slice(0, 5);
  const tieuBieu = [...people].filter((p) => p.diem != null && p.diem >= 90 && p.som + p.dung >= 1).sort((a, b) => (b.diem ?? 0) - (a.diem ?? 0) || b.som - a.som).slice(0, 5);
  const qs = (o: Record<string, string>) => {
    const p = new URLSearchParams({ ...(nam !== cur ? { nam: String(nam) } : {}), ...(quy ? { quy: String(quy) } : {}), ...(thang ? { thang: String(thang) } : {}), xem, sx, ...(dv ? { dv: String(dv) } : {}), ...o });
    for (const [k, v] of [...p.entries()]) if (!v) p.delete(k);
    return `/danh-gia-kpi?${p}`;
  };
  const viecLink = (extra: string) => `/viec?tab=tat_ca&con=1${nam < cur ? `&nam=${nam}` : ""}${extra}`;
  const tenPhamVi = scope === null ? "toàn phường" : unitList.length === 1 ? unitList[0].ten : `${unitList.length} đơn vị bạn quản lý`;

  const tile = (t: string, v: string | number, sub: string, cls = "") => (
    <div className={`card ${cls}`}>
      <div className="text-sm text-slate-600">{t}</div>
      <div className="mt-1 text-3xl font-bold text-slate-900">{v}</div>
      <div className="text-sm text-slate-500">{sub}</div>
    </div>
  );

  return (
    <div className="space-y-4" data-rong>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="h1">Đánh giá KPI thực hiện công việc</h1>
          <p className="muted">
            Phạm vi: {tenPhamVi} · Kỳ đánh giá: {label}
          </p>
        </div>
        <a href={`/api/xuat/kpi?${qs({}).split("?")[1]}`} className="btn btn-outline btn-sm">
          Xuất Excel
        </a>
      </div>

      <form action="/danh-gia-kpi" className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="xem" value={xem} />
        <input type="hidden" name="sx" value={sx} />
        <label className="block">
          <span className="text-sm text-slate-600">Năm</span>
          <select name="nam" defaultValue={nam} className="input min-h-10 py-1.5">
            {years.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm text-slate-600">Quý</span>
          <select name="quy" defaultValue={quy || ""} className="input min-h-10 py-1.5">
            <option value="">Cả năm</option>
            {[1, 2, 3, 4].map((q) => (
              <option key={q} value={q}>
                Quý {["", "I", "II", "III", "IV"][q]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm text-slate-600">Tháng</span>
          <select name="thang" defaultValue={thang || ""} className="input min-h-10 py-1.5">
            <option value="">—</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                Tháng {m}
              </option>
            ))}
          </select>
        </label>
        {xem === "can_bo" && unitList.length > 1 && (
          <label className="block min-w-48">
            <span className="text-sm text-slate-600">Đơn vị</span>
            <select name="dv" defaultValue={dv || ""} className="input min-h-10 py-1.5">
              <option value="">Tất cả đơn vị</option>
              {unitList.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.ten}
                </option>
              ))}
            </select>
          </label>
        )}
        <button className="btn btn-primary min-h-10">Xem</button>
      </form>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <div className="card col-span-2 md:col-span-1">
          <div className="text-sm text-slate-600">Điểm KPI chung</div>
          <div className="mt-1 text-3xl font-bold text-slate-900">{sum.diem ?? "–"}</div>
          <div className="mt-1">
            <XepLoai diem={sum.diem} />
          </div>
        </div>
        {tile("Tỷ lệ đúng hạn", sum.ty_le == null ? "–" : `${sum.ty_le}%`, "trên số việc đã đến hạn")}
        {tile("Vượt tiến độ", sum.som, "xong trước hạn ≥ 1 ngày", "border-emerald-200")}
        {tile("Đúng hạn", sum.dung, "xong trong hạn")}
        {tile("Trễ hạn", sum.tre, "xong sau hạn", sum.tre ? "border-orange-200" : "")}
        {tile("Đang quá hạn", sum.qua_han, "chưa xong, đã quá hạn", sum.qua_han ? "border-red-300 bg-red-50" : "")}
        {tile("Tồn việc", sum.ton, `${sum.dang_lam} việc còn hạn`)}
      </div>

      {scope === null || people.length > 1 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="card">
            <h2 className="h2">🏅 Cán bộ tiêu biểu</h2>
            <p className="text-sm text-slate-500">Điểm KPI từ 90 trở lên, xếp theo điểm và số việc vượt tiến độ.</p>
            <ul className="mt-2 divide-y divide-slate-100">
              {tieuBieu.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-2">
                  <Link href={viecLink(`&nguoi=${p.id}`)} className="min-w-0 flex-1 font-medium hover:underline">
                    {p.ten}
                    <span className="block truncate text-sm font-normal text-slate-500">{p.don_vi}</span>
                  </Link>
                  <span className="text-sm text-emerald-700">{p.som} vượt tiến độ</span>
                  <DiemKpi diem={p.diem} />
                </li>
              ))}
              {!tieuBieu.length && <li className="py-2 text-slate-500">Chưa có.</li>}
            </ul>
          </section>
          <section className="card border-red-200">
            <h2 className="h2">⚠ Cán bộ cần đôn đốc</h2>
            <p className="text-sm text-slate-500">Đang có việc quá hạn chưa xong.</p>
            <ul className="mt-2 divide-y divide-slate-100">
              {canhBao.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-2">
                  <Link href={viecLink(`&nguoi=${p.id}&trang_thai=dang_mo`)} className="min-w-0 flex-1 font-medium hover:underline">
                    {p.ten}
                    <span className="block truncate text-sm font-normal text-slate-500">{p.don_vi}</span>
                  </Link>
                  <span className="chip border-red-300 bg-red-50 font-semibold text-red-800">{p.qua_han} việc quá hạn</span>
                </li>
              ))}
              {!canhBao.length && <li className="py-2 text-slate-500">Không có cán bộ nào đang có việc quá hạn. 🎉</li>}
            </ul>
          </section>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex overflow-hidden rounded-xl border border-slate-300 bg-white">
          <Link href={qs({ xem: "don_vi", dv: "" })} className={`px-4 py-2 font-medium ${xem === "don_vi" ? "bg-slate-800 text-white" : "text-slate-700"}`}>
            Theo đơn vị ({units.length})
          </Link>
          <Link href={qs({ xem: "can_bo" })} className={`px-4 py-2 font-medium ${xem === "can_bo" ? "bg-slate-800 text-white" : "text-slate-700"}`}>
            Theo cán bộ ({people.length})
          </Link>
        </div>
        <span className="ml-auto text-sm text-slate-500">Sắp xếp:</span>
        {Object.entries(SAP_XEP).map(([k, [l]]) => (
          <Link key={k} href={qs({ sx: k })} className={`chip ${sx === k ? "border-slate-800 bg-slate-800 text-white" : "border-slate-300 bg-white text-slate-700"}`}>
            {l}
          </Link>
        ))}
      </div>

      {dv > 0 && xem === "can_bo" && (
        <p className="text-sm text-slate-600">
          Đang xem cán bộ của {unitList.find((u) => u.id === dv)?.ten}.{" "}
          <Link href={qs({ dv: "" })} className="text-brand-700 underline">
            Xem tất cả
          </Link>
        </p>
      )}

      <KpiTable
        rows={rows}
        kind={xem}
        total={total}
        link={(r) => (xem === "don_vi" ? qs({ xem: "can_bo", dv: String(r.id) }) : viecLink(`&nguoi=${r.id}`))}
      />

      <details className="card">
        <summary className="cursor-pointer font-semibold">Cách tính KPI</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px] text-slate-700">
          <li>Tính trên các việc có hạn trong kỳ, cộng các việc chưa xong có hạn trước kỳ (tồn từ kỳ trước). Không tính việc đã hủy.</li>
          <li>
            Mỗi việc được tính cho <b>một người chịu trách nhiệm</b>: công chức thực hiện nếu việc đã được giao lại, nếu không là người chủ trì. Đơn vị tính theo đơn vị
            chủ trì; việc con cùng đơn vị với việc cha không tính lặp.
          </li>
          <li>
            <b>Vượt tiến độ</b>: xong trước hạn từ 1 ngày trở lên. <b>Đúng hạn</b>: xong trong hạn. <b>Trễ hạn</b>: xong sau hạn. <b>Quá hạn</b>: đã quá hạn mà chưa
            xong. <b>Tồn việc</b>: mọi việc chưa xong.
          </li>
          <li>
            <b>Đang làm nhanh / chậm</b>: với việc còn hạn, so % tiến độ đã báo cáo với % thời gian đã trôi qua; nhanh hơn từ 10 điểm % trở lên là nhanh, chậm hơn
            từ 15 điểm % trở lên là chậm.
          </li>
          <li>
            <b>Điểm KPI</b> (0–100) = trung bình điểm các việc đã đến hạn hoặc đã xong: vượt tiến độ {DIEM.som}, đúng hạn {DIEM.dung}, trễ hạn {DIEM.tre}, quá hạn chưa
            xong {DIEM.qua_han}. Việc còn hạn chưa tính điểm.
          </li>
          <li>
            <b>Xếp loại</b>: {XEP_LOAI.map(([m, t]) => `${t}${m ? ` (từ ${m} điểm)` : " (dưới 50 điểm)"}`).join("; ")}.
          </li>
          <li>Số liệu tham khảo cho việc đánh giá, xếp loại cán bộ cuối năm; không thay thế quy trình đánh giá chính thức.</li>
        </ul>
      </details>
    </div>
  );
}
