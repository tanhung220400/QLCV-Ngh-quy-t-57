import { ActionForm, Submit } from "./ActionForm";
import { GpsInput } from "./GpsInput";
import { saveRecordAction } from "@/app/actions/modules";
import type { Truong } from "@/lib/modules";
import type { Lookups } from "@/lib/records";

function Field({ f, v, lk }: { f: Truong; v: unknown; lk: Lookups }) {
  const name = `f_${f.khoa}`;
  const s = v === null || v === undefined ? "" : String(v);
  const common = { name, id: name, required: f.bat_buoc && f.kieu !== "nhieu_lua_chon" && f.kieu !== "co_khong", placeholder: f.goi_y || undefined };
  switch (f.kieu) {
    case "doan_van":
      return <textarea {...common} className="input" rows={3} defaultValue={s} />;
    case "so":
      return <input {...common} className="input" inputMode="decimal" defaultValue={typeof v === "number" ? String(v).replace(".", ",") : s} />;
    case "ngay":
      return <input {...common} type="date" className="input" defaultValue={s.slice(0, 10)} />;
    case "so_dien_thoai":
      return <input {...common} type="tel" className="input" defaultValue={s} />;
    case "email":
      return <input {...common} type="email" className="input" defaultValue={s} />;
    case "lien_ket":
      return <input {...common} className="input" defaultValue={s} placeholder={f.goi_y || "https://..."} />;
    case "toa_do":
      return <GpsInput name={name} defaultValue={s} />;
    case "co_khong":
      return (
        <label className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 px-3">
          <input type="checkbox" name={name} value="1" defaultChecked={v === true} className="h-5 w-5 accent-brand-600" />
          <span>Có</span>
        </label>
      );
    case "lua_chon":
      return (
        <select {...common} className="input" defaultValue={s}>
          <option value="">— Chọn —</option>
          {f.tuy_chon.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      );
    case "nhieu_lua_chon": {
      const arr = Array.isArray(v) ? (v as string[]) : [];
      return (
        <div className="flex flex-wrap gap-2">
          {f.tuy_chon.map((o) => (
            <label key={o} className="flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50 has-[:checked]:text-brand-700">
              <input type="checkbox" name={name} value={o} defaultChecked={arr.includes(o)} className="accent-brand-600" />
              {o}
            </label>
          ))}
        </div>
      );
    }
    case "don_vi":
      return (
        <select {...common} className="input" defaultValue={s}>
          <option value="">— Chọn —</option>
          {lk.units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.ten}
            </option>
          ))}
        </select>
      );
    case "nguoi":
      return (
        <select {...common} className="input" defaultValue={s}>
          <option value="">— Chọn —</option>
          {lk.people.map((u) => (
            <option key={u.id} value={u.id}>
              {u.ho_ten}
              {u.don_vi ? ` — ${u.don_vi}` : ""}
            </option>
          ))}
        </select>
      );
    case "linh_vuc":
      return (
        <select {...common} className="input" defaultValue={s}>
          <option value="">— Chọn —</option>
          {lk.linhVuc.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      );
    default:
      return <input {...common} className="input" defaultValue={s} />;
  }
}

export function RecordForm({ ma, fields, lk, id, data }: { ma: string; fields: Truong[]; lk: Lookups; id?: number; data?: Record<string, unknown> }) {
  const wide = (f: Truong) => ["doan_van", "nhieu_lua_chon"].includes(f.kieu);
  return (
    <ActionForm action={saveRecordAction} className="space-y-4">
      <input type="hidden" name="ma" value={ma} />
      {id && <input type="hidden" name="id" value={id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.id} className={wide(f) ? "sm:col-span-2" : ""}>
            <label htmlFor={`f_${f.khoa}`} className={`label ${f.bat_buoc ? "req" : ""}`}>
              {f.ten}
            </label>
            <Field f={f} v={data?.[f.khoa]} lk={lk} />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
        <Submit>{id ? "Lưu thay đổi" : "Lưu"}</Submit>
        {!id && (
          <Submit name="tiep" value="1" className="btn btn-outline">
            Lưu và nhập tiếp
          </Submit>
        )}
      </div>
    </ActionForm>
  );
}
