"use client";

import { useState, type ReactNode } from "react";
import { buttonClass } from "./ui";

export function NewButton({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={buttonClass} onClick={() => setOpen(true)}>Novo</button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button className="absolute inset-0 bg-slate-900/40" aria-label="Fechar" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-lg rounded-xl bg-white p-5 shadow-lg">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-bold text-slate-900">{title}</p>
              <button type="button" className="text-slate-400" aria-label="Fechar" onClick={() => setOpen(false)}>✕</button>
            </div>
            {children}
          </div>
        </div>
      ) : null}
    </>
  );
}
