import { redirect } from "next/navigation";
import { after } from "next/server";
import { getUser } from "@/lib/auth";
import { db, hasDatabase } from "@/lib/db";
import { canCreateTask, isAdmin } from "@/lib/perm";
import { Nav, type NavNode } from "@/components/Nav";
import { runScan } from "@/lib/scan";
import { flushSms } from "@/lib/sms";
import { OfflineSync } from "@/components/OfflineSync";
import { menuTree, type MenuNode } from "@/lib/modules";
import { getSettings } from "@/lib/settings";
import { getTheme, themeImageUrl } from "@/lib/theme";
import { Welcome } from "@/components/Welcome";

export const dynamic = "force-dynamic";

const slim = (n: MenuNode): NavNode => ({ id: n.id, ten: n.ten, href: n.href, icon: n.bieu_tuong, mau: n.mau, loai: n.loai, con: n.con.map(slim) });

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
  const [unreadRow, tree, cfg, theme] = await Promise.all([
    sql`SELECT count(*)::int AS n FROM thong_bao WHERE id_nguoi_nhan = ${user.id} AND NOT da_doc`,
    menuTree(sql, user),
    getSettings(),
    getTheme(sql),
  ]);
  const unread = unreadRow[0].n as number;

  after(async () => {
    try {
      await runScan(false);
      await flushSms();
    } catch (e) {
      console.error("scan", e);
    }
  });

  const me = {
    menuImg: themeImageUrl("menu", theme.menu_v),
    phu: theme.phu_menu,
    ho_ten: user.ho_ten,
    chuc_vu: user.chuc_vu || "",
    don_vi: user.ten_don_vi || "",
    ten_xa: cfg.ten_don_vi || "UBND xã",
    admin: isAdmin(user),
    traCuu: user.quyen.includes("bc.tra_cuu"),
    giaoViec: canCreateTask(user),
  };

  return (
    <div className="min-h-dvh">
      <Welcome img={themeImageUrl("chao", theme.chao_v)} tenXa={cfg.ten_don_vi || "UBND xã"} hoTen={user.ho_ten} bat={theme.chao_bat} />
      <Nav tree={tree.map(slim)} unread={unread} me={me} />
      <div className="lg:pl-72">
        <main className="mx-auto max-w-6xl px-3 pt-5 pb-28 sm:px-5 lg:pb-12">
          {user.uy_quyen_tu.length > 0 && (
            <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-indigo-900">Bạn đang được ủy quyền xử lý công việc thay cho {user.uy_quyen_tu.length} người.</div>
          )}
          {children}
        </main>
        <OfflineSync />
      </div>
    </div>
  );
}
