import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { queryTasks, oldYears, TABS, type TaskFilter } from "@/lib/taskQuery";
import { ActionForm, Submit } from "@/components/ActionForm";
import { bulkDeleteTasksAction } from "@/app/actions/task";
import { getCatalog, getHolidays, getSettings } from "@/lib/settings";
import { TaskCard } from "@/components/TaskCard";
import { TRANG_THAI, UU_TIEN, KANBAN_COT } from "@/lib/const";
import { canCreateTask } from "@/lib/perm";
import { Kanban } from "@/components/Kanban";
import { CalendarView } from "@/components/CalendarView";
import { dueColor } from "@/lib/tasks";
import { vnDate } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function TaskListPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const view = sp.xem || "ds";
  const tab = sp.tab || (user.pham_vi.loai === "toan_xa" || user.pham_vi.loai === "linh_vuc" ? "tat_ca" : "cua_toi");
  const f: TaskFilter = { ...sp, tab };
  const thang = /^\d{4}-\d{2}$/.test(sp.thang || "") ? sp.thang : vnDate().slice(0, 7);
  if (view === "lich") {
    const [y, m] = thang.split("-").map(Number);
    f.han_tu = `${thang}-01`;
    f.han_den = `${thang}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
    f.con = "1";
  }
  const [tasks, holidays, cfg, linhVuc, nguon] = await Promise.all([
    queryTasks(user, view === "kanban" ? { ...f, trang_thai: f.trang_thai || "" } : f),
    getHolidays(),
    getSettings(),
    getCatalog("linh_vuc"),
    getCatalog("nguon_giao"),
  ]);
  const sql = await db();
  const years = await oldYears();
  const nam = years.includes(Number(sp.nam)) ? Number(sp.nam) : 0;
  const admin = user.quyen.includes("qt.du_lieu");
  const chon = admin && sp.chon === "1" && view === "ds";
  const units = await sql`SELECT id, ten FROM don_vi WHERE hoat_dong ORDER BY thu_tu, ten`;
  const people = await sql`SELECT id, ho_ten FROM nguoi_dung WHERE trang_thai = 'hoat_dong' AND vai_tro <> 'quan_tri' ORDER BY ho_ten`;

  const qs = (over: Record<string, string>) => {
    const p = new URLSearchParams({ ...sp, tab, ...over });
    for (const [k, v] of [...p.entries()]) if (!v) p.delete(k);
    return `/viec?${p.toString()}`;
  };
  const hasFilter = ["q", "trang_thai", "linh_vuc", "don_vi", "nguon", "nguoi", "uu_tien", "han_tu", "han_den"].some((k) => sp[k]);
  const counts = { do: 0, vang: 0 };
  for (const t of tasks) {
    const c = dueColor(t, holidays, cfg.nguong_vang).mau;
    if (c === "do") counts.do++;
    if (c === "vang") counts.vang++;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="h1">{nam ? `Công việc năm ${nam}` : "Công việc"}</h1>
        <div className="flex gap-2">
          {canCreateTask(user) && (
            <>
              {user.quyen.includes("cv.nhap_nhanh") && (
                <Link href="/viec/nhap-nhanh" className="btn btn-outline btn-sm">
                  Nhập từ kết luận họp
                </Link>
              )}
              <Link href="/viec/moi" className="btn btn-primary btn-sm">
                + Giao việc
              </Link>
            </>
          )}
        </div>
      </div>
      {sp.moi && <p className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-emerald-800">Đã giao {sp.moi} việc.</p>}
      {sp.xoa && <p className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-emerald-800">Đã xóa công việc vào Thùng rác.</p>}

      {nam > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
          <span>📦 Đang xem các công việc giao trong năm {nam} (đã đóng gói). Việc chưa xong vẫn hiện ở danh sách năm nay để tiếp tục theo dõi.</span>
          <Link href={qs({ nam: "" })} className="font-semibold underline">
            Về công việc năm nay
          </Link>
        </div>
      )}
      {years.length > 0 && !nam && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-slate-500">Lưu trữ:</span>
          {years.map((y) => (
            <Link key={y} href={qs({ nam: String(y) })} className="chip border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100">
              📦 Công việc năm {y}
            </Link>
          ))}
        </div>
      )}

      <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1">
        {TABS.map((t) => (
          <Link key={t.key} href={qs({ tab: t.key })} className={`tab ${tab === t.key ? "tab-on" : ""}`}>
            {t.label}
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex overflow-hidden rounded-xl border border-slate-300 bg-white">
          {[
            ["ds", "Danh sách"],
            ["kanban", "Kanban"],
            ["lich", "Lịch"],
          ].map(([k, l]) => (
            <Link key={k} href={qs({ xem: k })} className={`px-4 py-2 font-medium ${view === k ? "bg-slate-800 text-white" : "text-slate-700"}`}>
              {l}
            </Link>
          ))}
        </div>
        <span className="text-slate-500">
          {tasks.length} việc
          {counts.do > 0 && <span className="ml-2 font-semibold text-red-700">· {counts.do} quá hạn</span>}
          {counts.vang > 0 && <span className="ml-2 font-semibold text-amber-700">· {counts.vang} sắp đến hạn</span>}
        </span>
        {admin && view === "ds" && (
          <Link href={qs({ chon: chon ? "" : "1" })} className={`btn btn-sm ${chon ? "btn-danger-soft" : "btn-outline"}`}>
            {chon ? "Thôi chọn" : "Chọn nhiều để xóa"}
          </Link>
        )}
        {user.quyen.includes("cv.xuat") && (
          <a href={`/api/xuat/viec?${new URLSearchParams({ ...sp, tab }).toString()}`} className="btn btn-outline btn-sm ml-auto">
            Xuất Excel
          </a>
        )}
      </div>

      <details className="card" open={hasFilter}>
        <summary className="cursor-pointer font-semibold">Lọc và tìm kiếm{hasFilter ? " (đang lọc)" : ""}</summary>
        <form className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" action="/viec">
          <input type="hidden" name="tab" value={tab} />
          <input type="hidden" name="xem" value={view} />
          {nam > 0 && <input type="hidden" name="nam" value={nam} />}
          <input name="q" defaultValue={sp.q} placeholder="Tên việc, số hiệu văn bản, cuộc họp" className="input sm:col-span-2" />
          <select name="trang_thai" defaultValue={sp.trang_thai || ""} className="input">
            <option value="">Mọi trạng thái (trừ Hủy)</option>
            <option value="dang_mo">Đang theo dõi (chưa xong)</option>
            {Object.entries(TRANG_THAI).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <select name="uu_tien" defaultValue={sp.uu_tien || ""} className="input">
            <option value="">Mọi mức ưu tiên</option>
            {Object.entries(UU_TIEN).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <select name="linh_vuc" defaultValue={sp.linh_vuc || ""} className="input">
            <option value="">Mọi lĩnh vực</option>
            {linhVuc.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <select name="nguon" defaultValue={sp.nguon || ""} className="input">
            <option value="">Mọi nguồn giao</option>
            {nguon.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <select name="don_vi" defaultValue={sp.don_vi || ""} className="input">
            <option value="">Mọi đơn vị</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.ten}
              </option>
            ))}
          </select>
          <select name="nguoi" defaultValue={sp.nguoi || ""} className="input">
            <option value="">Mọi người chủ trì</option>
            {people.map((u) => (
              <option key={u.id} value={u.id}>
                {u.ho_ten}
              </option>
            ))}
          </select>
          <label className="block">
            <span className="text-sm text-slate-600">Hạn từ ngày</span>
            <input type="date" name="han_tu" defaultValue={sp.han_tu} className="input" />
          </label>
          <label className="block">
            <span className="text-sm text-slate-600">Đến ngày</span>
            <input type="date" name="han_den" defaultValue={sp.han_den} className="input" />
          </label>
          <label className="flex items-center gap-2 self-end pb-2">
            <input type="checkbox" name="con" value="1" defaultChecked={sp.con === "1"} className="h-5 w-5" /> Hiện cả việc con
          </label>
          <div className="flex gap-2 self-end">
            <button className="btn btn-primary flex-1">Lọc</button>
            <Link href={`/viec?tab=${tab}&xem=${view}`} className="btn btn-outline">
              Bỏ lọc
            </Link>
          </div>
        </form>
      </details>

      {view === "kanban" ? (
        <Kanban
          columns={KANBAN_COT.map((k) => ({ key: k, label: TRANG_THAI[k] }))}
          tasks={tasks.map((t) => ({ ...t, mau: dueColor(t, holidays, cfg.nguong_vang).mau, nhan: dueColor(t, holidays, cfg.nguong_vang).nhan, han: t.han.toISOString() }))}
        />
      ) : view === "lich" ? (
        <CalendarView
          month={thang}
          baseQuery={qs({ thang: "" })}
          tasks={tasks.map((t) => ({ id: t.id, ten: t.ten, ngay: vnDate(t.han), mau: dueColor(t, holidays, cfg.nguong_vang).mau }))}
        />
      ) : tasks.length === 0 ? (
        <div className="card text-center text-slate-500">Không có công việc nào.</div>
      ) : chon ? (
        <ActionForm action={bulkDeleteTasksAction} confirm="Xóa các công việc đã chọn (kèm việc con)? Có thể khôi phục trong Thùng rác." className="space-y-3">
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-red-800">Đánh dấu ô vuông ở góc các việc cần xóa (việc giao sai, không cần thực hiện nữa), rồi bấm “Xóa các việc đã chọn” ở cuối trang.</p>
          <div className="grid gap-3 md:grid-cols-2">
            {tasks.map((t) => (
              <div key={t.id} className="relative">
                <TaskCard t={t} holidays={holidays} nguong={cfg.nguong_vang} />
                <label className="absolute top-2 right-2 flex cursor-pointer items-center gap-1.5 rounded-lg border border-red-200 bg-white/95 px-2 py-1 text-sm font-semibold text-red-700 shadow-soft">
                  <input type="checkbox" name="chon" value={t.id} className="h-5 w-5 accent-red-600" aria-label={`Chọn xóa: ${t.ten}`} />
                  Xóa
                </label>
              </div>
            ))}
          </div>
          <div className="sticky bottom-20 z-10 flex flex-wrap gap-2 rounded-2xl border border-red-200 bg-white p-3 shadow-lift lg:bottom-4">
            <input name="ly_do" className="input max-w-sm flex-1" placeholder="Lý do xóa (không bắt buộc)" />
            <Submit className="btn btn-danger">Xóa các việc đã chọn</Submit>
          </div>
        </ActionForm>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {tasks.map((t) => (
            <TaskCard key={t.id} t={t} holidays={holidays} nguong={cfg.nguong_vang} />
          ))}
        </div>
      )}
    </div>
  );
}
