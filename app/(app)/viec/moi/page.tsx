import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { canCreateTask } from "@/lib/perm";
import { taskFormOptions } from "@/lib/options";
import { TaskForm } from "@/components/TaskForm";

export const dynamic = "force-dynamic";

export default async function NewTaskPage() {
  const user = await requireUser();
  if (!canCreateTask(user)) redirect("/viec");
  const o = await taskFormOptions(user);
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="h1">Giao việc</h1>
        {user.quyen.includes("cv.nhap_nhanh") && (
          <Link href="/viec/nhap-nhanh" className="btn btn-outline btn-sm">
            Nhập nhiều việc từ kết luận họp
          </Link>
        )}
      </div>
      <div className="card">
        <TaskForm
          units={o.units}
          people={o.people}
          allPeople={o.allPeople}
          linhVuc={o.linhVuc}
          nguon={o.nguon}
          sanPham={o.sanPham}
          kpis={o.kpis}
          leaders={o.leaders}
          showGiao={user.vai_tro === "tong_hop"}
        />
      </div>
    </div>
  );
}
