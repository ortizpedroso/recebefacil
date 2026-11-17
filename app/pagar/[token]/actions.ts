"use server";

import { AsaasError } from "@/lib/asaas";
import { isPayMethod, NeedsDocumentError, startCheckout, type CheckoutView } from "@/lib/asaas-checkout";
import { getDb } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { verifyToken } from "@/lib/secret";

export type StartPaymentResult = { ok: true; view: CheckoutView } | { ok: false; error: string; needsDocument?: boolean };

// Endereço público: quem conhece o link assinado pode gerar o pagamento daquela cobrança, e mais nada. Cartão nunca passa por aqui.
export async function startPaymentAction(token: string, method: string, document: string): Promise<StartPaymentResult> {
  const chargeId = verifyToken(token);
  if (!chargeId || !isPayMethod(method)) return { ok: false, error: "Este link de pagamento não é válido." };
  try {
    const view = await startCheckout(await getDb(), { chargeId, method, document });
    return { ok: true, view };
  } catch (error) {
    if (error instanceof NeedsDocumentError) return { ok: false, error: error.message, needsDocument: true };
    if (error instanceof DomainError || error instanceof AsaasError) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: "Não foi possível gerar o pagamento agora. Tente de novo em instantes." };
  }
}
