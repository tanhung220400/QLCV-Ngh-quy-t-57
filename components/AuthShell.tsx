export function AuthShell({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-brand-700 to-brand-800 px-4 py-10">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl sm:p-8">
        <div className="mb-6 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/cong-an-hieu.webp" alt="Công an hiệu" className="mx-auto mb-3 h-20 w-auto object-contain" />
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="mt-1 text-slate-500">Phần mềm Giao việc &amp; Theo dõi chỉ tiêu{sub ? ` · ${sub}` : ""}</p>
        </div>
        {children}
      </div>
    </div>
  );
}
