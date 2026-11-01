import Link from "next/link";
import { requirePerm } from "@/lib/auth";
import { traCuu } from "@/lib/tracuuRun";
import { GOI_Y } from "@/lib/tracuu";
import { VoiceSearch } from "@/components/VoiceSearch";
import { TaskCard } from "@/components/TaskCard";
import { KpiDot } from "@/components/Charts";
import { getHolidays, getSettings } from "@/lib/settings";
import { fmtNum } from "@/lib/kpi";

export const dynamic = "force-dynamic";

export default async function TraCuuPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const user = await requirePerm("bc.tra_cuu");
  const q = (sp.q || "").trim().slice(0, 300);
  const kq = q ? await traCuu(user, q) : null;
  const [hol, cfg] = await Promise.all([getHolidays(), getSettings()]);
  const canExport = user.quyen.includes("bc.xuat");
  const pct = (a: number, b: number) => (b ? `${Math.round((a * 100) / b)}%` : "–");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="h1">Tra cứu, tổng hợp theo yêu cầu</h1>
        <p className="muted">Gõ hoặc nói câu hỏi bằng tiếng Việt thông thường (có dấu hay không dấu đều được). Kết quả chỉ gồm nội dung bạn được phân công xem.</p>
      </div>
      <VoiceSearch initial={q} examples={GOI_Y} />

      {kq && (
        <>
          <div className="card">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-700">Phần mềm hiểu là:</span>
              {kq.bo_loc.hieu.map((h, i) => (
                <span key={i} className="chip border-brand-600/30 bg-brand-50 text-brand-800">
                  {h}
                </span>
              ))}
            </div>
            <p className="mt-2 text-sm text-slate-500">Nếu chưa đúng ý, hãy nói rõ hơn, ví dụ thêm “của phòng…”, “tháng…”, “quá hạn”, “theo từng đơn vị”.</p>
          </div>

          {kq.loai === "cong_viec" ? (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Stat label="Tổng số việc" v={kq.tong.tong} />
                <Stat label="Đang quá hạn" v={kq.tong.qua_han} bad />
                <Stat label="Đang làm" v={kq.tong.dang_lam} sub={kq.tong.cho_duyet ? `${kq.tong.cho_duyet} chờ xác nhận` : undefined} />
                <Stat label="Hoàn thành" v={kq.tong.hoan_thanh} sub={`${pct(kq.tong.dung_han, kq.tong.hoan_thanh)} đúng hạn`} />
              </div>
              {kq.nhom.length > 0 && (
                <div className="card overflow-x-auto">
                  <h2 className="h2">Tổng hợp</h2>
                  <table className="tbl mt-2 min-w-[560px]">
                    <thead>
                      <tr>
                        <th>Nhóm</th>
                        <th className="text-right">Tổng</th>
                        <th className="text-right">Quá hạn</th>
                        <th className="text-right">Đang làm</th>
                        <th className="text-right">Hoàn thành</th>
                        <th className="text-right">Đúng hạn</th>
                      </tr>
                    </thead>
                    <tbody>
                      {kq.nhom.map((g) => (
                        <tr key={g.ten}>
                          <td className="font-medium">{g.ten}</td>
                          <td className="text-right tabular-nums">{g.tong}</td>
                          <td className={`text-right tabular-nums ${g.qua_han ? "font-bold text-red-700" : ""}`}>{g.qua_han}</td>
                          <td className="text-right tabular-nums">{g.dang_lam}</td>
                          <td className="text-right tabular-nums">{g.hoan_thanh}</td>
                          <td className="text-right tabular-nums">{pct(g.dung_han, g.hoan_thanh)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="h2">Danh sách ({kq.ds.length}{kq.ds.length >= 1000 ? "+" : ""})</h2>
                {canExport && kq.ds.length > 0 && (
                  <a href={`/api/tra-cuu/xuat?q=${encodeURIComponent(q)}`} className="btn btn-outline btn-sm">
                    Xuất Excel
                  </a>
                )}
              </div>
              {kq.ds.length === 0 ? (
                <div className="card text-slate-500">Không tìm thấy công việc phù hợp trong phạm vi bạn được xem.</div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {kq.ds.slice(0, 100).map((t) => (
                    <TaskCard key={t.id} t={t} holidays={hol} nguong={cfg.nguong_vang} />
                  ))}
                </div>
              )}
              {kq.ds.length > 100 && <p className="text-center text-slate-500">Hiển thị 100 việc đầu. Xuất Excel để xem đủ.</p>}
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Stat label={`Chỉ tiêu năm ${kq.nam}`} v={kq.tong.tong} />
                <Stat label="Có nguy cơ" v={kq.tong.do} bad />
                <Stat label="Chậm nhẹ" v={kq.tong.vang} />
                <Stat label="Đúng tiến độ" v={kq.tong.xanh} sub={`${kq.tong.dat} đã đạt kế hoạch năm`} />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="h2">Danh sách ({kq.ds.length})</h2>
                {canExport && kq.ds.length > 0 && (
                  <a href={`/api/tra-cuu/xuat?q=${encodeURIComponent(q)}`} className="btn btn-outline btn-sm">
                    Xuất Excel
                  </a>
                )}
              </div>
              {kq.nhom.map((g) => (
                <details key={g.ten} className="card p-0" open={kq.nhom.length <= 3}>
                  <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3">
                    <span className="flex-1 font-bold">{g.ten}</span>
                    <span className="text-sm text-slate-600">
                      {g.tong} chỉ tiêu{g.do ? ` · ${g.do} nguy cơ` : ""}
                    </span>
                  </summary>
                  <ul className="divide-y divide-slate-100 border-t border-slate-100">
                    {kq.ds
                      .filter((k) => (kq.bo_loc.nhom_theo === "don_vi" ? k.ten_don_vi || "Chưa giao đơn vị" : kq.bo_loc.nhom_theo === "nguoi" ? k.ten_phu_trach || "Chưa có người phụ trách" : k.linh_vuc || "Chưa phân lĩnh vực") === g.ten)
                      .map((k) => (
                        <li key={k.id}>
                          <Link href={`/chi-tieu/${k.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                            <KpiDot mau={k.mau} />
                            <span className="min-w-0 flex-1">
                              <span className="font-medium">{k.ten}</span>
                              <span className="block text-sm text-slate-500">
                                {fmtNum(k.thuc_hien)} / {fmtNum(k.ke_hoach_nam)} {k.don_vi_tinh} · {k.ten_don_vi || k.ten_phu_trach}
                              </span>
                            </span>
                            <span className="w-14 text-right font-semibold tabular-nums">{k.pct == null ? "–" : `${Math.round(k.pct)}%`}</span>
                          </Link>
                        </li>
                      ))}
                  </ul>
                </details>
              ))}
              {kq.ds.length === 0 && <div className="card text-slate-500">Không tìm thấy chỉ tiêu phù hợp trong phạm vi bạn được xem.</div>}
            </>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, v, sub, bad }: { label: string; v: number; sub?: string; bad?: boolean }) {
  return (
    <div className={`card ${bad && v > 0 ? "border-red-300 bg-red-50" : ""}`}>
      <div className="text-[15px] text-slate-600">{label}</div>
      <div className={`mt-1 text-3xl font-bold tabular-nums ${bad && v > 0 ? "text-red-700" : ""}`}>{v}</div>
      {sub && <div className="text-sm text-slate-500">{sub}</div>}
    </div>
  );
}
