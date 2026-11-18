"use client";

import { useEffect, useState } from "react";

const EVENT = "recebefacil:toast";

// Aviso longo precisa de mais tempo de leitura.
export function toast(message: string, ms = 3200) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { message, ms } }));
}

export function Toaster() {
  const [message, setMessage] = useState("");
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const show = (event: Event) => {
      const { message: text, ms } = (event as CustomEvent<{ message: string; ms: number }>).detail;
      setMessage(text);
      clearTimeout(timer);
      timer = setTimeout(() => setMessage(""), ms);
    };
    window.addEventListener(EVENT, show);
    return () => {
      window.removeEventListener(EVENT, show);
      clearTimeout(timer);
    };
  }, []);
  return message ? (
    <div role="status" className="fixed bottom-24 left-1/2 z-[60] max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-lg md:bottom-8 print:hidden">
      {message}
    </div>
  ) : null;
}
