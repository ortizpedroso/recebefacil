"use client";

import { useEffect, useState } from "react";

const EVENT = "recebefacil:toast";

export function toast(message: string) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: message }));
}

export function Toaster() {
  const [message, setMessage] = useState("");
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const show = (event: Event) => {
      setMessage(String((event as CustomEvent).detail));
      clearTimeout(timer);
      timer = setTimeout(() => setMessage(""), 3200);
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
