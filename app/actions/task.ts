"use server";
import type postgres from "postgres";
import { randomUUID } from "crypto";
import { after } from "next/server";
import { flushSms } from "@/lib/sms";
import { db } from "@/lib/db";
import { getUser, type User } from "@/lib/auth";
import { canCreateTask, identities, assignableUnits, taskPerms, type TaskRow } from "@/lib/perm";
import { notify, writeLog } from "@/lib/log";
import { fromVN, fmtDue } from "@/lib/time";
import { recomputePercent } from "@/lib/tasks";
import { TRANG_THAI, UU_TIEN } from "@/lib/const";
import { trashTask, trashSimple } from "@/lib/trash";
import { kiemTraGiao } from "@/lib/giaoViec";
import type { ActionState } from "@/components/ActionForm";

type Tx = postgres.TransactionSql;

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

/** Gửi SMS đang chờ sau khi trả kết quả cho người dùng (không làm chậm thao tác) */
function sendSmsLater() {
  try {
    after(() => flushSms().catch((e) => console.error("sms", e)));
  } catch {
    // ngoài phạm vi request (ví dụ gọi từ tác vụ định kỳ) thì bỏ qua
  }
}

/** Người dùng được phép giao việc cho những ai */
async function allowedAssignees(user: User): Promise<{ all: boolean; units: number[] }> {
  const u = await assignableUnits(user);
  return u === null ? { all: true, units: [] } : { all: false, units: u };
}

/** Người đứng đầu đơn vị: cấp trưởng (đơn vị chính hoặc kiêm nhiệm), rồi cấp phó, theo vai trò */
async function unitHead(sql: Tx, dv: number): Promise<number | null> {
  const r = await sql`SELECT id, CASE WHEN id_don_vi = ${dv} THEN chuc_vu ELSE chuc_vu_kiem_nhiem END AS cv, vai_tro FROM nguoi_dung
    WHERE (id_don_vi = ${dv} OR id_don_vi_kiem_nhiem = ${dv}) AND trang_thai = 'hoat_dong'`;
  const { bacChucVu } = await import("@/lib/canBo");
  const role: Record<string, number> = { truong_don_vi: 0, truong_thon: 1, lanh_dao: 2 };
  r.sort((a, b) => bacChucVu(a.cv) - bacChucVu(b.cv) || (role[a.vai_tro] ?? 3) - (role[b.vai_tro] ?? 3) || a.id - b.id);
  return r[0]?.id ?? null;
}

function parseDue(fd: FormData): { han: Date; coGio: boolean } | null {
  const ngay = str(fd, "han_ngay");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ngay)) return null;
  const gio = str(fd, "han_gio");
  const coGio = /^\d{2}:\d{2}$/.test(gio);
  return { han: fromVN(ngay, coGio ? gio : "23:59"), coGio };
}

