import type { CaiDat } from "@/lib/const";
import { vnDate } from "@/lib/time";
import { PrintButton } from "./PrintButton";

/** Bản xem / in theo thể thức Nghị định 30/2020/NĐ-CP (A4, lề 20-20-30-15 mm, Times New Roman 14) */
export function PrintDoc({ cfg, title, sub, kyThay, children }: { cfg: CaiDat; title: string; sub: string; kyThay?: boolean; children: React.ReactNode }) {
  const d = vnDate();
  const m = Number(d.slice(5, 7));
  const coQuan = cfg.ten_don_vi.trim().toUpperCase().replace(/^UBND\b/, "ỦY BAN NHÂN DÂN");
  const thay = !!kyThay && !!(cfg.chuc_vu_ky_thay || cfg.nguoi_ky_thay);
  const tm = (cfg.tm_ky || "TM. ỦY BAN NHÂN DÂN").toUpperCase();
  const cv = (cfg.chuc_vu_ky || "CHỦ TỊCH").toUpperCase();
  return (
    <div className="mx-auto max-w-[210mm] bg-white px-[15mm] pt-[20mm] pb-[20mm] pl-[30mm] font-['Times_New_Roman',serif] text-[14pt] leading-snug text-black print:p-0">
      <style>{`@page { size: A4; margin: 20mm 15mm 20mm 30mm; }`}</style>
      <div className="no-print mb-4 flex justify-end gap-2 font-sans text-base">
        <PrintButton />
      </div>
      <div className="grid grid-cols-[2fr_3fr] gap-2 text-center">
        <div>
          {cfg.ten_cap_tren && <div className="text-[13pt] uppercase">{cfg.ten_cap_tren}</div>}
          <div className="text-[13pt] font-bold">{coQuan}</div>
          <div className="mx-auto mt-0.5 w-[30mm] border-b border-black" />
          <div className="mt-2 text-[13pt]">Số: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;/BC-UBND</div>
        </div>
        <div>
          <div className="text-[13pt] font-bold">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
          <div className="font-bold">Độc lập - Tự do - Hạnh phúc</div>
          <div className="mx-auto mt-0.5 w-[62mm] border-b border-black" />
          <div className="mt-2 italic">
            {cfg.dia_danh ? `${cfg.dia_danh}, ` : ""}ngày {d.slice(8)} tháng {m <= 2 ? `0${m}` : m} năm {d.slice(0, 4)}
          </div>
        </div>
      </div>
      <h1 className="mt-8 text-center font-bold">BÁO CÁO</h1>
      <h2 className="text-center font-bold">{sub}</h2>
      <div className="mx-auto mt-0.5 mb-4 w-[35mm] border-b border-black" />
      <div className="space-y-[6pt] text-justify [&_p]:indent-[10mm]">{children}</div>
      <div className="mt-8 grid grid-cols-[9fr_11fr] break-inside-avoid">
        <div>
          <div className="text-[12pt] font-bold italic">Nơi nhận:</div>
          <div className="text-[11pt] whitespace-pre-line">{cfg.noi_nhan}</div>
        </div>
        <div className="text-center font-bold">
          <div>{tm}</div>
          {thay ? (
            <>
              <div>KT. {cv}</div>
              <div>{(cfg.chuc_vu_ky_thay || "PHÓ CHỦ TỊCH").toUpperCase()}</div>
            </>
          ) : (
            <div>{cv}</div>
          )}
          <div className="h-28" />
          <div>{thay ? cfg.nguoi_ky_thay : cfg.nguoi_ky}</div>
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
