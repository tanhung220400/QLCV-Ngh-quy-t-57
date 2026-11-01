import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDateTime } from "@/lib/time";
import { MarkRead } from "@/components/MarkRead";

export const dynamic = "force-dynamic";

const ICON: Record<string, string> = {
  giao_viec: "📌", phoi_hop: "🤝", nhac_han: "⏰", den_han: "⏰", qua_han: "🔴", chua_nhan: "❔", tra_lai: "↩️", cho_duyet: "📝",
  hoan_thanh: "✅", lam_lai: "🔁", xin_gia_han: "📅", gia_han: "📅", nhac_ten: "💬", binh_luan: "💬", nhac: "🔔", tom_tat: "📋",
  nguy_co: "⚠️", qua_han_ct: "🔴", yeu_cau_mat_khau: "🔑", uy_quyen: "🤝", chot_so_lieu: "📊", xac_nhan_so_lieu: "📊", so_lieu: "📊", giao_chi_tieu: "🎯", het_han_chi_tieu: "⚠️", doi_han: "📅", trang_thai: "ℹ️", nhan_viec: "👍",
};

export default async function Notifications({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const sql = await db();
  const unreadOnly = sp.loc === "chua_doc";
  const rows = await sql`SELECT * FROM thong_bao WHERE id_nguoi_nhan = ${user.id} ${unreadOnly ? sql`AND NOT da_doc` : sql``} ORDER BY tao_luc DESC LIMIT 200`;
  const unread = rows.filter((r) => !r.da_doc).length;
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="h1">Thông báo</h1>
        <MarkRead all label={`Đánh dấu đã đọc tất cả${unread ? ` (${unread})` : ""}`} />
      </div>
      <div className="flex gap-2">
        <Link href="/thong-bao" className={`tab ${!unreadOnly ? "tab-on" : ""}`}>Tất cả</Link>
        <Link href="/thong-bao?loc=chua_doc" className={`tab ${unreadOnly ? "tab-on" : ""}`}>Chưa đọc</Link>
      </div>
      <div className="card divide-y divide-slate-100 p-0">
        {rows.map((n) => {
          const href = n.doi_tuong === "cong_viec" ? `/viec/${n.id_doi_tuong}` : n.doi_tuong === "chi_tieu" ? `/chi-tieu/${n.id_doi_tuong}` : n.doi_tuong === "nguoi_dung" && n.id_doi_tuong ? `/quan-tri?muc=nguoi_dung&sua=${n.id_doi_tuong}` : n.loai === "tom_tat" ? "/viec?tab=cua_toi&trang_thai=dang_mo" : "#";
          return (
            <MarkRead key={n.id} id={n.id} href={href}>
              <div className={`flex gap-3 px-4 py-3 ${n.da_doc ? "" : "bg-brand-50"}`}>
                <span className="text-xl" aria-hidden>{ICON[n.loai] || "•"}</span>
                <div className="min-w-0 flex-1">
                  <div className={n.da_doc ? "" : "font-semibold"}>{n.tieu_de}</div>
                  {n.noi_dung && <div className="text-[15px] text-slate-600">{n.noi_dung}</div>}
                  <div className="text-sm text-slate-500">{fmtDateTime(n.tao_luc)}</div>
                </div>
                {!n.da_doc && <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-brand-600" aria-label="Chưa đọc" />}
              </div>
            </MarkRead>
          );
        })}
        {rows.length === 0 && <p className="p-4 text-slate-500">Không có thông báo.</p>}
      </div>
      <p className="text-sm text-slate-500">Nhắc việc tự động: khi được giao, trước hạn 3 ngày và 1 ngày, khi đến hạn, quá hạn 3 ngày báo lên cấp trên, tin tóm tắt 7 giờ 30 mỗi ngày làm việc.</p>
    </div>
  );
}