export async function createTaskAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getUser();
  if (!user) return { redirect: "/dang-nhap" };
  const idCha = Number(str(fd, "id_cha")) || null;
  const sql = await db();
  type Parent = TaskRow & { linh_vuc: string; nguon_giao: string };
  let parent: Parent | null = null;
  if (idCha) {
    parent = ((await sql`SELECT * FROM cong_viec WHERE id = ${idCha}`)[0] ?? null) as unknown as Parent | null;
    if (!parent) return { error: "Không tìm thấy việc cha." };
    const p = await taskPerms(user, parent!);
    if (!p.viec_con) return { error: "Bạn không có quyền tạo việc con cho việc này." };
  } else if (!canCreateTask(user)) return { error: "Bạn không có quyền giao việc." };

  const ten = str(fd, "ten");
  const san_pham = str(fd, "san_pham");
  const due = parseDue(fd);
  const targets = fd.getAll("chu_tri").map(String).filter(Boolean);
  const missing: string[] = [];
  if (!ten) missing.push("tên công việc");
  if (!targets.length) missing.push("người chủ trì");
  if (!due) missing.push("hạn hoàn thành");
  if (!san_pham) missing.push("sản phẩm đầu ra");
  if (missing.length) return { error: `Chưa lưu được. Còn thiếu: ${missing.join(", ")}.` };
  const nguon = str(fd, "nguon_giao") || parent?.nguon_giao || "";
  const linh_vuc = str(fd, "linh_vuc") || parent?.linh_vuc || "";
  if (!nguon || !linh_vuc) return { error: "Chọn nguồn giao và lĩnh vực." };
  if (due!.han.getTime() < Date.now() - 86400000) return { error: "Hạn hoàn thành đã qua. Kiểm tra lại ngày." };

  const allowed = await allowedAssignees(user);
  const isOwnerOfParent = parent ? [parent.id_chu_tri, parent.id_nguoi_thuc_hien].includes(user.id) : false;
  let giao = user.id;
  const ng = Number(str(fd, "nguoi_giao"));
  if (ng && ng !== user.id) {
    const ids = await identities(user);
    if (user.vai_tro === "tong_hop" || ids.some((i) => i.id === ng)) giao = ng;
  }

  const phoi = fd.getAll("phoi_hop").map(Number).filter(Boolean);
  const theo = fd.getAll("theo_doi").map(Number).filter(Boolean);
  const kpis = fd.getAll("chi_tieu").map(Number).filter(Boolean);
  const dinh_ky = ["tuan", "thang", "quy"].includes(str(fd, "dinh_ky")) ? str(fd, "dinh_ky") : null;
  const checklist = str(fd, "checklist").split("\n").map((s) => s.trim()).filter(Boolean);
  const nhom = targets.length > 1 ? randomUUID() : null;
  const created: number[] = [];
  let err: string | null = null;

  await sql.begin(async (tx) => {
    for (const t of targets) {
      const [kind, idStr] = t.split(":");
      const id = Number(idStr);
      let chu: number | null = null;
      let dv: number | null = null;
      if (kind === "d") {
        dv = id;
        chu = await unitHead(tx, id);
        if (!chu) {
          err = "Đơn vị được giao chưa có trưởng đơn vị. Chọn một người cụ thể.";
          return;
        }
      } else {
        const u = (await tx`SELECT id, id_don_vi, trang_thai FROM nguoi_dung WHERE id = ${id}`)[0];
        if (!u || u.trang_thai !== "hoat_dong") {
          err = "Người chủ trì không hợp lệ.";
          return;
        }
        chu = u.id;
        dv = u.id_don_vi;
      }
      if (!allowed.all && !isOwnerOfParent && !(dv && allowed.units.includes(dv)) && chu !== user.id) {
        err = "Bạn chỉ được giao việc cho cán bộ trong đơn vị mình.";
        return;
      }
      const lyDo = await kiemTraGiao(tx, user, chu!, idCha);
      if (lyDo) {
        err = lyDo;
        return;
      }
      const [r] = await tx`
        INSERT INTO cong_viec (ten, mo_ta, nguon_giao, so_hieu_vb, cuoc_hop, linh_vuc, uu_tien, han, han_co_gio, han_goc, san_pham,
          id_nguoi_giao, id_nguoi_tao, id_chu_tri, id_don_vi_chu_tri, id_cha, nhom_giao, dinh_ky)
        VALUES (${ten}, ${str(fd, "mo_ta") || null}, ${nguon}, ${str(fd, "so_hieu_vb") || null}, ${str(fd, "cuoc_hop") || null}, ${linh_vuc},
          ${["thuong", "khan", "hoa_toc"].includes(str(fd, "uu_tien")) ? str(fd, "uu_tien") : "thuong"},
          ${due!.han}, ${due!.coGio}, ${due!.han}, ${san_pham}, ${giao}, ${user.id}, ${chu}, ${dv}, ${idCha}, ${nhom}, ${dinh_ky})
        RETURNING id`;
      for (const p of phoi) if (p !== chu) await tx`INSERT INTO cong_viec_thanh_vien VALUES (${r.id}, ${p}, 'phoi_hop') ON CONFLICT DO NOTHING`;
      for (const p of theo) await tx`INSERT INTO cong_viec_thanh_vien VALUES (${r.id}, ${p}, 'theo_doi') ON CONFLICT DO NOTHING`;
      for (const k of kpis) await tx`INSERT INTO cong_viec_chi_tieu VALUES (${r.id}, ${k}) ON CONFLICT DO NOTHING`;
      for (const [i, c] of checklist.entries()) await tx`INSERT INTO checklist (id_cong_viec, noi_dung, thu_tu) VALUES (${r.id}, ${c}, ${i})`;
      await writeLog(tx, user.id, "giao_viec", "cong_viec", r.id, null, { ten, chu_tri: chu, han: due!.han, nguoi_giao: giao });
      await notify(tx, [chu], "giao_viec", `Việc mới: ${ten}`, `Hạn ${fmtDue(due!.han, due!.coGio)} · Sản phẩm: ${san_pham}`, "cong_viec", r.id, `giao:${r.id}`, user.id);
      await notify(tx, phoi, "phoi_hop", `Phối hợp: ${ten}`, `Hạn ${fmtDue(due!.han, due!.coGio)}`, "cong_viec", r.id, `phoihop:${r.id}`, user.id);
      created.push(r.id);
    }
    if (idCha) await recomputePercent(tx, idCha);
  });
  if (err) return { error: err };
  sendSmsLater();
  if (idCha) return { ok: true, message: "Đã thêm việc con.", reset: true };
  if (created.length === 1) return { redirect: `/viec/${created[0]}?moi=1` };
  return { redirect: `/viec?tab=toi_giao&moi=${created.length}` };
}

