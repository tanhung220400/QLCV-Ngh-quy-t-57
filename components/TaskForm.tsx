"use client";
import { useMemo, useState } from "react";
import { ActionForm, Submit } from "./ActionForm";
import { createTaskAction } from "@/app/actions/task";
import { coTheTheoDoi } from "@/lib/theoDoi";

type Opt = { id: number; ten: string; don_vi?: string | null; id_don_vi?: number | null; chuc_vu?: string | null };

export function TaskForm({
  units,
  people,
  allPeople,
  linhVuc,
  nguon,
  sanPham,
  kpis,
  leaders,
  showGiao,
  idCha,
  defaults,
  compact,
}: {
  units: Opt[];
  people: Opt[];
  /** toàn bộ cán bộ (để chọn người theo dõi là Phó Chủ tịch, người đứng đầu đơn vị) */
  allPeople?: Opt[];
  linhVuc: string[];
  nguon: string[];
  sanPham: string[];
  kpis: Opt[];
  leaders: Opt[];
  showGiao: boolean;
  idCha?: number;
  defaults?: { linh_vuc?: string; nguon_giao?: string; han?: string };
  compact?: boolean;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [ganCT, setGanCT] = useState(false);
  const [phoiHop, setPhoiHop] = useState<string[]>([]);
  const [theoDoi, setTheoDoi] = useState<string[]>([]);
  const dsTheoDoi = useMemo(() => (allPeople || people).filter((p) => coTheTheoDoi(p.chuc_vu)), [allPeople, people]);
  const dsPhoiHop = useMemo(() => people.filter((p) => !coTheTheoDoi(p.chuc_vu)), [people]);
  const chon = (e: React.ChangeEvent<HTMLSelectElement>) => [...e.target.selectedOptions].map((o) => o.value);
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<"nguoi" | "don_vi">("don_vi");
  const list = useMemo(() => {
    const src = mode === "don_vi" ? units.map((u) => ({ key: `d:${u.id}`, label: u.ten, sub: "" })) : people.map((p) => ({ key: `u:${p.id}`, label: p.ten, sub: [p.chuc_vu, p.don_vi].filter(Boolean).join(" · ") }));
    const n = q.trim().toLowerCase();
    return n ? src.filter((x) => (x.label + " " + x.sub).toLowerCase().includes(n)) : src;
  }, [mode, q, units, people]);
  const labelOf = (k: string) => (k.startsWith("d:") ? units.find((u) => `d:${u.id}` === k)?.ten : people.find((p) => `u:${p.id}` === k)?.ten) || k;
  const toggle = (k: string) => setSelected((s) => (s.includes(k) ? s.filter((x) => x !== k) : idCha ? [k] : [...s, k]));

  return (
    <ActionForm action={createTaskAction} className="space-y-4">
      {idCha && <input type="hidden" name="id_cha" value={idCha} />}
      {selected.map((s) => (
        <input key={s} type="hidden" name="chu_tri" value={s} />
      ))}
      <div>
        <label className="label req" htmlFor="ten">
          Tên công việc
        </label>
        <input id="ten" name="ten" className="input text-lg" placeholder="Bắt đầu bằng động từ, ví dụ: Rà soát danh sách hộ nghèo..." required autoFocus={!compact} />
      </div>

      <div>
        <div className="label req">Người / đơn vị chủ trì</div>
        {selected.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {selected.map((s) => (
              <button type="button" key={s} onClick={() => toggle(s)} className="chip border-brand-600 bg-brand-600 py-1 text-white">
                {labelOf(s)} ✕
              </button>
            ))}
          </div>
        )}
        <div className="rounded-xl border border-slate-300 bg-white">
          <div className="flex border-b border-slate-200">
            {(["don_vi", "nguoi"] as const).map((m) => (
              <button type="button" key={m} onClick={() => setMode(m)} className={`flex-1 py-2 font-medium ${mode === m ? "bg-slate-800 text-white" : "text-slate-700"} ${m === "don_vi" ? "rounded-tl-xl" : "rounded-tr-xl"}`}>
                {m === "don_vi" ? "Đơn vị" : "Cá nhân"}
              </button>
            ))}
          </div>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm..." className="w-full border-b border-slate-200 px-3 py-2 outline-none" />
          <div className="max-h-56 overflow-y-auto">
            {list.map((x) => (
              <label key={x.key} className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-slate-50">
                <input type="checkbox" checked={selected.includes(x.key)} onChange={() => toggle(x.key)} className="h-5 w-5" />
                <span>
                  {x.label}
                  {x.sub && <span className="block text-sm text-slate-500">{x.sub}</span>}
                </span>
              </label>
            ))}
            {list.length === 0 && <div className="px-3 py-2 text-slate-500">Không tìm thấy.</div>}
          </div>
        </div>
        {!idCha && <p className="mt-1 text-sm text-slate-500">Chọn nhiều đơn vị thì mỗi đơn vị nhận một việc riêng để theo dõi. Giao cho đơn vị thì trưởng đơn vị là người chủ trì.</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label req">Hạn hoàn thành</label>
          <div className="flex gap-2">
            <input type="date" name="han_ngay" defaultValue={defaults?.han} className="input" required />
            <input type="time" name="han_gio" className="input w-32" aria-label="Giờ (không bắt buộc)" />
          </div>
          <p className="mt-1 text-sm text-slate-500">Giờ không bắt buộc.</p>
        </div>
        <div>
          <label className="label req">Sản phẩm đầu ra</label>
          <input name="san_pham" list="ds-san-pham" className="input" placeholder="Báo cáo, tờ trình, biên bản..." required />
          <datalist id="ds-san-pham">
            {sanPham.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
        {!idCha && (
          <>
            <div>
              <label className="label req">Nguồn giao</label>
              <select name="nguon_giao" className="input" defaultValue={defaults?.nguon_giao || nguon[0]} required>
                {nguon.map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label req">Lĩnh vực</label>
              <select name="linh_vuc" className="input" defaultValue={defaults?.linh_vuc || ""} required>
                <option value="" disabled>
                  Chọn lĩnh vực
                </option>
                {linhVuc.map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </div>
          </>
        )}
        <div>
          <span className="label req">Mức độ ưu tiên</span>
          <div className="flex gap-2">
            {[
              ["thuong", "Thường", "peer-checked:bg-slate-800"],
              ["khan", "Khẩn", "peer-checked:bg-orange-500"],
              ["hoa_toc", "Hỏa tốc", "peer-checked:bg-red-600"],
            ].map(([v, l, c]) => (
              <label key={v} className="flex-1">
                <input type="radio" name="uu_tien" value={v} defaultChecked={v === "thuong"} className="peer sr-only" />
                <span className={`block cursor-pointer rounded-xl border border-slate-300 py-2 text-center font-semibold peer-checked:text-white ${c}`}>{l}</span>
              </label>
            ))}
          </div>
        </div>
        {showGiao && !idCha && (
          <div>
            <label className="label">Người giao việc</label>
            <select name="nguoi_giao" className="input" defaultValue="">
              <option value="">Tôi (người nhập)</option>
              {leaders.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.ten}
                  {l.chuc_vu ? ` — ${l.chuc_vu}` : ""}
                </option>
              ))}
            </select>
            <p className="mt-1 text-sm text-slate-500">Văn phòng nhập thay lãnh đạo từ kết luận họp.</p>
          </div>
        )}
      </div>

      <details className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <summary className="cursor-pointer font-semibold">Thêm chi tiết (không bắt buộc)</summary>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Mô tả, yêu cầu</label>
            <textarea name="mo_ta" rows={3} className="input" />
          </div>
          {!idCha && (
            <>
              <div>
                <label className="label">Số hiệu văn bản của tỉnh</label>
                <input name="so_hieu_vb" className="input" placeholder="Ví dụ: 125/UBND-TNMT" />
              </div>
              <div>
                <label className="label">Tên cuộc họp (nếu từ kết luận họp)</label>
                <input name="cuoc_hop" className="input" />
              </div>
            </>
          )}
          <div>
            <label className="label">Người theo dõi</label>
            <select name="theo_doi" multiple className="input h-32" value={theoDoi} onChange={(e) => setTheoDoi(chon(e))}>
              {dsTheoDoi.map((p) => (
                <option key={p.id} value={p.id} disabled={phoiHop.includes(String(p.id))}>
                  {p.ten}
                  {p.chuc_vu ? ` — ${p.chuc_vu}` : ""}
                  {p.don_vi ? `, ${p.don_vi}` : ""}
                </option>
              ))}
            </select>
            <p className="mt-1 text-sm text-slate-500">Phó Chủ tịch hoặc người đứng đầu đơn vị. Giữ Ctrl (máy tính) để chọn nhiều.</p>
          </div>
          <div>
            <label className="label">Người phối hợp</label>
            <select name="phoi_hop" multiple className="input h-32" value={phoiHop} onChange={(e) => setPhoiHop(chon(e))}>
              {dsPhoiHop.map((p) => (
                <option key={p.id} value={p.id} disabled={theoDoi.includes(String(p.id))}>
                  {p.ten}
                  {p.chuc_vu ? ` — ${p.chuc_vu}` : ""}
                  {p.don_vi ? `, ${p.don_vi}` : ""}
                </option>
              ))}
            </select>
            <p className="mt-1 text-sm text-slate-500">Cấp phó, cán bộ (không trùng với người theo dõi).</p>
          </div>
          <div>
            <label className="label">Lặp lại định kỳ</label>
            <select name="dinh_ky" className="input" defaultValue="">
              <option value="">Không lặp</option>
              <option value="tuan">Hằng tuần</option>
              <option value="thang">Hằng tháng</option>
              <option value="quy">Hằng quý</option>
            </select>
          </div>
          {!idCha && (
            <div>
              <span className="label">Gắn với chỉ tiêu</span>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2">
                  <input type="radio" name="gan_ct" value="0" checked={!ganCT} onChange={() => setGanCT(false)} className="h-5 w-5" /> Không gắn
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="gan_ct" value="1" checked={ganCT} onChange={() => setGanCT(true)} className="h-5 w-5" /> Gắn với chỉ tiêu
                </label>
              </div>
              {ganCT &&
                (kpis.length ? (
                  <select name="chi_tieu" multiple className="input mt-2 h-32">
                    {kpis.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.ten}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">Chưa có chỉ tiêu nào để gắn.</p>
                ))}
            </div>
          )}
          <div className="sm:col-span-2">
            <label className="label">Các bước nhỏ (checklist) — mỗi dòng một bước</label>
            <textarea name="checklist" rows={3} className="input" />
          </div>
        </div>
      </details>

      <Submit className="btn btn-primary w-full text-lg sm:w-auto">{idCha ? "Thêm việc con" : selected.length > 1 ? `Giao ${selected.length} việc` : "Giao việc"}</Submit>
    </ActionForm>
  );
}
