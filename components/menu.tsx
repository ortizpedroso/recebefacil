"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export function Menu({ trigger, label, className = "", align = "right", children }: { trigger: React.ReactNode; label: string; className?: string; align?: "left" | "right"; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <div ref={box} className="relative inline-block">
      <button type="button" aria-label={label} aria-haspopup="menu" aria-expanded={open} className={className} onClick={() => setOpen((value) => !value)}>
        {trigger}
      </button>
      {open ? (
        <div role="menu" onClick={() => setOpen(false)} className={`absolute z-40 mt-1 min-w-52 rounded-xl border border-slate-200 bg-white p-1 shadow-lg ${align === "right" ? "right-0" : "left-0"}`}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

const itemClass = (danger: boolean) =>
  `flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium hover:bg-slate-50 ${danger ? "text-rose-700 hover:bg-rose-50" : "text-slate-800"}`;

export function MenuItem({ onSelect, href, newTab = false, danger = false, children }: { onSelect?: () => void; href?: string; newTab?: boolean; danger?: boolean; children: React.ReactNode }) {
  if (href) {
    return (
      <Link role="menuitem" href={href} target={newTab ? "_blank" : undefined} className={itemClass(danger)}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" role="menuitem" className={itemClass(danger)} onClick={onSelect}>
      {children}
    </button>
  );
}