/** Nhập nhanh nhiều việc từ kết luận họp */
export async function bulkCreateAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getUser();
  if (!user) return { redirect: "/dang-nhap" };
  if (!user.quyen.includes("cv.nhap_nhanh")) return { error: "Bạn không có quyền giao việc từ kết luận họp." };
  const rows = JSON.parse(str(fd, "rows") || "[]") as { ten: string; chu_tri: string; han: string; san_pham: string; linh_vuc: string; uu_tien: string }[];
  const valid = rows.filter((r) => r.ten.trim());
  if (!valid.length) return { error: "Chưa có việc nào." };
  for (const [i, r] of valid.entries()) {
    const miss = [!r.chu_tri && "người chủ trì", !/^\d{4}-\d{2}-\d{2}$/.test(r.han) && "hạn", !r.san_pham.trim() && "sản phẩm", !r.linh_vuc && "lĩnh vực"].filter(Boolean);
    if (miss.length) return { error: `Dòng ${i + 1} (“${r.ten.slice(0, 40)}”) còn thiếu: ${miss.join(", ")}.` };
  }
  let n = 0;
  for (const r of valid) {
    const f = new FormData();
    f.set("ten", r.ten.trim());
    f.set("chu_tri", r.chu_tri);
    f.set("han_ngay", r.han);
    f.set("san_pham", r.san_pham.trim());
    f.set("linh_vuc", r.linh_vuc);
    f.set("uu_tien", r.uu_tien || "thuong");
    f.set("nguon_giao", str(fd, "nguon_giao") || "Kết luận họp");
    f.set("cuoc_hop", str(fd, "cuoc_hop"));
    f.set("so_hieu_vb", str(fd, "so_hieu_vb"));
    f.set("nguoi_giao", str(fd, "nguoi_giao"));
    const res = await createTaskAction(null, f);
    if (res?.error) return { error: `Đã tạo ${n} việc. Dừng ở “${r.ten.slice(0, 40)}”: ${res.error}` };
    n++;
  }
  return { redirect: `/viec?tab=toi_giao&moi=${n}` };
}

async function sysComment(tx: Tx, id: number, uid: number, text: string, loai = "he_thong") {
  await tx`INSERT INTO binh_luan (id_cong_viec, id_nguoi_dung, noi_dung, loai) VALUES (${id}, ${uid}, ${text}, ${loai})`;
}

