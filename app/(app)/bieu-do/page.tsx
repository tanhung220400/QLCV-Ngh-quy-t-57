import Link from "next/link";
import { requirePerm } from "@/lib/auth";
import { db } from "@/lib/db";
import { taskScope } from "@/lib/perm";
import { getCatalog } from "@/lib/settings";
import { oldYears } from "@/lib/taskQuery";
import { unitProgress, subtaskProgress } from "@/lib/unitProgress";
import { UnitProgressChart, SubtaskChart } from "@/components/UnitProgressChart";
import { vnDate } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function BieuDo({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requirePerm("bc.bieu_do");
  const sp = await searchParams;
  const sql = await db();
  const cur = Number(vnDate().slice(0, 4));
  const years = [cur, ...(await oldYears())];
  const nam = years.includes(Number(sp.nam)) ? Number(sp.nam) : cur;
  const quy = [1, 2, 3, 4].includes(Number(sp.quy)) ? Number(sp.quy) : 0;
  const thang = Number(sp.thang) >= 1 && Number(sp.thang) <= 12 ? Number(sp.thang) : 0;
  const linhVuc = await getCatalog("linh_vuc");
  const lv = linhVuc.includes(sp.linh_vuc || "") ? sp.linh_vuc : "";
  const scope = (await taskScope(sql, user)).q;
  const rows = await unitProgress(sql, scope, { nam, quy: thang ? 0 : quy, thang, linh_vuc: lv });
  const tong = rows.reduce((a, r) => a + r.tong, 0);
  // Biểu đồ con: chỉ cán bộ thuộc chính đơn vị chủ trì mới xem việc con của đơn vị mình
  const subs = user.id_don_vi ? await subtaskProgress(sql, user.id_don_vi, { nam, quy: thang ? 0 : quy, thang, linh_vuc: lv }) : [];
  const kyLabel = thang ? `tháng ${thang}/${nam}` : quy ? `quý ${["", "I", "II", "III", "IV"][quy]}/${nam}` : `năm ${nam}`;
  const linkBase = `/viec?tab=tat_ca${nam < cur ? `&nam=${nam}` : ""}${lv ? `&linh_vuc=${encodeURIComponent(lv)}` : ""}`;

  return (
    <div className="space-y-4" data-rong>
      <div>
        <h1 className="h1">So sánh tiến độ thực hiện công việc giữa các đơn vị</h1>
        <p className="muted">
          Việc lớn giao trong {kyLabel}
          {lv ? `, lĩnh vực ${lv}` : ""} · {rows.length} đơn vị · {tong} việc (không tính việc con và việc đã hủy)
        </p>
      </div>

      <form action="/bieu-do" className="flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="text-sm text-slate-600">Năm</span>
          <select name="nam" defaultValue={nam} className="input min-h-10 py-1.5">
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
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
        <label className="block min-w-48 flex-1 sm:flex-none">
          <span className="text-sm text-slate-600">Lĩnh vực</span>
          <select name="linh_vuc" defaultValue={lv} className="input min-h-10 py-1.5">
            <option value="">Mọi lĩnh vực</option>
            {linhVuc.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <button className="btn btn-primary min-h-10">Xem</button>
        {(quy || thang || lv || nam !== cur) && (
          <Link href="/bieu-do" className="btn btn-outline min-h-10">
            Bỏ lọc
          </Link>
        )}
      </form>

      <UnitProgressChart rows={rows} linkBase={linkBase} />

      {user.id_don_vi && (
        <section className="space-y-2" id="bieu-do-con">
          <div>
            <h2 className="h2">Biểu đồ con: tiến độ các việc con của {user.ten_don_vi}</h2>
            <p className="text-sm text-slate-500">
              Mỗi cột là một việc con (việc được chia nhỏ từ việc lớn do {user.ten_don_vi} chủ trì), cao theo % tiến độ. Chỉ cán bộ thuộc {user.ten_don_vi} xem được phần này.
            </p>
          </div>
          {subs.length ? <SubtaskChart rows={subs} /> : <div className="card text-slate-500">Đơn vị chưa có việc con trong {kyLabel}.</div>}
        </section>
      )}

      {rows.length > 0 && (
        <details className="card">
          <summary className="cursor-pointer font-semibold">Bảng số liệu</summary>
          <div className="mt-3 overflow-x-auto">
            <table className="tbl min-w-[760px]">
              <thead>
                <tr>
                  <th>Đơn vị</th>
                  <th className="text-right">Tổng việc</th>
                  <th className="text-right">Xong đúng hạn</th>
                  <th className="text-right">Xong trễ hạn</th>
                  <th className="text-right">Đang làm, còn hạn</th>
                  <th className="text-right">Chưa xong, quá hạn</th>
                  <th className="text-right">Tiến độ bình quân</th>
                  <th className="text-right">Đã hoàn thành</th>
                  <th className="text-right">Xong đúng hạn (%)</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {rows.map((r) => (
                  <tr key={r.id ?? "x"}>
                    <td className="font-medium">
                      <Link href={`${linkBase}${r.id ? `&don_vi=${r.id}` : ""}`} className="text-brand-700 hover:underline">
                        {r.ten}
                      </Link>
                    </td>
                    <td className="text-right">{r.tong}</td>
                    <td className="text-right">{r.dung_han}</td>
                    <td className="text-right">{r.tre_han}</td>
                    <td className="text-right">{r.dang_lam}</td>
                    <td className="text-right">{r.qua_han}</td>
                    <td className="text-right font-semibold">{r.tien_do}%</td>
                    <td className="text-right">{r.hoan_thanh}%</td>
                    <td className="text-right">{r.dung_han_pct == null ? "–" : `${r.dung_han_pct}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}
