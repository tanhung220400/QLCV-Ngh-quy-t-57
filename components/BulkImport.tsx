"use client";
import { useState } from "react";
import { ActionForm, Submit } from "./ActionForm";
import { bulkCreateAction } from "@/app/actions/task";

type Opt = { id: number; ten: string };
type Row = { ten: string; chu_tri: string; han: string; san_pham: string; linh_vuc: string; uu_tien: string };

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ")
    .trim();

function parseDate(s: string, fallback: string): string {
  const t = s.trim();
  let m = t.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return t;
  m = t.match(/^(\d{1,2})[\/.-](\d{1,2})$/);
  if (m) return `${fallback.slice(0, 4)}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return fallback;
}

export function BulkImport({ units, people, linhVuc, leaders, showGiao, defaultDue }: { units: Opt[]; people: Opt[]; linhVuc: string[]; leaders: Opt[]; showGiao: boolean; defaultDue: string }) {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [lv, setLv] = useState("");
  const [sp, setSp] = useState("Báo cáo");

  const match = (s: string): string => {
    const n = norm(s);
    if (!n) return "";
    const u = units.find((x) => norm(x.ten) === n || norm(x.ten).includes(n) || n.includes(norm(x.ten)));
    if (u) return `d:${u.id}`;
    const p = people.find((x) => norm(x.ten) === n || norm(x.ten).endsWith(n));
    return p ? `u:${p.id}` : "";
  };

  const parse = () => {
    const out: Row[] = [];
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) continue;
      const cells = line.includes("\t") ? line.split("\t") : line.split("|");
      const ten = cells[0].replace(/^\s*(\d+[\.\)]|[-–•*])\s*/, "").trim();
      if (!ten) continue;
      out.push({
        ten,
        chu_tri: match(cells[1] || ""),
        han: parseDate(cells[2] || "", defaultDue),
        san_pham: (cells[3] || "").trim() || sp,
        linh_vuc: linhVuc.find((x) => norm(x) === norm(cells[4] || "")) || lv,
        uu_tien: /hoa toc/.test(norm(cells[5] || "")) ? "hoa_toc" : /khan/.test(norm(cells[5] || "")) ? "khan" : "thuong",
      });
    }
    setRows(out);
  };
  const upd = (i: number, k: keyof Row, v: string) => setRows((r) => r.map((x, j) => (j === i ? { ...x, [k]: v } : x)));

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <h2 className="h2">Bước 1. Dán danh sách việc</h2>
        <p className="text-slate-600">
          Mỗi dòng một việc. Có thể dán từ Word (mỗi việc một dòng) hoặc copy các cột từ Excel theo thứ tự: <b>Tên việc | Chủ trì | Hạn (dd/mm/yyyy) | Sản phẩm | Lĩnh vực | Ưu tiên</b>.
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          className="input font-mono text-sm"
          placeholder={"1. Rà soát hộ nghèo năm 2026 | Phòng Văn hóa - Xã hội | 15/11/2026 | Báo cáo\n2. Kiểm tra công trình xây dựng khu phố Đông | Phòng Kinh tế | 10/11/2026 | Biên bản"}
        />
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label">Lĩnh vực mặc định</label>
            <select value={lv} onChange={(e) => setLv(e.target.value)} className="input">
              <option value="">— chọn —</option>
              {linhVuc.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Sản phẩm mặc định</label>
            <input value={sp} onChange={(e) => setSp(e.target.value)} className="input" />
          </div>
          <div className="flex items-end">
            <button type="button" onClick={parse} className="btn btn-primary w-full">
              Tách thành danh sách →
            </button>
          </div>
        </div>
      </div>

      {rows.length > 0 && (
        <ActionForm action={bulkCreateAction} className="card space-y-3">
          <h2 className="h2">Bước 2. Kiểm tra và giao ({rows.length} việc)</h2>
          <input type="hidden" name="rows" value={JSON.stringify(rows)} />
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="label">Tên cuộc họp</label>
              <input name="cuoc_hop" className="input" placeholder="Giao ban UBND tuần 44" />
            </div>
            <div>
              <label className="label">Số hiệu thông báo kết luận</label>
              <input name="so_hieu_vb" className="input" />
            </div>
            {showGiao && (
              <div>
                <label className="label">Lãnh đạo kết luận (người giao)</label>
                <select name="nguoi_giao" className="input">
                  <option value="">Tôi</option>
                  {leaders.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.ten}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="space-y-3">
            {rows.map((r, i) => (
              <div key={i} className="rounded-xl border border-slate-200 p-3">
                <div className="flex gap-2">
                  <span className="pt-2 font-bold text-slate-500">{i + 1}.</span>
                  <input value={r.ten} onChange={(e) => upd(i, "ten", e.target.value)} className="input font-semibold" />
                  <button type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))} className="btn btn-outline btn-sm" aria-label="Bỏ dòng">
                    ✕
                  </button>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-5">
                  <select value={r.chu_tri} onChange={(e) => upd(i, "chu_tri", e.target.value)} className={`input sm:col-span-2 ${r.chu_tri ? "" : "border-red-400"}`}>
                    <option value="">— Chủ trì —</option>
                    <optgroup label="Đơn vị">
                      {units.map((u) => (
                        <option key={u.id} value={`d:${u.id}`}>
                          {u.ten}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Cá nhân">
                      {people.map((u) => (
                        <option key={u.id} value={`u:${u.id}`}>
                          {u.ten}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                  <input type="date" value={r.han} onChange={(e) => upd(i, "han", e.target.value)} className="input" />
                  <input value={r.san_pham} onChange={(e) => upd(i, "san_pham", e.target.value)} className="input" placeholder="Sản phẩm" />
                  <select value={r.linh_vuc} onChange={(e) => upd(i, "linh_vuc", e.target.value)} className={`input ${r.linh_vuc ? "" : "border-red-400"}`}>
                    <option value="">— Lĩnh vực —</option>
                    {linhVuc.map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
          <Submit className="btn btn-primary w-full text-lg">Giao {rows.length} việc</Submit>
        </ActionForm>
      )}
    </div>
  );
}