/** Mọi thao tác trên một công việc */
export async function taskAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getUser();
  if (!user) return { redirect: "/dang-nhap" };
  const id = Number(str(fd, "id"));
  const op = str(fd, "op");
  const sql = await db();
  const t = (await sql`SELECT * FROM cong_viec WHERE id = ${id}`)[0];
  if (!t) return { error: "Không tìm thấy công việc." };
  const p = await taskPerms(user, t as unknown as TaskRow);
  if (!p.xem) return { error: "Bạn không có quyền với công việc này." };
  const deny = { error: "Bạn không thể thực hiện thao tác này ở trạng thái hiện tại." };
  const owners = [t.id_chu_tri, t.id_nguoi_thuc_hien];
  const members = (await sql`SELECT id_nguoi_dung FROM cong_viec_thanh_vien WHERE id_cong_viec = ${id}`).map((r) => r.id_nguoi_dung as number);
  let msg = "Đã cập nhật.";
  let error: string | null = null;
  let redir: string | null = null;

  await sql.begin(async (tx) => {
    const setStatus = async (st: string, extra?: Record<string, unknown>) => {
      await tx`UPDATE cong_viec SET trang_thai = ${st}, cap_nhat_luc = now() WHERE id = ${id}`;
      if (extra) for (const [k, v] of Object.entries(extra)) await tx`UPDATE cong_viec SET ${tx(k)} = ${v as never} WHERE id = ${id}`;
      await writeLog(tx, user.id, `trang_thai:${op}`, "cong_viec", id, { trang_thai: t.trang_thai }, { trang_thai: st, ...(extra || {}) });
    };
    switch (op) {
      case "nhan": {
        if (!p.nhan) return void (error = deny.error);
        await setStatus("da_nhan", { ngay_nhan: new Date() });
        await sysComment(tx, id, user.id, "Đã nhận việc");
        await notify(tx, [t.id_nguoi_giao], "nhan_viec", `Đã nhận việc: ${t.ten}`, user.ho_ten, "cong_viec", id, undefined, user.id);
        msg = "Đã nhận việc.";
        break;
      }
      case "tra_lai": {
        if (!p.tra_lai) return void (error = deny.error);
        const ly_do = str(fd, "ly_do");
        if (!ly_do) return void (error = "Phải nêu lý do trả lại.");
        await setStatus("tra_lai", { ly_do_tra_lai: ly_do });
        await sysComment(tx, id, user.id, `Trả lại việc. Lý do: ${ly_do}`);
        await notify(tx, [t.id_nguoi_giao, t.id_nguoi_tao], "tra_lai", `Việc bị trả lại: ${t.ten}`, ly_do, "cong_viec", id, undefined, user.id);
        msg = "Đã trả lại việc cho người giao.";
        break;
      }
      case "giao_lai": {
        if (!p.giao_lai) return void (error = deny.error);
        const nguoi = Number(str(fd, "id_nguoi"));
        const u = (await tx`SELECT id, ho_ten, id_don_vi FROM nguoi_dung WHERE id = ${nguoi} AND trang_thai = 'hoat_dong'`)[0];
        if (!u) return void (error = "Chọn công chức nhận việc.");
        const allowed = await allowedAssignees(user);
        if (!allowed.all && !(u.id_don_vi && allowed.units.includes(u.id_don_vi))) return void (error = "Chỉ giao lại cho công chức trong đơn vị.");
        const lyDo = await kiemTraGiao(tx, user, nguoi, id);
        if (lyDo) return void (error = lyDo);
        await tx`UPDATE cong_viec SET id_nguoi_thuc_hien = ${nguoi}, cap_nhat_luc = now(),
                 trang_thai = CASE WHEN trang_thai = 'moi_giao' THEN 'da_nhan' ELSE trang_thai END,
                 ngay_nhan = COALESCE(ngay_nhan, now()) WHERE id = ${id}`;
        await writeLog(tx, user.id, "giao_lai", "cong_viec", id, { thuc_hien: t.id_nguoi_thuc_hien }, { thuc_hien: nguoi });
        await sysComment(tx, id, user.id, `Giao lại cho ${u.ho_ten} thực hiện (${user.ho_ten} vẫn chủ trì)`);
        await notify(tx, [nguoi], "giao_viec", `Được giao thực hiện: ${t.ten}`, `Hạn ${fmtDue(t.han, t.han_co_gio)}`, "cong_viec", id, undefined, user.id);
        msg = `Đã giao lại cho ${u.ho_ten}.`;
        break;
      }
      case "cap_nhat": {
        if (!p.cap_nhat) return void (error = deny.error);
        const pct = Math.max(0, Math.min(100, Number(str(fd, "phan_tram"))));
        const ghi = str(fd, "ghi_chu");
        const hasSub = (await tx`SELECT (SELECT count(*) FROM cong_viec WHERE id_cha = ${id} AND trang_thai <> 'huy') + (SELECT count(*) FROM checklist WHERE id_cong_viec = ${id}) AS n`)[0].n > 0;
        if (!hasSub && !Number.isNaN(pct)) await tx`UPDATE cong_viec SET phan_tram = ${pct}, phan_tram_tay = TRUE WHERE id = ${id}`;
        if (t.trang_thai === "da_nhan") await setStatus("dang_thuc_hien");
        else await writeLog(tx, user.id, "cap_nhat_tien_do", "cong_viec", id, { phan_tram: t.phan_tram }, { phan_tram: pct, ghi_chu: ghi });
        await sysComment(tx, id, user.id, `Cập nhật tiến độ${hasSub ? "" : `: ${pct}%`}${ghi ? `. ${ghi}` : ""}`, "tien_do");
        if (t.id_cha) await recomputePercent(tx, t.id_cha);
        msg = "Đã cập nhật tiến độ.";
        break;
      }
      case "bat_dau": {
        if (!p.cap_nhat || t.trang_thai !== "da_nhan") return void (error = deny.error);
        await setStatus("dang_thuc_hien");
        msg = "Đã chuyển sang Đang thực hiện.";
        break;
      }
      case "bao_cao": {
        if (!p.bao_cao) return void (error = deny.error);
        const kq = str(fd, "ket_qua");
        if (!kq) return void (error = "Mô tả kết quả, sản phẩm đã hoàn thành.");
        const files = (await tx`SELECT count(*)::int AS n FROM tep_dinh_kem WHERE doi_tuong = 'cong_viec' AND id_doi_tuong = ${id}`)[0].n;
        if (!files && fd.get("khong_tep") !== "1") return void (error = "Đính kèm sản phẩm hoặc ảnh minh chứng trước khi báo cáo (hoặc đánh dấu “không có tệp”).");
        const selfApprove = t.id_nguoi_giao === user.id;
        await setStatus(selfApprove ? "hoan_thanh" : "cho_duyet", { ket_qua: kq, ngay_bao_cao: new Date(), ...(selfApprove ? { ngay_hoan_thanh: new Date(), phan_tram: 100 } : {}) });
        await sysComment(tx, id, user.id, `Báo cáo hoàn thành: ${kq}`);
        if (!selfApprove) await notify(tx, [t.id_nguoi_giao], "cho_duyet", `Chờ duyệt kết quả: ${t.ten}`, kq, "cong_viec", id, undefined, user.id);
        if (t.id_cha) await recomputePercent(tx, t.id_cha);
        msg = selfApprove ? "Đã hoàn thành." : "Đã gửi báo cáo, chờ người giao duyệt.";
        break;
      }
      case "duyet": {
        if (!p.duyet || t.trang_thai !== "cho_duyet") return void (error = deny.error);
        const yk = str(fd, "y_kien");
        if (str(fd, "ket_luan") === "lam_lai") {
          if (!yk) return void (error = "Nêu yêu cầu làm lại.");
          await setStatus("dang_thuc_hien", { so_lan_lam_lai: t.so_lan_lam_lai + 1 });
          await sysComment(tx, id, user.id, `Yêu cầu làm lại: ${yk}`);
          await notify(tx, owners, "lam_lai", `Yêu cầu làm lại: ${t.ten}`, yk, "cong_viec", id, undefined, user.id);
          msg = "Đã yêu cầu làm lại.";
        } else {
          await setStatus("hoan_thanh", { ngay_hoan_thanh: t.ngay_bao_cao || new Date(), phan_tram: 100 });
          await sysComment(tx, id, user.id, `Duyệt hoàn thành${yk ? `: ${yk}` : ""}`);
          await notify(tx, [...owners, ...members], "hoan_thanh", `Đã duyệt hoàn thành: ${t.ten}`, yk || null, "cong_viec", id, undefined, user.id);
          if (t.id_cha) await recomputePercent(tx, t.id_cha);
          msg = "Đã duyệt hoàn thành.";
        }
        break;
      }
      case "xin_gia_han": {
        if (!p.xin_gia_han) return void (error = deny.error);
        const ly_do = str(fd, "ly_do");
        const due = parseDue(fd);
        if (!ly_do || !due) return void (error = "Phải nêu lý do và hạn mới.");
        if (due.han.getTime() <= new Date(t.han).getTime()) return void (error = "Hạn mới phải sau hạn hiện tại.");
        const pending = await tx`SELECT 1 FROM gia_han WHERE id_cong_viec = ${id} AND trang_thai_duyet = 'cho_duyet'`;
        if (pending.length) return void (error = "Đã có đề nghị gia hạn đang chờ duyệt.");
        await tx`INSERT INTO gia_han (id_cong_viec, han_cu, han_moi, ly_do, id_nguoi_xin) VALUES (${id}, ${t.han}, ${due.han}, ${ly_do}, ${user.id})`;
        await writeLog(tx, user.id, "xin_gia_han", "cong_viec", id, { han: t.han }, { han_moi: due.han, ly_do });
        await sysComment(tx, id, user.id, `Xin gia hạn đến ${fmtDue(due.han, due.coGio)}. Lý do: ${ly_do}`);
        await notify(tx, [t.id_nguoi_giao], "xin_gia_han", `Xin gia hạn: ${t.ten}`, `Đến ${fmtDue(due.han, due.coGio)} — ${ly_do}`, "cong_viec", id, undefined, user.id);
        msg = "Đã gửi đề nghị gia hạn.";
        break;
      }
      case "duyet_gia_han": {
        if (!p.duyet) return void (error = deny.error);
        const g = (await tx`SELECT * FROM gia_han WHERE id = ${Number(str(fd, "id_gia_han"))} AND id_cong_viec = ${id} AND trang_thai_duyet = 'cho_duyet'`)[0];
        if (!g) return void (error = "Đề nghị gia hạn không còn chờ duyệt.");
        const ok = str(fd, "ket_luan") === "dong_y";
        const yk = str(fd, "y_kien");
        await tx`UPDATE gia_han SET trang_thai_duyet = ${ok ? "dong_y" : "tu_choi"}, id_nguoi_duyet = ${user.id}, y_kien_duyet = ${yk || null}, duyet_luc = now() WHERE id = ${g.id}`;
        if (ok) {
          await tx`UPDATE cong_viec SET han = ${g.han_moi}, so_lan_gia_han = so_lan_gia_han + 1, cap_nhat_luc = now() WHERE id = ${id}`;
          await writeLog(tx, user.id, "duyet_gia_han", "cong_viec", id, { han: t.han }, { han: g.han_moi });
        } else await writeLog(tx, user.id, "tu_choi_gia_han", "cong_viec", id, null, { id_gia_han: g.id, y_kien: yk });
        await sysComment(tx, id, user.id, `${ok ? "Đồng ý" : "Không đồng ý"} gia hạn${ok ? ` đến ${fmtDue(g.han_moi, t.han_co_gio)}` : ""}${yk ? `. ${yk}` : ""}`);
        await notify(tx, [g.id_nguoi_xin, ...owners], "gia_han", `${ok ? "Đã duyệt" : "Không duyệt"} gia hạn: ${t.ten}`, yk || null, "cong_viec", id, undefined, user.id);
        msg = ok ? "Đã đồng ý gia hạn." : "Đã từ chối gia hạn.";
        break;
      }
      case "tam_dung":
      case "tiep_tuc":
      case "huy": {
        if (!p.quan_ly) return void (error = deny.error);
        const ly_do = str(fd, "ly_do");
        if (op === "huy" && !ly_do) return void (error = "Nêu lý do hủy việc.");
        if (op === "tam_dung" && !["moi_giao", "da_nhan", "dang_thuc_hien"].includes(t.trang_thai)) return void (error = deny.error);
        if (op === "tiep_tuc" && t.trang_thai !== "tam_dung") return void (error = deny.error);
        if (op === "huy" && ["hoan_thanh", "huy"].includes(t.trang_thai)) return void (error = deny.error);
        const st = op === "tam_dung" ? "tam_dung" : op === "huy" ? "huy" : t.ngay_nhan ? "dang_thuc_hien" : "moi_giao";
        await setStatus(st);
        await sysComment(tx, id, user.id, `${TRANG_THAI[st] === "Hủy" ? "Hủy việc" : op === "tam_dung" ? "Tạm dừng" : "Tiếp tục thực hiện"}${ly_do ? `. Lý do: ${ly_do}` : ""}`);
        await notify(tx, [...owners, ...members], "trang_thai", `${op === "huy" ? "Đã hủy" : op === "tam_dung" ? "Tạm dừng" : "Tiếp tục"}: ${t.ten}`, ly_do || null, "cong_viec", id, undefined, user.id);
        if (t.id_cha) await recomputePercent(tx, t.id_cha);
        msg = "Đã cập nhật trạng thái.";
        break;
      }
      case "doi_chu_tri": {
        // Người giao chọn lại người chủ trì sau khi bị trả lại
        if (!p.quan_ly) return void (error = deny.error);
        const [kind, v] = str(fd, "chu_tri").split(":");
        let chu: number | null = null;
        let dv: number | null = null;
        if (kind === "d") {
          dv = Number(v);
          chu = await unitHead(tx, dv);
        } else {
          const u = (await tx`SELECT id, id_don_vi FROM nguoi_dung WHERE id = ${Number(v)} AND trang_thai = 'hoat_dong'`)[0];
          chu = u?.id ?? null;
          dv = u?.id_don_vi ?? null;
        }
        if (!chu) return void (error = "Chọn người hoặc đơn vị chủ trì hợp lệ.");
        if (!p.admin) {
          const lyDo = await kiemTraGiao(tx, user, chu, t.id_cha);
          if (lyDo) return void (error = lyDo);
        }
        await tx`UPDATE cong_viec SET id_chu_tri = ${chu}, id_don_vi_chu_tri = ${dv}, id_nguoi_thuc_hien = NULL, trang_thai = 'moi_giao',
                 ngay_nhan = NULL, ly_do_tra_lai = NULL, tao_luc = now(), cap_nhat_luc = now() WHERE id = ${id}`;
        await writeLog(tx, user.id, "doi_chu_tri", "cong_viec", id, { chu_tri: t.id_chu_tri, trang_thai: t.trang_thai }, { chu_tri: chu, trang_thai: "moi_giao" });
        const name = (await tx`SELECT ho_ten FROM nguoi_dung WHERE id = ${chu}`)[0].ho_ten;
        await sysComment(tx, id, user.id, `Giao lại cho ${name} chủ trì`);
        await notify(tx, [chu], "giao_viec", `Việc mới: ${t.ten}`, `Hạn ${fmtDue(t.han, t.han_co_gio)}`, "cong_viec", id, undefined, user.id);
        msg = `Đã giao cho ${name}.`;
        break;
      }
      case "xoa": {
        if (!p.admin) return void (error = "Chỉ quản trị dữ liệu mới xóa được công việc.");
        await trashTask(tx, id, user.id, str(fd, "ly_do") || null);
        if (t.id_cha) await recomputePercent(tx, t.id_cha);
        redir = t.id_cha ? `/viec/${t.id_cha}` : "/viec?xoa=1";
        break;
      }
      case "xoa_binh_luan": {
        if (!p.admin) return void (error = deny.error);
        const bid = Number(str(fd, "id_binh_luan"));
        const b = (await tx`SELECT noi_dung FROM binh_luan WHERE id = ${bid} AND id_cong_viec = ${id}`)[0];
        if (!b) return void (error = "Không tìm thấy nội dung trao đổi.");
        await trashSimple(tx, "binh_luan", "binh_luan", bid, user.id, `Trao đổi ở “${t.ten.slice(0, 60)}”: ${String(b.noi_dung).slice(0, 60)}`, null);
        msg = "Đã xóa nội dung trao đổi.";
        break;
      }
      case "sua_admin": {
        // Quản trị dữ liệu: sửa mọi thông tin kể cả trạng thái, người giao, người chủ trì
        if (!p.admin) return void (error = deny.error);
        const ten = str(fd, "ten");
        const due = parseDue(fd);
        if (!ten || !due) return void (error = "Tên và hạn không được để trống.");
        const chu = Number(str(fd, "id_chu_tri")) || t.id_chu_tri;
        const giao = Number(str(fd, "id_nguoi_giao")) || t.id_nguoi_giao;
        const thuc = Number(str(fd, "id_nguoi_thuc_hien")) || null;
        const ok = await tx`SELECT id, id_don_vi FROM nguoi_dung WHERE id IN ${tx([chu, giao, ...(thuc ? [thuc] : [])])}`;
        if (!ok.some((r) => r.id === chu) || !ok.some((r) => r.id === giao)) return void (error = "Người giao hoặc người chủ trì không hợp lệ.");
        const st = TRANG_THAI[str(fd, "trang_thai")] ? str(fd, "trang_thai") : t.trang_thai;
        const pct = Math.max(0, Math.min(100, Number(str(fd, "phan_tram")) || 0));
        const moi = {
          ten,
          mo_ta: str(fd, "mo_ta") || null,
          nguon_giao: str(fd, "nguon_giao") || t.nguon_giao,
          so_hieu_vb: str(fd, "so_hieu_vb") || null,
          cuoc_hop: str(fd, "cuoc_hop") || null,
          linh_vuc: str(fd, "linh_vuc") || t.linh_vuc,
          san_pham: str(fd, "san_pham") || t.san_pham,
          uu_tien: UU_TIEN[str(fd, "uu_tien")] ? str(fd, "uu_tien") : t.uu_tien,
          han: due.han,
          han_co_gio: due.coGio,
          trang_thai: st,
          phan_tram: st === "hoan_thanh" ? 100 : pct,
          phan_tram_tay: true,
          id_nguoi_giao: giao,
          id_chu_tri: chu,
          id_don_vi_chu_tri: chu !== t.id_chu_tri ? (ok.find((r) => r.id === chu)?.id_don_vi ?? null) : t.id_don_vi_chu_tri,
          id_nguoi_thuc_hien: thuc,
          ngay_hoan_thanh: st === "hoan_thanh" ? (t.ngay_hoan_thanh ?? new Date()) : null,
          ngay_nhan: st === "moi_giao" ? null : (t.ngay_nhan ?? new Date()),
        };
        const cu = Object.fromEntries(Object.keys(moi).map((k) => [k, t[k]]));
        await tx`UPDATE cong_viec SET ${tx(moi as never)}, cap_nhat_luc = now() WHERE id = ${id}`;
        await writeLog(tx, user.id, "sua_quan_tri", "cong_viec", id, cu, moi);
        await sysComment(tx, id, user.id, `Quản trị cập nhật thông tin công việc${st !== t.trang_thai ? ` (trạng thái: ${TRANG_THAI[st]})` : ""}`);
        if (t.id_cha) await recomputePercent(tx, t.id_cha);
        msg = "Đã lưu thay đổi.";
        break;
      }
      case "sua": {
        if (!p.quan_ly || (["hoan_thanh", "huy"].includes(t.trang_thai) && !p.admin)) return void (error = deny.error);
        const ten = str(fd, "ten");
        const sp = str(fd, "san_pham");
        const due = parseDue(fd);
        if (!ten || !sp || !due) return void (error = "Tên, hạn và sản phẩm đầu ra không được để trống.");
        const moi = {
          ten,
          mo_ta: str(fd, "mo_ta") || null,
          san_pham: sp,
          uu_tien: ["thuong", "khan", "hoa_toc"].includes(str(fd, "uu_tien")) ? str(fd, "uu_tien") : t.uu_tien,
          linh_vuc: str(fd, "linh_vuc") || t.linh_vuc,
          so_hieu_vb: str(fd, "so_hieu_vb") || null,
          han: due.han,
          han_co_gio: due.coGio,
        };
        const cu = Object.fromEntries(Object.keys(moi).map((k) => [k, t[k]]));
        await tx`UPDATE cong_viec SET ${tx(moi as never)}, cap_nhat_luc = now() WHERE id = ${id}`;
        await writeLog(tx, user.id, "sua_viec", "cong_viec", id, cu, moi);
        const doiHan = new Date(t.han).getTime() !== due.han.getTime();
        await sysComment(tx, id, user.id, `Sửa thông tin công việc${doiHan ? `. Hạn mới: ${fmtDue(due.han, due.coGio)}` : ""}`);
        if (doiHan) await notify(tx, owners, "doi_han", `Đổi hạn: ${ten}`, `Hạn mới ${fmtDue(due.han, due.coGio)}`, "cong_viec", id, undefined, user.id);
        msg = "Đã lưu thay đổi.";
        break;
      }
      case "binh_luan": {
        const nd = str(fd, "noi_dung");
        if (!nd) return void (error = "Nhập nội dung trao đổi.");
        await tx`INSERT INTO binh_luan (id_cong_viec, id_nguoi_dung, noi_dung) VALUES (${id}, ${user.id}, ${nd})`;
        const tags = [...nd.matchAll(/@([a-z0-9._-]+)/gi)].map((m) => m[1].toLowerCase());
        const tagged = tags.length ? (await tx`SELECT id FROM nguoi_dung WHERE ten_dang_nhap IN ${tx(tags)}`).map((r) => r.id as number) : [];
        await notify(tx, tagged, "nhac_ten", `${user.ho_ten} nhắc đến bạn: ${t.ten}`, nd.slice(0, 200), "cong_viec", id, undefined, user.id);
        await notify(tx, [t.id_nguoi_giao, ...owners].filter((x) => !tagged.includes(x)), "binh_luan", `Trao đổi mới: ${t.ten}`, `${user.ho_ten}: ${nd.slice(0, 200)}`, "cong_viec", id, undefined, user.id);
        msg = "Đã gửi.";
        break;
      }
      case "nhac": {
        if (!p.duyet && !p.quan_ly) return void (error = deny.error);
        await notify(tx, owners, "nhac", `${user.ho_ten} nhắc việc: ${t.ten}`, `Hạn ${fmtDue(t.han, t.han_co_gio)}`, "cong_viec", id, undefined, user.id);
        await writeLog(tx, user.id, "nhac_viec", "cong_viec", id);
        msg = "Đã gửi nhắc.";
        break;
      }
      case "checklist_them": {
        if (!p.viec_con) return void (error = deny.error);
        const nd = str(fd, "noi_dung");
        if (!nd) return void (error = "Nhập nội dung bước.");
        await tx`INSERT INTO checklist (id_cong_viec, noi_dung, thu_tu) VALUES (${id}, ${nd}, (SELECT COALESCE(max(thu_tu), 0) + 1 FROM checklist WHERE id_cong_viec = ${id}))`;
        await writeLog(tx, user.id, "checklist_them", "cong_viec", id, null, { noi_dung: nd });
        await recomputePercent(tx, id);
        msg = "Đã thêm.";
        break;
      }
      case "checklist_doi": {
        if (!p.cap_nhat && !p.viec_con) return void (error = deny.error);
        const cid = Number(str(fd, "id_checklist"));
        const r = (await tx`UPDATE checklist SET da_xong = NOT da_xong WHERE id = ${cid} AND id_cong_viec = ${id} RETURNING noi_dung, da_xong`)[0];
        if (r) await writeLog(tx, user.id, "checklist_doi", "cong_viec", id, null, r);
        if (t.trang_thai === "da_nhan") await tx`UPDATE cong_viec SET trang_thai = 'dang_thuc_hien' WHERE id = ${id}`;
        await recomputePercent(tx, id);
        msg = "";
        break;
      }
      case "checklist_xoa": {
        if (!p.viec_con) return void (error = deny.error);
        const cid = Number(str(fd, "id_checklist"));
        const r = (await tx`DELETE FROM checklist WHERE id = ${cid} AND id_cong_viec = ${id} RETURNING noi_dung, da_xong`)[0];
        if (r) await writeLog(tx, user.id, "checklist_xoa", "cong_viec", id, r, null);
        await recomputePercent(tx, id);
        msg = "Đã xóa bước.";
        break;
      }
      case "gan_chi_tieu": {
        if (!p.quan_ly) return void (error = deny.error);
        const k = Number(str(fd, "id_chi_tieu"));
        if (!k) return void (error = "Chọn chỉ tiêu.");
        await tx`INSERT INTO cong_viec_chi_tieu VALUES (${id}, ${k}) ON CONFLICT DO NOTHING`;
        await writeLog(tx, user.id, "gan_chi_tieu", "cong_viec", id, null, { id_chi_tieu: k });
        msg = "Đã gắn chỉ tiêu.";
        break;
      }
      case "them_thanh_vien": {
        if (!p.quan_ly) return void (error = deny.error);
        const uid = Number(str(fd, "id_nguoi"));
        const vt = str(fd, "vai_tro") === "theo_doi" ? "theo_doi" : "phoi_hop";
        if (!uid) return void (error = "Chọn người.");
        await tx`INSERT INTO cong_viec_thanh_vien VALUES (${id}, ${uid}, ${vt}) ON CONFLICT DO NOTHING`;
        await writeLog(tx, user.id, "them_thanh_vien", "cong_viec", id, null, { id_nguoi: uid, vai_tro: vt });
        await notify(tx, [uid], "phoi_hop", `${vt === "phoi_hop" ? "Phối hợp" : "Theo dõi"}: ${t.ten}`, null, "cong_viec", id, undefined, user.id);
        msg = "Đã thêm.";
        break;
      }
      default:
        error = "Thao tác không hợp lệ.";
    }
  });
  if (error) return { error };
  if (redir) return { redirect: redir };
  sendSmsLater();
  return { ok: true, message: msg, reset: ["binh_luan", "checklist_them", "xin_gia_han", "tra_lai"].includes(op) };
}

