import type { CaiDat } from "@/lib/const";
import { vnDate } from "@/lib/time";
import { PrintButton } from "./PrintButton";

export function PrintDoc({ cfg, title, sub, children }: { cfg: CaiDat; title: string; sub: string; children: React.ReactNode }) {
  const d = vnDate();
  return (
    <div className="mx-auto max-w-[210mm] bg-white p-8 font-serif text-[15px] leading-relaxed text-black print:p-0">
      <div className="no-print mb-4 flex justify-end gap-2 font-sans">
        <PrintButton />
      </div>
      <div className="grid grid-cols-[2fr_3fr] text-center">
        <div>
          {cfg.ten_cap_tren && <div className="uppercase">{cfg.ten_cap_tren}</div>}
          <div className="font-bold uppercase">{cfg.ten_don_vi}</div>
          <div>———</div>
        </div>
        <div>
          <div className="font-bold">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
          <div className="font-bold">Độc lập - Tự do - Hạnh phúc</div>
          <div>———————</div>
          <div className="italic">
            {cfg.dia_danh ? `${cfg.dia_danh}, ` : ""}ngày {Number(d.slice(8))} tháng {Number(d.slice(5, 7))} năm {d.slice(0, 4)}
          </div>
        </div>
      </div>
      <h1 className="mt-6 text-center text-lg font-bold">BÁO CÁO</h1>
      <h2 className="mb-4 text-center font-bold">{sub}</h2>
      <div className="space-y-3">{children}</div>
      <div className="mt-8 grid grid-cols-2">
        <div className="text-sm">
          <b>
            <i>Nơi nhận:</i>
          </b>
          <div className="whitespace-pre-line">{cfg.noi_nhan}</div>
        </div>
        <div className="text-center">
          <div className="font-bold uppercase">TM. {cfg.ten_don_vi.replace(/^UBND/i, "Ủy ban nhân dân")}</div>
          <div className="font-bold uppercase">{cfg.chuc_vu_ky}</div>
          <div className="h-24" />
          <div className="font-bold">{cfg.nguoi_ky}</div>
        </div>
      </div>
      <span className="hidden">{title}</span>
    </div>
  );
}

export function PTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <table className="w-full border-collapse text-[13px]">
      <thead>
        <tr>
          {head.map((h) => (
            <th key={h} className="border border-black px-1.5 py-1">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((c, j) => (
              <td key={j} className={`border border-black px-1.5 py-1 align-top ${j === 0 ? "text-center" : ""}`}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
