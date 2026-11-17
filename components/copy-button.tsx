"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "./toast";

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const done = document.execCommand("copy");
    area.remove();
    return done;
  }
}

export function CopyButton({ text, className, children = "Copiar", doneMessage = "Copiado" }: { text: string; className: string; children?: React.ReactNode; doneMessage?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        if (await copyText(text)) {
          setCopied(true);
          toast(doneMessage);
          setTimeout(() => setCopied(false), 1800);
        } else {
          toast("Não deu para copiar. Selecione o texto e copie.");
        }
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copiado" : children}
    </button>
  );
}