/** Kéo thả trên bảng Kanban: quy đổi sang thao tác tương ứng */
export async function kanbanMove(id: number, to: string): Promise<{ error?: string; need?: string }> {
  const sql = await db();
  const t = (await sql`SELECT trang_thai FROM cong_viec WHERE id = ${id}`)[0];
  if (!t) return { error: "Không tìm thấy việc." };
  const from = t.trang_thai as string;
  if (from === to) return {};
  let op: string | null = null;
  if (from === "moi_giao" && to === "da_nhan") op = "nhan";
  else if (from === "da_nhan" && to === "dang_thuc_hien") op = "bat_dau";
  else if ((from === "da_nhan" || from === "dang_thuc_hien") && to === "cho_duyet") return { need: "bao_cao" };
  else if (from === "cho_duyet" && to === "hoan_thanh") op = "duyet";
  else if (from === "cho_duyet" && to === "dang_thuc_hien") return { need: "lam_lai" };
  if (!op) return { error: `Không chuyển trực tiếp từ “${TRANG_THAI[from]}” sang “${TRANG_THAI[to]}”.` };
  const f = new FormData();
  f.set("id", String(id));
  f.set("op", op);
  if (op === "duyet") f.set("ket_luan", "dong_y");
  const r = await taskAction(null, f);
  return r?.error ? { error: r.error } : {};
}

