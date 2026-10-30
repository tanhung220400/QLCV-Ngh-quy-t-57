"use client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-xl">
        <div className="text-4xl">⚠️</div>
        <h1 className="mt-2 text-xl font-bold">Hệ thống đang gặp sự cố</h1>
        <p className="mt-2 text-slate-600">
          Không tải được trang. Nếu vừa cài đặt, hãy kiểm tra chuỗi kết nối cơ sở dữ liệu (biến DATABASE_URL trên Vercel): đúng mật khẩu, dùng Session pooler cổng 5432.
        </p>
        {error.digest && <p className="mt-2 text-sm text-slate-400">Mã lỗi: {error.digest}</p>}
        <button onClick={reset} className="btn btn-primary mt-4">
          Thử lại
        </button>
      </div>
    </div>
  );
}
