import Link from "next/link";
import { requirePerm } from "@/lib/auth";
import { db } from "@/lib/db";
import { taskScope } from "@/lib/perm";
import { personStats } from "@/lib/stats";
import { meetingList, weekRange } from "@/lib/reports";
import { fromVN, vnDate, fmtDate } from "@/lib/time";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function Reports({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const user = await requirePerm("bc.xem");
  const sql = await db();
  const canExport = user.quyen.includes("bc.xuat");
  const canPeople = user.quyen.includes("bc.danh_gia");
  const w = weekRange();
  const nam = vnDate().slice(0, 4);
  const tu = sp.tu || `${nam}-01-01`;
  const den = sp.den || vnDate();
  const people = !canPeople ? [] : await personStats(sql, (await taskScope(sql, user)).q, fromVN(tu, "00:00"), fromVN(den, "23:59"));
  const meetings = await meetingList(user);
  const cfg = await getSettings();
  const cv = (cfg.chuc_vu_ky || "Chủ tịch").toLowerCase();
  const cfgKy = {
    chinh: `${cv.charAt(0).toUpperCase() + cv.slice(1)} ký${cfg.nguoi_ky ? ` (${cfg.nguoi_ky})` : ""}`,
    thay: `Ký thay: KT. ${cv}${cfg.nguoi_ky_thay ? ` – ${cfg.nguoi_ky_thay}` : ""}`,
  };

  return (
    <div className="space-y-4">
      <h1 className="h1">Báo cáo</h1>
      <p className="muted">Báo cáo lập tự động từ dữ liệu trên phần mềm, không cần nhập tay. Phạm vi theo quyền xem của bạn.</p>
      {user.quyen.includes("bc.tra_cuu") && (
        <Link href="/tra-cuu" className="card flex items-center gap-3 border-brand-100 bg-brand-50 hover:shadow-md">
          <span className="text-2xl" aria-hidden>🔎</span>
          <span className="flex-1">
            <b className="text-brand-800">Tra cứu, tổng hợp theo yêu cầu</b>
            <span className="block text-slate-600">Gõ hoặc nói câu hỏi, ví dụ “việc quá hạn của phòng kinh tế tháng này”, phần mềm tự lọc và tổng hợp số liệu.</span>
          </span>
          <span className="text-brand-700">›</span>
        </Link>
      )}
      {!canExport && <p className="rounded-xl bg-amber-50 px-3 py-2 text-amber-900">Tài khoản chưa được cấp quyền xuất báo cáo. Liên hệ quản trị nếu cần.</p>}

      {canExport && (
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card">
          <h2 className="h2">Tình hình thực hiện nhiệm vụ tuần</h2>
          <p className="text-sm text-slate-500">Dùng cho giao ban đầu tuần. Mặc định là tuần trước.</p>
          <form className="mt-3 space-y-3" action="/api/bao-cao/tuan">
            <div className="grid grid-cols-2 gap-2">
              <label>
                <span className="text-sm">Từ ngày</span>
                <input type="date" name="tu" defaultValue={w.tu} className="input" />
              </label>
              <label>
                <span className="text-sm">Đến ngày</span>
                <input type="date" name="den" defaultValue={w.den} className="input" />
              </label>
            </div>
            <label className="block">
              <span className="text-sm">Người ký</span>
              <select name="nguoi_ky" className="input" defaultValue="">
                <option value="">{cfgKy.chinh}</option>
                <option value="thay">{cfgKy.thay}</option>
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-primary">Tải Word</button>
              <button formAction="/in/tuan" formTarget="_blank" className="btn btn-outline">
                Xem / in PDF
              </button>
            </div>
          </form>
        </section>

        <section className="card">
          <h2 className="h2">Kết quả thực hiện chỉ tiêu</h2>
          <p className="text-sm text-slate-500">Báo cáo HĐND và tỉnh. Chỉ dùng số liệu đã được trưởng đơn vị xác nhận.</p>
          <form className="mt-3 space-y-3" action="/api/bao-cao/chi-tieu">
            <div className="grid grid-cols-2 gap-2">
              <label>
                <span className="text-sm">Năm</span>
                <input type="number" name="nam" defaultValue={nam} className="input" />
              </label>
              <label>
                <span className="text-sm">Kỳ báo cáo</span>
                <select name="ky" className="input" defaultValue="thang">
                  <option value="thang">Tháng</option>
                  <option value="quy">Quý</option>
                  <option value="6thang">6 tháng</option>
                  <option value="nam">Năm</option>
                </select>
              </label>
            </div>
            <label className="block">
              <span className="text-sm">Người ký</span>
              <select name="nguoi_ky" className="input" defaultValue="">
                <option value="">{cfgKy.chinh}</option>
                <option value="thay">{cfgKy.thay}</option>
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-primary">Tải Word</button>
              <button formAction="/api/xuat/chi-tieu" className="btn btn-outline">
                Tải Excel
              </button>
            </div>
          </form>
        </section>

        <section className="card">
          <h2 className="h2">Nhiệm vụ quá hạn theo đơn vị</h2>
          <p className="text-sm text-slate-500">Dùng để đôn đốc. Số ngày quá hạn tính theo ngày làm việc.</p>
          <div className="mt-3 flex gap-2">
            <a href="/api/xuat/qua-han" className="btn btn-primary">
              Tải Excel
            </a>
            <Link href="/viec?tab=qua_han" className="btn btn-outline">
              Xem danh sách
            </Link>
          </div>
        </section>

        <section className="card">
          <h2 className="h2">Thực hiện kết luận họp</h2>
          {meetings.length === 0 ? (
            <p className="mt-2 text-slate-500">Chưa có việc nào gắn tên cuộc họp. Khi giao việc từ kết luận họp, điền “Tên cuộc họp”.</p>
          ) : (
            <ul className="mt-2 divide-y divide-slate-100">
              {meetings.slice(0, 8).map((m) => (
                <li key={m.cuoc_hop} className="flex flex-wrap items-center gap-2 py-2">
                  <span className="min-w-0 flex-1">
                    <b>{m.cuoc_hop}</b>
                    <span className="block text-sm text-slate-500">
                      {fmtDate(m.ngay)} · {m.xong}/{m.n} việc xong
                    </span>
                  </span>
                  <a href={`/api/bao-cao/hop?ten=${encodeURIComponent(m.cuoc_hop)}`} className="btn btn-outline btn-sm">
                    Word
                  </a>
                  <a href={`/in/hop?ten=${encodeURIComponent(m.cuoc_hop)}`} target="_blank" className="btn btn-outline btn-sm">
                    PDF
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      )}

      {canPeople && (
      <section className="card">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="h2">Kết quả công việc cá nhân</h2>
            <p className="text-sm text-slate-500">Số liệu phục vụ đánh giá cán bộ. Phần mềm không tự xếp loại.</p>
          </div>
          <form className="flex flex-wrap items-end gap-2" action="/bao-cao">
            <label>
              <span className="text-sm">Hạn từ</span>
              <input type="date" name="tu" defaultValue={tu} className="input" />
            </label>
            <label>
              <span className="text-sm">đến</span>
              <input type="date" name="den" defaultValue={den} className="input" />
            </label>
            <button className="btn btn-outline">Xem</button>
            <a href={`/api/xuat/ca-nhan?tu=${tu}&den=${den}`} className="btn btn-primary">
              Tải Excel
            </a>
          </form>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="tbl min-w-[760px]">
            <thead>
              <tr>
                <th>Cán bộ</th>
                <th className="text-right">Được giao</th>
                <th className="text-right">Hoàn thành</th>
                <th className="text-right">Đúng hạn</th>
                <th className="text-right">Xin gia hạn</th>
                <th className="text-right">Làm lại</th>
                <th className="text-right">TB ngày quá hạn</th>
                <th className="text-right">Đang quá hạn</th>
              </tr>
            </thead>
            <tbody>
              {people.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/viec?tab=tat_ca&nguoi=${r.id}&con=1`} className="font-medium hover:underline">
                      {r.ho_ten}
                    </Link>
                    <span className="block text-sm text-slate-500">{[r.chuc_vu, r.don_vi].filter(Boolean).join(" · ")}</span>
                  </td>
                  <td className="text-right tabular-nums">{r.duoc_giao}</td>
                  <td className="text-right tabular-nums">{r.hoan_thanh}</td>
                  <td className="text-right tabular-nums">{r.duoc_giao ? `${Math.round((r.dung_han * 100) / r.duoc_giao)}%` : "–"}</td>
                  <td className="text-right tabular-nums">{r.gia_han}</td>
                  <td className="text-right tabular-nums">{r.lam_lai}</td>
                  <td className="text-right tabular-nums">{r.tb_ngay_qua_han.toFixed(1)}</td>
                  <td className={`text-right tabular-nums ${r.dang_qua_han ? "font-bold text-red-700" : ""}`}>{r.dang_qua_han}</td>
                </tr>
              ))}
              {people.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-slate-500">
                    Không có dữ liệu trong khoảng thời gian.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      )}
    </div>
  );
}