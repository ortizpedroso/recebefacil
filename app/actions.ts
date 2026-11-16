"use server"

import {
  confirmReceipt,
  materializePeriod,
  recordContract,
  recordCrediario,
  reverseReceipt,
  saveClient,
  saveMerchant,
} from "../src/book"
import { phrase } from "../src/phrase"

export type ActionState = { ok: true; notice: string } | { ok: false; notice: string }

function fromBook(result: { ok: true; value: { replayed?: boolean } } | { ok: false; error: { code: Parameters<typeof phrase>[0]["code"] } }, created: string): ActionState {
  if (!result.ok) return { ok: false, notice: phrase(result.error) }
  return { ok: true, notice: result.value.replayed ? "Este envio já estava registrado." : created }
}

export async function saveMerchantAction(_prev: ActionState | null, form: FormData): Promise<ActionState> {
  const result = await saveMerchant({ legalName: form.get("legalName"), pixKey: form.get("pixKey") })
  if (!result.ok) return { ok: false, notice: phrase(result.error) }
  return { ok: true, notice: "Empresa salva." }
}

export async function saveClientAction(_prev: ActionState | null, form: FormData): Promise<ActionState> {
  const result = await saveClient({ name: form.get("name"), taxId: form.get("taxId"), phone: form.get("phone") })
  if (!result.ok) return { ok: false, notice: phrase(result.error) }
  return { ok: true, notice: "Cliente salvo." }
}

export async function recordCrediarioAction(_prev: ActionState | null, form: FormData): Promise<ActionState> {
  return fromBook(
    await recordCrediario({
      idempotencyKey: form.get("idempotencyKey"),
      clientId: form.get("clientId"),
      description: form.get("description"),
      principalReais: form.get("principalReais"),
      installmentCount: form.get("installmentCount"),
      firstDue: form.get("firstDue"),
    }),
    "Venda lançada.",
  )
}

export async function recordContractAction(_prev: ActionState | null, form: FormData): Promise<ActionState> {
  return fromBook(
    await recordContract({
      idempotencyKey: form.get("idempotencyKey"),
      clientId: form.get("clientId"),
      description: form.get("description"),
      amountReais: form.get("amountReais"),
      dueDay: form.get("dueDay"),
      openedOn: form.get("openedOn"),
    }),
    "Contrato lançado.",
  )
}

export async function materializePeriodAction(_prev: ActionState | null, form: FormData): Promise<ActionState> {
  return fromBook(
    await materializePeriod({ contractId: form.get("contractId"), periodKey: form.get("periodKey") }),
    "Parcela do mês gerada.",
  )
}

export async function confirmReceiptAction(_prev: ActionState | null, form: FormData): Promise<ActionState> {
  return fromBook(
    await confirmReceipt({
      idempotencyKey: form.get("idempotencyKey"),
      installmentId: form.get("installmentId"),
      amountReais: form.get("amountReais"),
      method: form.get("method"),
      confirmedOn: form.get("confirmedOn"),
    }),
    "Recebimento confirmado.",
  )
}

export async function reverseReceiptAction(_prev: ActionState | null, form: FormData): Promise<ActionState> {
  return fromBook(await reverseReceipt({ receiptId: form.get("receiptId") }), "Recebimento estornado.")
}
