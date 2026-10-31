import Link from "next/link";
import { ActionForm, Submit } from "./ActionForm";
import { Icon, BIEU_TUONG } from "./Icon";
import { Tile } from "./Nav";
import { saveModuleAction, templateModuleAction, moveModuleAction, toggleModuleAction, saveFieldAction, fieldOpAction } from "@/app/actions/modules";
import { MAU_MODULE, MAU_MODULE_NQ57, KIEU_TRUONG, moduleHref, type MoDun, type Truong } from "@/lib/modules";
import { VAI_TRO } from "@/lib/const";

const LOAI_MD: Record<string, string> = { nhom: "Nhóm menu", du_lieu: "Module nhập liệu", lien_ket: "Liên kết", he_thong: "Chức năng hệ thống" };

type Row = MoDun & { so_ban_ghi: number };

function parentOptions(all: MoDun[], self?: number) {
  // chỉ nhóm hoặc module nhập liệu mới chứa được module con; loại bỏ chính nó và con cháu
  const banned = new Set<number>();
  if (self) {
    banned.add(self);
    for (let changed = true; changed; ) {
      changed = false;
      for (const m of all) if (m.id_cha && banned.has(m.id_cha) && !banned.has(m.id)) (banned.add(m.id), (changed = true));
    }
  }
  return all.filter((m) => (m.loai === "nhom" || m.loai === "du_lieu") && !banned.has(m.id));
}

