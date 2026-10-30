import { db } from "./db";
import { getHolidays, getSettings } from "./settings";
import { notify, writeLog } from "./log";
import { workingDaysUntil, vnDate, vnTime, isWorkingDay, fmtDue } from "./time";
import { nextDue } from "./tasks";
import { loadKpis, currentPeriod, periodLabel } from "./kpi";

/**
 * Quét hạn và gửi nhắc việc (mục 4.3), tạo việc định kỳ, nhắc chốt số liệu chỉ tiêu.
 * Gọi từ tác vụ định kỳ và tự chạy nền khi có người dùng truy cập (tối đa 15 phút/lần).
 */
export async function runScan(force = false) {
  const sql = await db();
  const now = new Date();
  if (!force) {
    const r = await sql`
      INSERT INTO cai_dat (khoa, gia_tri) VALUES ('quet_cuoi', ${sql.json(now.toISOString())})
      ON CONFLICT (khoa) DO UPDATE SET gia_tri = EXCLUDED.gia_tri
      WHERE (cai_dat.gia_tri #>> '{}')::timestamptz < now() - interval '15 minutes'
      RETURNING khoa`;
    if (!r.length) return { skipped: true };
  } else {
    await sql`INSERT INTO cai_dat (khoa, gia_tri) VALUES ('quet_cuoi', ${sql.json(now.toISOString())})
              ON CONFLICT (khoa) DO UPDATE SET gia_tri = EXCLUDED.gia_tri`;
  }
  const cfg = await getSettings();
  const holidays = await getHolidays();
  const today = vnDate(now);
  let sent = 0;

  const leaders = (await sql`SELECT id, linh_vuc_phu_trach FROM nguoi_dung WHERE vai_tro = 'lanh_dao' AND trang_thai = 'hoat_dong'`) as unknown as {
    id: number;
    linh_vuc_phu_trach: string[];
  }[];
  const leadersFor = (lv: string) => {
    const specific = leaders.filter((l) => l.linh_vuc_phu_trach.includes(lv)).map((l) => l.id);
    return specific.length ? specific : leaders.filter((l) => !l.linh_vuc_phu_trach.length).map((l) => l.id);
  };
  const unitHeads = async (dv: number | null) =>
    dv ? ((await sql`SELECT id FROM nguoi_dung WHERE id_don_vi = ${dv} AND vai_tro = 'truong_don_vi' AND trang_thai = 'hoat_dong'`).map((r) => r.id) as number[]) : [];

  const tasks = await sql`
    SELECT id, ten, trang_thai, han, han_co_gio, linh_vuc, id_chu_tri, id_nguoi_thuc_hien, id_nguoi_giao, id_don_vi_chu_tri, tao_luc
    FROM cong_viec WHERE trang_thai IN ('moi_giao', 'da_nhan', 'dang_thuc_hien')`;
  for (const t of tasks) {
    const han = new Date(t.han);
    const hanDay = vnDate(han);
    const owners = [t.id_chu_tri, t.id_nguoi_thuc_hien];
    const qua = han.getTime() < now.getTime();
    const con = workingDaysUntil(han, holidays, now);
    if (!qua && cfg.nhac_truoc.includes(con) && hanDay !== today) {
      await notify(sql, owners, "nhac_han", `Còn ${con} ngày làm việc: ${t.ten}`, `Hạn ${fmtDue(han, t.han_co_gio)}`, "cong_viec", t.id, `truoc:${t.id}:${con}:${hanDay}`);
      sent++;
    }
    if (hanDay === today) {
      await notify(sql, [...owners, ...(await unitHeads(t.id_don_vi_chu_tri))], "den_han", `Đến hạn hôm nay: ${t.ten}`, `Hạn ${fmtDue(han, t.han_co_gio)}`, "cong_viec", t.id, `denhan:${t.id}:${hanDay}`);
      sent++;
    }
    if (qua && -con >= cfg.bao_cap_tren_sau) {
      await notify(sql, [t.id_nguoi_giao, ...leadersFor(t.linh_vuc)], "qua_han", `Quá hạn ${-con} ngày: ${t.ten}`, `Hạn ${fmtDue(han, t.han_co_gio)}`, "cong_viec", t.id, `baocaptren:${t.id}:${hanDay}`);
      sent++;
    }
    if (t.trang_thai === "moi_giao" && now.getTime() - new Date(t.tao_luc).getTime() > cfg.nhac_nhan_viec_gio * 3600000) {
      await notify(sql, [t.id_nguoi_giao], "chua_nhan", `Chưa xác nhận nhận việc: ${t.ten}`, `Quá ${cfg.nhac_nhan_viec_gio} giờ người chủ trì chưa bấm nhận việc`, "cong_viec", t.id, `chuanhan:${t.id}`);
      sent++;
    }
  }

  // Việc định kỳ: khi kỳ hiện tại hoàn thành hoặc đến hạn thì tạo kỳ sau
  const rec = await sql`
    SELECT * FROM cong_viec WHERE dinh_ky IS NOT NULL AND NOT da_tao_ky_sau AND trang_thai <> 'huy'
      AND (trang_thai = 'hoan_thanh' OR han <= now())`;
  for (const t of rec) {
    await sql.begin(async (tx) => {
      const lock = await tx`UPDATE cong_viec SET da_tao_ky_sau = TRUE WHERE id = ${t.id} AND NOT da_tao_ky_sau RETURNING id`;
      if (!lock.length) return;
      let han = nextDue(new Date(t.han), t.dinh_ky);
      while (han.getTime() < now.getTime()) han = nextDue(han, t.dinh_ky);
      const [n] = await tx`
        INSERT INTO cong_viec (ten, mo_ta, nguon_giao, so_hieu_vb, linh_vuc, uu_tien, han, han_co_gio, han_goc, san_pham,
          id_nguoi_giao, id_nguoi_tao, id_chu_tri, id_don_vi_chu_tri, dinh_ky, id_goc_dinh_ky)
        VALUES (${t.ten}, ${t.mo_ta}, ${t.nguon_giao}, ${t.so_hieu_vb}, ${t.linh_vuc}, ${t.uu_tien}, ${han}, ${t.han_co_gio}, ${han}, ${t.san_pham},
          ${t.id_nguoi_giao}, ${t.id_nguoi_tao}, ${t.id_chu_tri}, ${t.id_don_vi_chu_tri}, ${t.dinh_ky}, ${t.id_goc_dinh_ky || t.id})
        RETURNING id`;
      await tx`INSERT INTO cong_viec_thanh_vien (id_cong_viec, id_nguoi_dung, vai_tro)
               SELECT ${n.id}, id_nguoi_dung, vai_tro FROM cong_viec_thanh_vien WHERE id_cong_viec = ${t.id}`;
      await tx`INSERT INTO cong_viec_chi_tieu (id_cong_viec, id_chi_tieu) SELECT ${n.id}, id_chi_tieu FROM cong_viec_chi_tieu WHERE id_cong_viec = ${t.id}`;
      await writeLog(tx, null, "tao_dinh_ky", "cong_viec", n.id, null, { tu_viec: t.id, han });
      await notify(tx, [t.id_chu_tri], "giao_viec", `Việc định kỳ kỳ mới: ${t.ten}`, `Hạn ${fmtDue(han, t.han_co_gio)}`, "cong_viec", n.id, `giao:${n.id}`);
    });
  }

  // Tin tóm tắt 7 giờ 30 mỗi ngày làm việc
  if (isWorkingDay(today, holidays) && vnTime(now) >= cfg.gio_tom_tat) {
    const done = await sql`
      INSERT INTO cai_dat (khoa, gia_tri) VALUES ('tom_tat_ngay', ${sql.json(today)})
      ON CONFLICT (khoa) DO UPDATE SET gia_tri = EXCLUDED.gia_tri WHERE cai_dat.gia_tri #>> '{}' <> ${today}
      RETURNING khoa`;
    if (done.length) {
      const rows = await sql`
        SELECT u.id,
          count(*) FILTER (WHERE (cv.han AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = ${today}::date AND cv.han >= now())::int AS hom_nay,
          count(*) FILTER (WHERE cv.han >= now() AND (cv.han AT TIME ZONE 'Asia/Ho_Chi_Minh')::date > ${today}::date
                           AND (cv.han AT TIME ZONE 'Asia/Ho_Chi_Minh')::date <= ${today}::date + 5)::int AS sap_han,
          count(*) FILTER (WHERE cv.han < now())::int AS qua_han,
          count(*)::int AS tong
        FROM nguoi_dung u
        JOIN cong_viec cv ON (cv.id_chu_tri = u.id OR cv.id_nguoi_thuc_hien = u.id)
          AND cv.trang_thai IN ('moi_giao', 'da_nhan', 'dang_thuc_hien', 'cho_duyet')
        WHERE u.trang_thai = 'hoat_dong'
        GROUP BY u.id`;
      for (const r of rows) {
        await notify(sql, [r.id], "tom_tat", `Tóm tắt việc ngày ${today.slice(8, 10)}/${today.slice(5, 7)}`,
          `Hạn hôm nay: ${r.hom_nay} · Sắp đến hạn: ${r.sap_han} · Quá hạn: ${r.qua_han} · Đang làm: ${r.tong}`, "tom_tat", null, `tomtat:${today}`);
        sent++;
      }
    }
  }

  // Chỉ tiêu: nhắc chốt số liệu, cảnh báo nguy cơ, sắp hết hạn chưa đạt
  const kpis = await loadKpis(sql, sql`TRUE`, cfg.nguong_nguy_co);
  const day = Number(today.slice(8, 10));
  for (const k of kpis) {
    const ky = currentPeriod(k.ky_cap_nhat, now);
    if (k.ky_cap_nhat !== "tuan" && day >= k.ngay_chot - 3 && day <= k.ngay_chot) {
      const has = await sql`SELECT 1 FROM chi_tieu_so_lieu WHERE id_chi_tieu = ${k.id} AND ky = ${ky} AND hieu_luc LIMIT 1`;
      if (!has.length) {
        await notify(sql, [k.id_phu_trach], "chot_so_lieu", `Sắp đến hạn chốt số liệu: ${k.ten}`, `Kỳ ${periodLabel(ky)}, chốt ngày ${k.ngay_chot}`, "chi_tieu", k.id, `chot:${k.id}:${ky}`);
        sent++;
      }
    }
    if (k.nguy_co) {
      await notify(sql, [k.id_lanh_dao, ...leaders.filter((l) => !l.linh_vuc_phu_trach.length).map((l) => l.id)], "nguy_co", `Chỉ tiêu có nguy cơ không đạt: ${k.ten}`,
        k.pct == null ? "Chưa có số liệu" : `Đạt ${k.pct.toFixed(1)}%, lẽ ra phải đạt ${k.pct_le_ra.toFixed(1)}%`, "chi_tieu", k.id, `nguyco:${k.id}:${today.slice(0, 7)}`);
      sent++;
    }
    if (k.sap_het_han_chua_dat) {
      await notify(sql, [k.id_phu_trach, k.id_lanh_dao], "het_han_chi_tieu", `Chỉ tiêu sắp hết hạn mà chưa đạt: ${k.ten}`, null, "chi_tieu", k.id, `hethan:${k.id}`);
    }
  }
  return { skipped: false, sent };
}
