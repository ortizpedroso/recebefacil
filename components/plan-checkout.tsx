"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { subscribeAction } from "@/app/actions";
import { maskCpfOrCnpj } from "@/lib/masks";
import { FormError } from "./dialog";
import { toast } from "./toast";
import { buttonClass, Field, inputClass } from "./ui";

export type CheckoutMode = "new" | "change" | "resume";

const BUTTON: Record<CheckoutMode, string> = { new: "Confirmar e pagar", change: "Trocar para este plano", resume: "Ir para o pagamento" };
const NOTE: Record<CheckoutMode, string> = {
  new: "Você vai para a fatura do Asaas e escolhe Pix, boleto ou cartão. A mensalidade é cobrada todo mês, na mesma data.",
  change: "O novo valor vale a partir da próxima mensalidade. Você segue usando o plano sem parar.",
  resume: "Você volta para a fatura em aberto, no Asaas.",
};

export function PlanCheckout({ plan, mode, needsDocument }: { plan: string; mode: CheckoutMode; needsDocument: boolean }) {
  const router = useRouter();
  const [document, setDocument] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function confirm() {
    setPending(true);
    setError("");
    const result = await subscribeAction(plan, document);
    if (!result.ok) {
      setError(result.error);
      setPending(false);
      return;
    }
    if (result.kind === "pay") {
      window.location.assign(result.invoiceUrl);
      return;
    }
    toast("Plano trocado.");
    setPending(false);
    router.replace("/assinatura");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {needsDocument ? (
        <Field label="CPF ou CNPJ de quem paga a mensalidade" hint="usado só para emitir a cobrança">
          <input className={inputClass} inputMode="numeric" autoComplete="off" value={document} onChange={(event) => setDocument(maskCpfOrCnpj(event.target.value))} placeholder="000.000.000-00" />
        </Field>
      ) : null}
      <p className="text-sm text-slate-600">{NOTE[mode]}</p>
      <FormError message={error} />
      <button type="button" className={buttonClass} disabled={pending || (needsDocument && document.replace(/\D/g, "").length < 11)} onClick={confirm}>
        {pending ? "Aguarde..." : BUTTON[mode]}
      </button>
    </div>
  );
}