export function ModuleForm({ m, all }: { m?: MoDun; all: MoDun[] }) {
  const sys = m?.loai === "he_thong";
  return (
    <ActionForm key={m?.id ?? "moi"} action={saveModuleAction} className="space-y-3">
      {m && <input type="hidden" name="id" value={m.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label req">Tên module</label>
          <input name="ten" className="input" defaultValue={m?.ten} required placeholder="VD: Hộ kinh doanh cá thể" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Mô tả ngắn</label>
          <input name="mo_ta" className="input" defaultValue={m?.mo_ta || ""} />
        </div>
        <div>
          <label className="label">Loại</label>
          {sys ? (
            <div className="input bg-slate-50 text-slate-500">Chức năng hệ thống ({m?.duong_dan})</div>
          ) : (
            <select name="loai" className="input" defaultValue={m?.loai || "du_lieu"}>
              <option value="du_lieu">Module nhập liệu (có biểu mẫu, danh sách)</option>
              <option value="nhom">Nhóm menu (chứa các module con)</option>
              <option value="lien_ket">Liên kết tới trang khác</option>
            </select>
          )}
        </div>
        <div>
          <label className="label">Nằm trong</label>
          <select name="id_cha" className="input" defaultValue={m?.id_cha ?? ""}>
            <option value="">— Cấp cao nhất —</option>
            {parentOptions(all, m?.id).map((p) => (
              <option key={p.id} value={p.id}>
                {p.ten} ({LOAI_MD[p.loai]})
              </option>
            ))}
          </select>
        </div>
        {!sys && (
          <div className="sm:col-span-2">
            <label className="label">Đường dẫn (chỉ với loại Liên kết)</label>
            <input name="duong_dan" className="input" defaultValue={m?.loai === "lien_ket" ? m.duong_dan || "" : ""} placeholder="https://dichvucong.gov.vn hoặc /bao-cao" />
          </div>
        )}
        <div>
          <label className="label">Biểu tượng</label>
          <select name="bieu_tuong" className="input" defaultValue={m?.bieu_tuong || "folder"}>
            {BIEU_TUONG.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Màu</label>
          <select name="mau" className="input" defaultValue={m?.mau || "blue"}>
            {Object.entries(MAU_MODULE).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
        {m?.loai !== "nhom" && m?.loai !== "he_thong" && (
          <div>
            <label className="label">Phạm vi dữ liệu</label>
            <select name="pham_vi" className="input" defaultValue={m?.pham_vi || "toan_xa"}>
              <option value="toan_xa">Mọi người được xem toàn bộ dữ liệu</option>
              <option value="don_vi">Chỉ xem dữ liệu của đơn vị mình</option>
            </select>
          </div>
        )}
        <div>
          <label className="label">Hiển thị</label>
          <select name="hien" className="input" defaultValue={m?.hien === false ? "0" : "1"}>
            <option value="1">Hiện trên menu</option>
            <option value="0">Ẩn</option>
          </select>
        </div>
      </div>
      <details className="rounded-xl border border-slate-200 p-3">
        <summary className="cursor-pointer font-semibold">Ai được xem, ai được nhập liệu</summary>
        <p className="mt-1 text-sm text-slate-500">Không chọn vai trò nào = tất cả mọi người. Quản trị luôn có toàn quyền.</p>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {(["vai_tro_xem", "vai_tro_nhap"] as const).map((k) => (
            <div key={k}>
              <div className="label">{k === "vai_tro_xem" ? "Được xem" : "Được thêm, sửa dữ liệu"}</div>
              {Object.entries(VAI_TRO).map(([v, l]) => (
                <label key={v} className="flex items-center gap-2 py-0.5">
                  <input type="checkbox" name={k} value={v} defaultChecked={m?.[k]?.includes(v)} className="accent-brand-600" />
                  {l}
                </label>
              ))}
            </div>
          ))}
        </div>
      </details>
      <Submit>{m ? "Lưu module" : "Tạo module"}</Submit>
    </ActionForm>
  );
}

export function TemplateForm({ all }: { all: MoDun[] }) {
  return (
    <ActionForm action={templateModuleAction} className="space-y-3">
      <div>
        <label className="label">Mẫu</label>
        <select name="mau" className="input" required>
          {MAU_MODULE_NQ57.map((t) => (
            <option key={t.ma} value={t.ma}>
              {t.ten}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Nằm trong</label>
        <select name="id_cha" className="input">
          <option value="">— Cấp cao nhất —</option>
          {parentOptions(all).map((p) => (
            <option key={p.id} value={p.id}>
              {p.ten}
            </option>
          ))}
        </select>
      </div>
      <Submit className="btn btn-outline">Tạo từ mẫu</Submit>
    </ActionForm>
  );
}

function Small({ action, id, name, value, title, icon, extra }: { action: typeof moveModuleAction; id: number; name: string; value: string; title: string; icon: string; extra?: string }) {
  return (
    <ActionForm action={action} className="inline">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name={name} value={value} />
      <button title={title} aria-label={title} className={`rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 ${extra || ""}`}>
        <Icon name={icon} className="h-[18px] w-[18px]" />
      </button>
    </ActionForm>
  );
}

export function ModuleTree({ rows }: { rows: Row[] }) {
  const kids = (id: number | null) => rows.filter((r) => (r.id_cha ?? null) === id);
  const orphan = rows.filter((r) => r.id_cha && !rows.some((p) => p.id === r.id_cha));
  const render = (r: Row, depth: number): React.ReactNode => (
    <div key={r.id}>
      <div className={`flex items-center gap-2 border-b border-slate-100 py-2 ${r.hien ? "" : "opacity-55"}`} style={{ paddingLeft: depth * 22 }}>
        <Tile icon={r.bieu_tuong} mau={r.mau} />
        <div className="min-w-0 flex-1">
          <Link href={`/quan-tri/mo-dun/${r.id}`} className="font-semibold text-slate-900 hover:text-brand-700">
            {r.ten}
          </Link>
          <div className="flex flex-wrap gap-x-2 text-sm text-slate-500">
            <span>{LOAI_MD[r.loai]}</span>
            {r.loai === "du_lieu" && <span>· {r.so_ban_ghi} bản ghi</span>}
            {!r.hien && <span className="text-amber-700">· Đang ẩn</span>}
            {(r.vai_tro_xem.length > 0 || r.vai_tro_nhap.length > 0) && <span>· Giới hạn vai trò</span>}
          </div>
        </div>
        <div className="flex shrink-0 items-center">
          <Small action={moveModuleAction} id={r.id} name="dir" value="len" title="Lên" icon="up" />
          <Small action={moveModuleAction} id={r.id} name="dir" value="xuong" title="Xuống" icon="down" />
          <Small action={toggleModuleAction} id={r.id} name="x" value="1" title={r.hien ? "Ẩn khỏi menu" : "Hiện trên menu"} icon={r.hien ? "eye" : "eyeoff"} />
          <Link href={moduleHref(r)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" title="Mở">
            <Icon name="chevron" className="h-[18px] w-[18px]" />
          </Link>
        </div>
      </div>
      {kids(r.id).map((c) => render(c, depth + 1))}
    </div>
  );
  return (
    <div>
      {kids(null).map((r) => render(r, 0))}
      {orphan.map((r) => render(r, 0))}
    </div>
  );
}

export function FieldList({ fields, idMoDun }: { fields: Truong[]; idMoDun: number }) {
  return (
    <div className="divide-y divide-slate-100">
      {fields.map((f) => (
        <details key={f.id} className="py-2">
          <summary className="flex cursor-pointer list-none items-center gap-2">
            <span className="min-w-0 flex-1">
              <span className="font-semibold">{f.ten}</span>
              {f.bat_buoc && <span className="ml-1 text-red-600">*</span>}
              <span className="ml-2 text-sm text-slate-500">
                {KIEU_TRUONG[f.kieu]}
                {f.hien_danh_sach ? " · hiện ở danh sách" : ""}
              </span>
            </span>
            <span className="flex items-center" onClick={undefined}>
              <FieldOp id={f.id} op="len" icon="up" title="Lên" />
              <FieldOp id={f.id} op="xuong" icon="down" title="Xuống" />
              <Icon name="edit" className="ml-1 h-[18px] w-[18px] text-slate-400" />
            </span>
          </summary>
          <div className="mt-2 rounded-xl bg-slate-50 p-3">
            <FieldForm f={f} idMoDun={idMoDun} />
            <ActionForm action={fieldOpAction} confirm={`Xóa trường “${f.ten}”?`} className="mt-2">
              <input type="hidden" name="id" value={f.id} />
              <input type="hidden" name="op" value="xoa" />
              <button className="btn btn-danger-soft btn-sm">
                <Icon name="trash" className="h-4 w-4" /> Xóa trường
              </button>
            </ActionForm>
          </div>
        </details>
      ))}
      {!fields.length && <p className="py-4 text-slate-500">Chưa có trường nào.</p>}
    </div>
  );
}

function FieldOp({ id, op, icon, title }: { id: number; op: string; icon: string; title: string }) {
  return (
    <ActionForm action={fieldOpAction} className="inline">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="op" value={op} />
      <button title={title} aria-label={title} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200">
        <Icon name={icon} className="h-[18px] w-[18px]" />
      </button>
    </ActionForm>
  );
}

export function FieldForm({ f, idMoDun }: { f?: Truong; idMoDun: number }) {
  return (
    <ActionForm action={saveFieldAction} className="space-y-3">
      <input type="hidden" name="id_mo_dun" value={idMoDun} />
      {f && <input type="hidden" name="id" value={f.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label req">Tên trường</label>
          <input name="ten" className="input" defaultValue={f?.ten} required placeholder="VD: Số hộ tham gia" />
        </div>
        <div>
          <label className="label">Kiểu dữ liệu</label>
          <select name="kieu" className="input" defaultValue={f?.kieu || "van_ban"}>
            {Object.entries(KIEU_TRUONG).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label">Các lựa chọn (với kiểu “Chọn…”, mỗi dòng một lựa chọn)</label>
          <textarea name="tuy_chon" rows={3} className="input" defaultValue={f?.tuy_chon.join("\n")} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Gợi ý nhập</label>
          <input name="goi_y" className="input" defaultValue={f?.goi_y || ""} />
        </div>
      </div>
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="bat_buoc" value="1" defaultChecked={f?.bat_buoc} className="h-5 w-5 accent-brand-600" /> Bắt buộc nhập
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="hien_danh_sach" value="1" defaultChecked={f ? f.hien_danh_sach : true} className="h-5 w-5 accent-brand-600" /> Hiện ở bảng danh sách
        </label>
      </div>
      <Submit className="btn btn-primary btn-sm">{f ? "Lưu trường" : "Thêm trường"}</Submit>
    </ActionForm>
  );
}
