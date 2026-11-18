"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ConfirmAction({
  label,
  message,
  confirmLabel,
  action,
  className,
  danger = false,
}: {
  label: string;
  message: string;
  confirmLabel: string;
  action: () => Promise<unknown>;
  className?: string;
  danger?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    setPending(true);
    setError("");
    const result = await action();
    if (result && typeof result === "object" && "ok" in result && (result as { ok?: boolean }).ok === false) {
      setError((result as { error?: string }).error || "Não foi possível concluir.");
      setPending(false);
      return;
    }
    setOpen(false);
    setPending(false);
    router.refresh();
  }

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>{label}</button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button className="absolute inset-0 bg-slate-900/40" aria-label="Fechar" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-sm rounded-xl bg-white p-5 shadow-lg">
            <p className="text-sm font-bold text-slate-900">{confirmLabel}</p>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">{message}</p>
            {error ? <p className="mt-2 text-xs text-[#EF4444]">{error}</p> : null}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium" onClick={() => setOpen(false)}>Cancelar</button>
              <button
                type="button"
                className={danger ? "rounded-lg bg-[#EF4444] px-3 py-2 text-xs font-semibold text-white" : "rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white"}
                onClick={run}
                disabled={pending}
              >
                {pending ? "Aguarde..." : confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
