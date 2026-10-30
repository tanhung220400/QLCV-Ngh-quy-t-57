import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkApiKey } from "@/lib/api";
import { loadKpis } from "@/lib/kpi";
import { getSettings } from "@/lib/settings";

export async function GET(req: Request) {
  const deny = checkApiKey(req);
  if (deny) return deny;
  const nam = Number(new URL(req.url).searchParams.get("nam")) || undefined;
  const sql = await db();
  const cfg = await getSettings();
  const rows = await loadKpis(sql, sql`TRUE`, cfg.nguong_nguy_co, nam);
  return NextResponse.json({ data: rows.map((k) => ({ id: k.id, ten: k.ten, nhom: k.nhom, nguon: k.nguon, don_vi_tinh: k.don_vi_tinh, nam: k.nam, ke_hoach_nam: k.ke_hoach_nam, thuc_hien: k.thuc_hien, phan_tram: k.pct, le_ra_phai_dat: k.pct_le_ra, nguy_co: k.nguy_co, id_cha: k.id_cha, don_vi: k.ten_don_vi })) });
}
