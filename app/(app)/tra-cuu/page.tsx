import Link from "next/link";
import { requirePerm } from "@/lib/auth";
import { traCuu } from "@/lib/tracuuRun";
import { GOI_Y } from "@/lib/tracuu";
import { VoiceSearch } from "@/components/VoiceSearch";
import { KpiDot } from "@/components/Charts";
import { fmtNum } from "@/lib/kpi";
import { fmtDue, fmtDate } from "@/lib/time";
import { taskStatusText } from "@/lib/reports";

export const dynamic = "force-dynamic";

const pct = (a: number, b: number) => (b ? `${Math.round((a * 100) / b)}%` : "–");

export default async function TraCuuPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const user = await requirePerm("bc.tra_cuu");
  const q = (sp.q || "").trim().slice(0, 300);
  const kq = q ? await traCuu(user, q) : null;
  const canExport = user.quyen.includes("bc.xuat");
  const cv = kq?.cong_viec;
  const ct = kq?.chi_tieu;
  const muc = kq
    ? [
        cv && { id: "cong-viec", ten: "Công việc", n: cv.ds.length },
        ct && { id: "chi-tieu", ten: "Chỉ tiêu", n: ct.ds.length },
        ...kq.ban_ghi.map((b) => ({ id: `md-${b.mo_dun.id}`, ten: b.mo_dun.ten, n: b.ds.length })),
        kq.can_bo.length > 0 && { id: "can-bo", ten: "Cán bộ", n: kq.can_bo.length },
        kq.don_vi.length > 0 && { id: "don-vi", ten: "Đơn vị", n: kq.don_vi.length },
      ].filter((x): x is { id: string; ten: string; n: number } => !!x)
    : [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="h1">Tra cứu, tổng hợp theo yêu cầu</h1>
        <p className="muted">
          Gõ hoặc nói câu hỏi bằng tiếng Việt thông thường (có dấu hay không dấu, viết tắt, gõ sai một chữ đều được). Phần mềm tìm trong toàn bộ dữ liệu bạn được xem: công việc (kể cả trao đổi, việc nhỏ, tên tệp), chỉ tiêu, dữ liệu các module, cán bộ, đơn vị — theo cả từ đồng nghĩa và nội dung liên quan.
        </p>
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
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="font-semibold">Tìm thấy {kq.tong_so} kết quả:</span>
              {muc.map((m) => (
                <a key={m.id} href={`#${m.id}`} className="chip hover:bg-slate-100">
                  {m.ten} <b className="ml-1">{m.n}</b>
                </a>
              ))}
              {canExport && kq.tong_so > 0 && (
                <a href={`/api/tra-cuu/xuat?q=${encodeURIComponent(q)}`} className="btn btn-primary btn-sm ml-auto">
                  Xuất Excel đầy đủ
                </a>
              )}
            </div>
            <p className="mt-2 text-sm text-slate-500">Kết quả xếp theo mức độ phù hợp. Nếu chưa đúng ý, hãy nói rõ hơn, ví dụ thêm “của phòng…”, “tháng…”, “quá hạn”, “theo từng đơn vị”.</p>
          </div>

          {kq.tong_so === 0 && <div className="card text-slate-500">Không tìm thấy nội dung phù hợp trong phạm vi bạn được xem. Thử dùng từ khác, ít từ hơn, hoặc bỏ bớt điều kiện thời gian.</div>}

          {cv && cv.ds.length > 0 && (
            <section id="cong-viec" className="scroll-mt-20 space-y-3">
              <h2 className="h2">Công việc ({cv.ds.length})</h2>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Stat label="Tổng số việc" v={cv.tong.tong} />
                <Stat label="Đang quá hạn" v={cv.tong.qua_han} bad />
                <Stat label="Đang làm" v={cv.tong.dang_lam} sub={cv.tong.cho_duyet ? `${cv.tong.cho_duyet} chờ xác nhận` : undefined} />
                <Stat label="Hoàn thành" v={cv.tong.hoan_thanh} sub={`${pct(cv.tong.dung_han, cv.tong.hoan_thanh)} đúng hạn`} />
              </div>
              {cv.nhom.length > 0 && (
                <div className="card overflow-x-auto">
                  <table className="tbl min-w-[560px]">
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
                      {cv.nhom.map((g) => (
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
              <div className="card overflow-x-auto p-0">
                <table className="tbl min-w-[760px]">
                  <thead>
                    <tr>
                      <th>Công việc</th>
                      <th>Chủ trì · Đơn vị</th>
                      <th>Hạn</th>
                      <th>Tình hình</th>
                      {kq.khai_niem.length > 0 && <th className="text-right">Phù hợp</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {cv.ds.slice(0, 200).map((t) => (
                      <tr key={t.id}>
                        <td>
                          <Link href={`/viec/${t.id}`} className="font-medium text-brand-700 underline">
                            {t.ten}
                          </Link>
                          <Trich t={t.trich} khop={t.khop} />
                        </td>
                        <td className="text-sm">{[t.ten_thuc_hien || t.ten_chu_tri, t.ten_don_vi].filter(Boolean).join(" · ")}</td>
                        <td className="text-sm whitespace-nowrap">{fmtDue(t.han, t.han_co_gio)}</td>
                        <td className="text-sm">{taskStatusText(t)}</td>
                        {kq.khai_niem.length > 0 && <td className="text-right tabular-nums">{t.diem ?? ""}%</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {cv.ds.length > 200 && <p className="text-center text-slate-500">Hiển thị 200 việc phù hợp nhất. Xuất Excel để xem đủ {cv.ds.length} việc.</p>}
            </section>
          )}

          {ct && ct.ds.length > 0 && (
            <section id="chi-tieu" className="scroll-mt-20 space-y-3">
              <h2 className="h2">Chỉ tiêu năm {ct.nam} ({ct.ds.length})</h2>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Stat label="Số chỉ tiêu" v={ct.tong.tong} />
                <Stat label="Có nguy cơ" v={ct.tong.do} bad />
                <Stat label="Chậm nhẹ" v={ct.tong.vang} />
                <Stat label="Đúng tiến độ" v={ct.tong.xanh} sub={`${ct.tong.dat} đã đạt kế hoạch năm`} />
              </div>
              <div className="card p-0">
                <ul className="divide-y divide-slate-100">
                  {ct.ds.map((k) => (
                    <li key={k.id}>
                      <Link href={`/chi-tieu/${k.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                        <KpiDot mau={k.mau} />
                        <span className="min-w-0 flex-1">
                          <span className="font-medium">{k.ten}</span>
                          <span className="block text-sm text-slate-500">
                            {fmtNum(k.thuc_hien)} / {fmtNum(k.ke_hoach_nam)} {k.don_vi_tinh} · {k.ten_don_vi || k.ten_phu_trach || "Nhiều đơn vị"}
                          </span>
                          <Trich t={k.trich} khop={k.khop} />
                        </span>
                        <span className="w-14 text-right font-semibold tabular-nums">{k.pct == null ? "–" : `${Math.round(k.pct)}%`}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          {kq.ban_ghi.map((b) => {
            const cot = b.truong.filter((f) => f.hien_danh_sach).slice(0, 4);
            return (
              <section key={b.mo_dun.id} id={`md-${b.mo_dun.id}`} className="scroll-mt-20 space-y-2">
                <h2 className="h2">
                  {b.mo_dun.ten} ({b.ds.length})
                </h2>
                <div className="card overflow-x-auto p-0">
                  <table className="tbl min-w-[700px]">
                    <thead>
                      <tr>
                        {cot.map((f) => (
                          <th key={f.khoa}>{f.ten}</th>
                        ))}
                        <th>Đơn vị · Ngày nhập</th>
                        <th className="text-right">Phù hợp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {b.ds.slice(0, 100).map((r) => (
                        <tr key={r.id}>
                          {cot.map((f, i) => (
                            <td key={f.khoa} className={i ? "text-sm" : ""}>
                              {i === 0 ? (
                                <>
                                  <Link href={`/m/${b.mo_dun.ma}/${r.id}`} className="font-medium text-brand-700 underline">
                                    {r.gia_tri[f.khoa] || r.tieu_de}
                                  </Link>
                                  <Trich t={r.trich} khop={r.khop} />
                                </>
                              ) : (
                                r.gia_tri[f.khoa]
                              )}
                            </td>
                          ))}
                          <td className="text-sm">{[r.don_vi, fmtDate(r.tao_luc)].filter(Boolean).join(" · ")}</td>
                          <td className="text-right tabular-nums">{r.diem}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}

          {kq.can_bo.length > 0 && (
            <section id="can-bo" className="scroll-mt-20 space-y-2">
              <h2 className="h2">Cán bộ ({kq.can_bo.length})</h2>
              <div className="card overflow-x-auto p-0">
                <table className="tbl min-w-[640px]">
                  <thead>
                    <tr>
                      <th>Họ tên</th>
                      <th>Chức vụ · Đơn vị</th>
                      <th>Lĩnh vực phụ trách</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kq.can_bo.map((p) => (
                      <tr key={p.id}>
                        <td className="font-medium">
                          {p.ho_ten}
                          {p.sdt && <span className="block text-sm font-normal text-slate-500">{p.sdt}</span>}
                        </td>
                        <td className="text-sm">
                          {[p.chuc_vu, p.don_vi].filter(Boolean).join(" · ")}
                          {p.kiem_nhiem && <span className="block text-slate-500">Kiêm nhiệm: {p.kiem_nhiem}</span>}
                        </td>
                        <td className="text-sm">{p.linh_vuc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {kq.don_vi.length > 0 && (
            <section id="don-vi" className="scroll-mt-20 space-y-2">
              <h2 className="h2">Đơn vị ({kq.don_vi.length})</h2>
              <div className="card p-0">
                <ul className="divide-y divide-slate-100">
                  {kq.don_vi.map((d) => (
                    <li key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <span className="flex-1 font-medium">{d.ten}</span>
                      <span className="text-sm text-slate-600">
                        {d.nguoi_dung_dau ? `${d.nguoi_dung_dau} · ` : ""}
                        {d.so_can_bo} cán bộ
                      </span>
                      <Link href={`/tra-cuu?q=${encodeURIComponent(`việc của ${d.ten}`)}`} className="text-sm text-brand-700 underline">
                        Xem công việc
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Trich({ t, khop }: { t?: string; khop?: string[] }) {
  if (!t && !khop?.length) return null;
  return (
    <span className="mt-0.5 block text-sm text-slate-600">
      {t && <span className="italic">{t}</span>}
      {khop && khop.length > 0 && <span className="ml-1 text-xs text-emerald-700">· khớp: {khop.join(", ")}</span>}
    </span>
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
