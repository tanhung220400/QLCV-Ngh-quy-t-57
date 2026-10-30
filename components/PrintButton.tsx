"use client";
export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="btn btn-primary">
      In / Lưu PDF
    </button>
  );
}
