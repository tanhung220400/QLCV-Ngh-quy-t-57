import { redirect } from "next/navigation";
import { after } from "next/server";
import { getUser } from "@/lib/auth";
import { db, hasDatabase } from "@/lib/db";
import { canCreateTask, canManageKpi } from "@/lib/perm";
import { Nav } from "@/components/Nav";
import { runScan } from "@/lib/scan";
import { OfflineSync } from "@/components/OfflineSync";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!hasDatabase()) redirect("/cai-dat-ban-dau");
  const user = await getUser();
  if (!user) {
    const sql = await db();
    const n = await sql`SELECT count(*)::int AS n FROM nguoi_dung`;
    redirect(n[0].n === 0 ? "/cai-dat-ban-dau" : "/dang-nhap");
  }
  if (user.doi_mat_khau) redirect("/doi-mat-khau");
  const sql = await db();
  const unread = (await sql`SELECT count(*)::int AS n FROM thong_bao WHERE id_nguoi_nhan = ${user.id} AND NOT da_doc`)[0].n as number;

  after(async () => {
    try {
      await runScan(false);
    } catch (e) {
      console.error("scan", e);
    }
  });

  const items = [
    { href: "/", label: "Tổng quan", icon: "home" },
    { href: "/viec", label: "Công việc", icon: "list" },
    ...(canCreateTask(user) ? [{ href: "/viec/moi", label: "Giao việc", icon: "plus" }] : []),
    { href: "/chi-tieu", label: "Chỉ tiêu", icon: "target" },
    { href: "/bao-cao", label: "Báo cáo", icon: "chart" },
    { href: "/thong-bao", label: "Thông báo", icon: "bell" },
    { href: "/tai-khoan", label: "Tài khoản", icon: "user" },
    ...(user.vai_tro === "quan_tri" || canManageKpi(user) ? [{ href: "/quan-tri", label: "Quản trị", icon: "cog" }] : []),
  ];
  const mobile = [
    { href: "/", label: "Tổng quan", icon: "home" },
    { href: "/viec", label: "Việc", icon: "list" },
    canCreateTask(user) ? { href: "/viec/moi", label: "Giao việc", icon: "plus" } : { href: "/chi-tieu", label: "Chỉ tiêu", icon: "target" },
    { href: "/thong-bao", label: "Thông báo", icon: "bell" },
  ];

  return (
    <div className="min-h-dvh">
      <Nav items={items} mobile={mobile} unread={unread} user={{ ho_ten: user.ho_ten, chuc_vu: user.chuc_vu || "" }} />
      <div className="lg:pl-64">
      <main className="mx-auto max-w-6xl px-3 pt-4 pb-28 sm:px-5 lg:pb-10">
        {user.uy_quyen_tu.length > 0 && (
          <div className="mb-3 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-indigo-900">
            Bạn đang được ủy quyền xử lý công việc thay cho {user.uy_quyen_tu.length} người.
          </div>
        )}
        {children}
      </main>
      <OfflineSync />
      </div>
    </div>
  );
}
