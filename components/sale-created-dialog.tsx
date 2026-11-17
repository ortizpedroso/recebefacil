"use client";

import { MessageCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CopyButton } from "./copy-button";
import { Modal } from "./dialog";
import { buttonClass, secondaryButtonClass } from "./ui";

export function SaleCreatedDialog({ saleId, clientName, total, link, whatsapp, receiptHref }: { saleId: string; clientName: string; total: string; link: string | null; whatsapp: string | null; receiptHref: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  function close(value: boolean) {
    setOpen(value);
    if (!value) router.replace(`/vendas/${saleId}`, { scroll: false });
  }
  return (
    <Modal open={open} onOpenChange={close} title="Venda criada" description={`${clientName} · ${total}`}>
      {link ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">O link de pagamento já está pronto. Envie para o cliente pagar.</p>
          <div className="flex gap-2">
            <input readOnly value={link} aria-label="Link de pagamento" className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-700" onFocus={(event) => event.currentTarget.select()} />
            <CopyButton text={link} className={secondaryButtonClass} doneMessage="Link copiado">
              Copiar
            </CopyButton>
          </div>
          {whatsapp ? null : <p className="text-sm text-amber-700">Este cliente não tem WhatsApp cadastrado. Copie o link e envie por onde preferir.</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className={secondaryButtonClass} onClick={() => close(false)}>
              Ver venda
            </button>
            {whatsapp ? (
              <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={buttonClass} onClick={() => close(false)}>
                <MessageCircle className="h-4 w-4" />
                Enviar pelo WhatsApp
              </a>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">O pagamento já foi registrado. O recibo está pronto.</p>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className={secondaryButtonClass} onClick={() => close(false)}>
              Ver venda
            </button>
            {receiptHref ? (
              <Link href={receiptHref} className={buttonClass}>
                Abrir recibo
              </Link>
            ) : null}
          </div>
        </div>
      )}
    </Modal>
  );
}
