import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { taskFormOptions } from "@/lib/options";
import { BulkImport } from "@/components/BulkImport";
import { addWorkingDays, vnDate } from "@/lib/time";
import { getHolidays } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function BulkPage() {
  const user = await requireUser();
  if (!user.quyen.includes("cv.nhap_nhanh")) redirect("/viec");
  const o = await taskFormOptions(user);
  const due = addWorkingDays(vnDate(), 10, await getHolidays());
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <h1 className="h1">Giao việc nhanh từ kết luận họp</h1>
      <BulkImport units={o.units} people={o.people} linhVuc={o.linhVuc} leaders={o.leaders} showGiao={user.vai_tro === "tong_hop"} defaultDue={due} />
    </div>
  );
}
