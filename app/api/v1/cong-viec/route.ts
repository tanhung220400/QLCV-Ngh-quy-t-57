import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkApiKey } from "@/lib/api";

export async function GET(req: Request) {
  const deny = checkApiKey(req);
  if (deny) return deny;
  const u = new URL(req.url);
  const since = u.searchParams.get("cap_nhat_tu");
  const sql = await db();
  const rows = await sql`
    SELECT cv.id, cv.ten, cv.nguon_giao, cv.so_hieu_vb, cv.linh_vuc, cv.uu_tien, cv.han, cv.trang_thai, cv.phan_tram, cv.san_pham,
      cv.ngay_hoan_thanh, cv.id_cha, ct.ho_ten AS chu_tri, dv.ten AS don_vi, ng.ho_ten AS nguoi_giao, cv.cap_nhat_luc
    FROM cong_viec cv JOIN nguoi_dung ct ON ct.id = cv.id_chu_tri JOIN nguoi_dung ng ON ng.id = cv.id_nguoi_giao LEFT JOIN don_vi dv ON dv.id = cv.id_don_vi_chu_tri
    WHERE ${since ? sql`cv.cap_nhat_luc >= ${new Date(since)}` : sql`TRUE`}
    ORDER BY cv.id LIMIT 5000`;
  return NextResponse.json({ data: rows });
}
