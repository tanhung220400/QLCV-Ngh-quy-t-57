import { ActionForm, Submit } from "./ActionForm";
import { saveKpiAction } from "@/app/actions/kpi";
import { LOAI_CHI_TIEU, KY_CAP_NHAT } from "@/lib/const";

type Opt = { id: number; ten: string };
type K = Record<string, unknown>;

export function KpiForm({
  k,
  parent,
  units,
  people,
  leaders,
  nhom,
  nguon,
  dvt,
}: {
  k?: K;
  parent?: K;
  units: Opt[];
  people: Opt[];
  leaders: Opt[];
  nhom: string[];
  nguon: string[];
  dvt: string[];
}) {
  const base = k || parent || {};
  const year = (base.nam as number) || new Date().getFullYear();
  const han = k?.han ? String(k.han instanceof Date ? k.han.toISOString() : k.han).slice(0, 10) : `${year}-12-31`;
  const g = (f: string, d: string | number = "") => (base[f] ?? d) as string | number;
  return (
    <ActionForm action={saveKpiAction} className="space-y-4">
      {k && <input type="hidden" name="id" value={String(k.id)} />}
      {!!(parent || k?.id_cha) && <input type="hidden" name="id_cha" value={String(parent?.id ?? k?.id_cha)} />}
      <div>
        <label className="label req">Tên chỉ tiêu</label>
        <input name="ten" className="input" defaultValue={k ? String(k.ten) : parent ? `${parent.ten} - ` : ""} required />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="label req">Nguồn</label>
          <input name="nguon" list="ds-nguon-ct" className="input" defaultValue={g("nguon", nguon[0])} required />
          <datalist id="ds-nguon-ct">
            {nguon.map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="label req">Nhóm</label>
          <select name="nhom" className="input" defaultValue={g("nhom", nhom[0])}>
            {nhom.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label req">Đơn vị tính</label>
          <input name="don_vi_tinh" list="ds-dvt" className="input" defaultValue={g("don_vi_tinh")} required />
          <datalist id="ds-dvt">
            {dvt.map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="label req">Loại</label>
          <select name="loai" className="input" defaultValue={g("loai", "cong_don")}>
            {Object.entries(LOAI_CHI_TIEU).map(([a, b]) => (
              <option key={a} value={a}>
                {b}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label req">Chiều tốt</label>
          <select name="chieu_tot" className="input" defaultValue={g("chieu_tot", "cao")}>
            <option value="cao">Càng cao càng tốt</option>
            <option value="thap">Càng thấp càng tốt (ví dụ tỷ lệ hộ nghèo)</option>
          </select>
        </div>
        <div>
          <label className="label req">Kế hoạch năm</label>
          <input name="ke_hoach_nam" inputMode="decimal" className="input" defaultValue={k ? String(k.ke_hoach_nam) : ""} required />
          <p className="mt-1 text-sm text-slate-500">Loại đạt/không đạt: để 1.</p>
        </div>
        <div>
          <label className="label">Giá trị đầu năm</label>
          <input name="gia_tri_dau_nam" inputMode="decimal" className="input" defaultValue={k?.gia_tri_dau_nam != null ? String(k.gia_tri_dau_nam) : ""} />
          <p className="mt-1 text-sm text-slate-500">Dùng tính mức giảm cho chỉ tiêu càng thấp càng tốt.</p>
        </div>
        <div>
          <label className="label req">Năm</label>
          <input name="nam" type="number" className="input" defaultValue={year} required />
        </div>
        <div>
          <label className="label req">Ngày hết hạn</label>
          <input name="han" type="date" className="input" defaultValue={han} required />
        </div>
        <div>
          <label className="label">Đơn vị phụ trách</label>
          <select name="id_don_vi_phu_trach" className="input" defaultValue={k ? String(k.id_don_vi_phu_trach ?? "") : ""}>
            <option value="">—</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.ten}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Cá nhân phụ trách</label>
          <select name="id_phu_trach" className="input" defaultValue={k ? String(k.id_phu_trach ?? "") : ""}>
            <option value="">— trưởng đơn vị —</option>
            {people.map((u) => (
              <option key={u.id} value={u.id}>
                {u.ten}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Lãnh đạo phụ trách</label>
          <select name="id_lanh_dao" className="input" defaultValue={String(g("id_lanh_dao", ""))}>
            <option value="">—</option>
            {leaders.map((u) => (
              <option key={u.id} value={u.id}>
                {u.ten}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Kỳ cập nhật</label>
          <select name="ky_cap_nhat" className="input" defaultValue={g("ky_cap_nhat", "thang")}>
            {Object.entries(KY_CAP_NHAT).map(([a, b]) => (
              <option key={a} value={a}>
                {b}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Ngày chốt số liệu hằng kỳ</label>
          <input name="ngay_chot" type="number" min={1} max={28} className="input" defaultValue={g("ngay_chot", 25)} />
        </div>
      </div>
      <Submit>{k ? "Lưu chỉ tiêu" : parent ? "Thêm phần phân rã" : "Thêm chỉ tiêu"}</Submit>
    </ActionForm>
  );
}
