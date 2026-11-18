"use client";

import { Printer } from "lucide-react";
import { buttonClass } from "./ui";

export function PrintButton({ label = "Imprimir" }: { label?: string }) {
  return (
    <button type="button" className={buttonClass} onClick={() => window.print()}>
      <Printer className="h-4 w-4" />
      {label}
    </button>
  );
}
