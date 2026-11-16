"use client";

import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    void fetch("/api/erros", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: error.message }),
    });
  }, [error]);
  return (
    <div className="mx-auto max-w-lg space-y-3 p-8">
      <h1 className="text-xl font-semibold">Algo quebrou nesta tela</h1>
      <p className="text-sm text-[#64748B]">O erro foi registrado e aparece nos alertas da empresa.</p>
      <button className="rounded-lg bg-teal-700 px-4 py-2 text-sm text-white" onClick={() => reset()} type="button">Tentar de novo</button>
    </div>
  );
}