export async function markNotificationsRead(ids?: number[]) {
  const user = await getUser();
  if (!user) return;
  const sql = await db();
  if (ids?.length) await sql`UPDATE thong_bao SET da_doc = TRUE WHERE id_nguoi_nhan = ${user.id} AND id IN ${sql(ids)}`;
  else await sql`UPDATE thong_bao SET da_doc = TRUE WHERE id_nguoi_nhan = ${user.id}`;
}

/** Quản trị dữ liệu: xóa nhiều công việc cùng lúc (vào thùng rác, kèm việc con) */
export async function bulkDeleteTasksAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getUser();
  if (!user || !user.quyen.includes("qt.du_lieu")) return { error: "Chỉ quản trị dữ liệu mới xóa được công việc." };
  const ids = [...new Set(fd.getAll("chon").map(Number).filter(Boolean))];
  if (!ids.length) return { error: "Chưa chọn công việc nào." };
  const ly_do = str(fd, "ly_do") || null;
  const sql = await db();
  let n = 0;
  await sql.begin(async (tx) => {
    for (const id of ids) {
      const t = (await tx`SELECT id_cha FROM cong_viec WHERE id = ${id}`)[0];
      if (!t) continue; // đã bị xóa theo việc cha
      await trashTask(tx, id, user.id, ly_do);
      if (t.id_cha && !ids.includes(t.id_cha)) await recomputePercent(tx, t.id_cha);
      n++;
    }
  });
  return { ok: true, message: `Đã xóa ${n} công việc vào Thùng rác.` };
}
