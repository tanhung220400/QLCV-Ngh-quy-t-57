"use client";
import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";

export type ActionState = { ok?: boolean; error?: string; message?: string; redirect?: string; reset?: boolean } | null;
type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

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
  const [state, formAction] = useActionState(action, null);
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
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
      {state?.error && (
        <p role="alert" className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 whitespace-pre-line text-red-800">
          {state.error}
        </p>
      )}
      {state?.ok && state.message && (
        <p role="status" className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-emerald-800">
          {state.message}
        </p>
      )}
    </form>
  );
}

export function Submit({ children, className, name, value }: { children: React.ReactNode; className?: string; name?: string; value?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" name={name} value={value} disabled={pending} className={className || "btn btn-primary"}>
      {pending ? "Đang xử lý..." : children}
    </button>
  );
}
