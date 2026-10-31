"use client";
import { createContext, startTransition, useActionState, useContext, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export type ActionState = { ok?: boolean; error?: string; message?: string; redirect?: string; reset?: boolean } | null;
type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

const Pending = createContext(false);

/**
 * Biểu mẫu gọi server action. Tự gửi FormData qua startTransition để React KHÔNG xóa
 * nội dung đã nhập khi có lỗi (mặc định React 19 xóa form sau mỗi lần gửi).
 */
export function ActionForm({
  action,
  children,
  className,
  confirm,
  id,
}: {
  action: Action;
  children: React.ReactNode;
  className?: string;
  confirm?: string;
  id?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.redirect) router.push(state.redirect);
    else if (state?.ok) {
      if (state.reset) ref.current?.reset();
      router.refresh();
    }
  }, [state, router]);
  return (
    <form
      id={id}
      ref={ref}
      className={className}
      // Gửi được cả khi trang chưa tải xong JavaScript (điện thoại mạng chậm)
      action={formAction}
      onSubmit={(e) => {
        e.preventDefault();
        if (pending) return;
        if (confirm && !window.confirm(confirm)) return;
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        const fd = new FormData(e.currentTarget, submitter && submitter.name ? submitter : undefined);
        startTransition(() => formAction(fd));
      }}
    >
      <Pending.Provider value={pending}>{children}</Pending.Provider>
      {state?.error && (
        <p role="alert" className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 whitespace-pre-line text-red-800">
          {state.error}
        </p>
      )}
      {state?.ok && state.message && (
        <p role="status" className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 whitespace-pre-line text-emerald-800">
          {state.message}
        </p>
      )}
    </form>
  );
}

export function Submit({ children, className, name, value }: { children: React.ReactNode; className?: string; name?: string; value?: string }) {
  const pending = useContext(Pending);
  return (
    <button type="submit" name={name} value={value} disabled={pending} className={className || "btn btn-primary"}>
      {pending ? "Đang xử lý..." : children}
    </button>
  );
}
