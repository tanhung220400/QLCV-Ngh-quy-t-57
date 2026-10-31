"use client";
import { useState } from "react";
import { NHOM_QUYEN, QUYEN_MAC_DINH, LOAI_PHAM_VI } from "@/lib/quyen";
import { VAI_TRO } from "@/lib/const";

type Opt = { id: number; ten: string };

/** Chọn vai trò, phạm vi dữ liệu và từng quyền chức năng cho một tài khoản */
export function PermissionEditor({
  vaiTro,
  quyen,
  phamVi,
  units,
  linhVuc,
}: {
  vaiTro: string;
  quyen: string[] | null; // null = theo mặc định của vai trò
  phamVi: { loai: string; linh_vuc: string[]; don_vi: number[] } | null;
  units: Opt[];
  linhVuc: string[];
}) {
  const [role, setRole] = useState(vaiTro || "cong_chuc");
  const [sel, setSel] = useState<string[]>(quyen ?? QUYEN_MAC_DINH[vaiTro || "cong_chuc"] ?? []);
  const [pv, setPv] = useState(phamVi?.loai ?? "mac_dinh");
  const [pvLv, setPvLv] = useState<string[]>(phamVi?.linh_vuc ?? []);
  const [pvDv, setPvDv] = useState<number[]>(phamVi?.don_vi ?? []);
  const def = new Set(QUYEN_MAC_DINH[role] || []);
  const changed = sel.length !== def.size || sel.some((q) => !def.has(q));

  return (
    <div className="space-y-4 sm:col-span-2">
      <input type="hidden" name="co_phan_quyen" value="1" />
      <div>
        <label className="label">Vai trò (bộ quyền mặc định)</label>
        <select
          name="vai_tro"
          className="input"
          value={role}
          onChange={(e) => {
            setRole(e.target.value);
            setSel(QUYEN_MAC_DINH[e.target.value] || []);
            setPv("mac_dinh");
          }}
        >
          {Object.entries(VAI_TRO).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="rounded-xl border border-slate-200 p-3">
        <legend className="px-1 font-semibold">Phạm vi dữ liệu được xem</legend>
        <p className="mb-2 text-sm text-slate-500">Áp dụng cho công việc, chỉ tiêu và báo cáo. Ai cũng luôn xem được việc mình giao, chủ trì, thực hiện hoặc phối hợp.</p>
        <select name="pham_vi" className="input" value={pv} onChange={(e) => setPv(e.target.value)}>
          <option value="mac_dinh">Theo chức vụ, đơn vị (mặc định)</option>
          {Object.entries(LOAI_PHAM_VI).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        {pv === "linh_vuc" && (
          <div className="mt-2 flex flex-wrap gap-2">
            {linhVuc.map((l) => (
              <label key={l} className="chip cursor-pointer border-slate-300 bg-white py-1">
                <input
                  type="checkbox"
                  name="pv_linh_vuc"
                  value={l}
                  checked={pvLv.includes(l)}
                  onChange={(e) => setPvLv((s) => (e.target.checked ? [...s, l] : s.filter((x) => x !== l)))}
                  className="mr-1.5"
                />
                {l}
              </label>
            ))}
            <p className="w-full text-sm text-slate-500">Không chọn lĩnh vực nào thì dùng “Lĩnh vực phụ trách” của cán bộ.</p>
          </div>
        )}
        {pv === "don_vi" && (
          <div className="mt-2 flex flex-wrap gap-2">
            {units.map((u) => (
              <label key={u.id} className="chip cursor-pointer border-slate-300 bg-white py-1">
                <input
                  type="checkbox"
                  name="pv_don_vi"
                  value={u.id}
                  checked={pvDv.includes(u.id)}
                  onChange={(e) => setPvDv((s) => (e.target.checked ? [...s, u.id] : s.filter((x) => x !== u.id)))}
                  className="mr-1.5"
                />
                {u.ten}
              </label>
            ))}
            <p className="w-full text-sm text-slate-500">Không chọn đơn vị nào thì dùng đơn vị của cán bộ. Đơn vị con (khu phố) được xem kèm.</p>
          </div>
        )}
      </fieldset>

      <fieldset className="rounded-xl border border-slate-200 p-3">
        <legend className="px-1 font-semibold">Quyền chức năng</legend>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className={changed ? "font-semibold text-amber-700" : "text-slate-500"}>{changed ? "Đã điều chỉnh so với mặc định của vai trò" : "Đang theo mặc định của vai trò"}</span>
          {changed && (
            <button type="button" onClick={() => setSel(QUYEN_MAC_DINH[role] || [])} className="text-brand-700 underline">
              Về mặc định
            </button>
          )}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {NHOM_QUYEN.map((g) => (
            <div key={g.nhom}>
              <div className="mb-1 font-semibold text-slate-700">{g.nhom}</div>
              {g.quyen.map(([k, label]) => (
                <label key={k} className="flex items-start gap-2 py-1">
                  <input
                    type="checkbox"
                    name="quyen"
                    value={k}
                    checked={sel.includes(k)}
                    onChange={(e) => setSel((s) => (e.target.checked ? [...s, k] : s.filter((x) => x !== k)))}
                    className="mt-1 h-5 w-5 shrink-0"
                  />
                  <span>
                    {label}
                    {def.has(k) !== sel.includes(k) && <span className="ml-1 text-xs font-semibold text-amber-700">(đã đổi)</span>}
                  </span>
                </label>
              ))}
            </div>
          ))}
        </div>
        <p className="mt-2 text-sm text-slate-500">Các thao tác trên việc của chính mình (nhận việc, cập nhật tiến độ, báo cáo, xin gia hạn, bình luận) luôn được phép.</p>
      </fieldset>
    </div>
  );
}
