import ExcelJS from "exceljs";
import { getUser } from "@/lib/auth";
import { queryTasks } from "@/lib/taskQuery";
import { styleHeader, toResponse, borderAll } from "@/lib/excel";
import { TRANG_THAI, UU_TIEN } from "@/lib/const";
import { fmtDue, fmtDate } from "@/lib/time";
import { taskStatusText } from "@/lib/reports";

export async function GET(req: Request) {
  const user = await getUser();
  if (!user) return new Response("Chưa đăng nhập", { status: 401 });
  const sp = Object.fromEntries(new URL(req.url).searchParams.entries());
  const tasks = await queryTasks(user, sp, 5000);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Cong viec");
  ws.columns = [
    { header: "STT", key: "stt", width: 6 },
    { header: "Tên công việc", key: "ten", width: 50 },
    { header: "Chủ trì", key: "ct", width: 22 },
    { header: "Đơn vị", key: "dv", width: 24 },
    { header: "Người giao", key: "ng", width: 20 },
    { header: "Lĩnh vực", key: "lv", width: 20 },
    { header: "Nguồn giao", key: "nguon", width: 18 },
    { header: "Ưu tiên", key: "ut", width: 10 },
    { header: "Hạn", key: "han", width: 16 },
    { header: "Trạng thái", key: "tt", width: 16 },
    { header: "Tiến độ", key: "pt", width: 9 },
    { header: "Tình hình", key: "th", width: 30 },
  ];
  styleHeader(ws);
  tasks.forEach((t, i) =>
    ws.addRow({ stt: i + 1, ten: t.ten, ct: t.ten_chu_tri, dv: t.ten_don_vi || "", ng: t.ten_nguoi_giao, lv: t.linh_vuc, nguon: t.nguon_giao, ut: UU_TIEN[t.uu_tien], han: fmtDue(t.han, t.han_co_gio), tt: TRANG_THAI[t.trang_thai], pt: `${t.phan_tram}%`, th: taskStatusText(t) }),
  );
  borderAll(ws, 1);
  ws.views = [{ state: "frozen", ySplit: 1 }];
  return toResponse(wb, `Danh_sach_cong_viec_${fmtDate(new Date()).replace(/\//g, "-")}.xlsx`);
}
