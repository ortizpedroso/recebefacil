import { and, eq, isNull } from "drizzle-orm";
import { AsaasError, customerContact, isAsaasUrl, stageOf, type AsaasClient, type AsaasPayment, type SplitShare } from "./asaas";
import { NO_LINK } from "./asaas-link";
import { settleOrDrop } from "./asaas-settle";
import { onlineAllowed } from "./billing";
import { shiftDays, todayIn } from "./dates";
import type { DB } from "./db";
import { documentKind, onlyDigits } from "./documents";
import { DomainError } from "./errors";
import { chargeTitle } from "./labels";
import { lateCharges } from "./late";
import { maskDocument } from "./masks";
import { cents } from "./money";
import { isIntegrated, loadPlatformSettings, platformClientFor, type PlatformSettingsRow } from "./platform-settings";
import { charges, clients, organizations } from "./schema";
import { isOpen } from "./status";

export const PAY_METHODS = ["pix", "boleto", "cartao"] as const;
export type PayMethod = (typeof PAY_METHODS)[number];

export function isPayMethod(value: unknown): value is PayMethod {
  return (PAY_METHODS as readonly unknown[]).includes(value);
}

// Cartão usa UNDEFINED: o pagador escolhe e digita o cartão na página do Asaas, nunca na nossa.
const BILLING = { pix: "PIX", boleto: "BOLETO", cartao: "UNDEFINED" } as const;
const BOLETO_DAYS = 3;
const MAX_ATTEMPTS = 3;

export class NeedsDocumentError extends DomainError {}

export type CheckoutView =
  | { kind: "pix"; image: string; payload: string; expiresAt: string | null; valueCents: number }
  | { kind: "boleto"; identificationField: string | null; bankSlipUrl: string | null; dueOn: string | null; valueCents: number }
  | { kind: "card"; url: string; valueCents: number }
  | { kind: "paid" };

export type CheckoutDeps = { fetch?: typeof fetch; now?: Date };

// A plataforma fica com a taxa. O resto vai por divisão para a carteira do lojista, em percentual com 4 casas.
export function splitFor(walletId: string, feeBp: number): SplitShare[] {
  return [{ walletId, percentualValue: Number(((10_000 - feeBp) / 100).toFixed(4)) }];
}

async function payerDocument(db: DB, client: typeof clients.$inferSelect, given: string | undefined): Promise<string> {
  if (documentKind(client.document)) return client.document;
  const typed = (given ?? "").trim();
  const kind = documentKind(typed);
  if (!kind) throw new NeedsDocumentError(typed ? "CPF ou CNPJ inválido. Confira os números." : "Informe seu CPF ou CNPJ para gerar o pagamento.");
  const document = maskDocument(typed, kind);
  await db.update(clients).set({ document, kind }).where(eq(clients.id, client.id));
  return document;
}

async function customerOf(db: DB, asaas: AsaasClient, client: typeof clients.$inferSelect, document: string): Promise<string> {
  if (client.asaasCustomerId) return client.asaasCustomerId;
  const id = await asaas.findOrCreateCustomer({ name: client.name, cpfCnpj: onlyDigits(document), ...customerContact(client.email, client.whatsapp || client.phone) });
  await db.update(clients).set({ asaasCustomerId: id }).where(eq(clients.id, client.id));
  return id;
}

type Verdict = { kind: "paid"; remote: AsaasPayment } | { kind: "reuse"; remote: AsaasPayment } | { kind: "replace" };

// Só uma cobrança PENDING, do mesmo tipo e do mesmo valor de hoje, pode ser reaproveitada. Qualquer outra coisa é trocada.
async function inspect(asaas: AsaasClient, row: typeof charges.$inferSelect, method: PayMethod, valueCents: number): Promise<Verdict> {
  let remote: AsaasPayment;
  try {
    remote = await asaas.getPayment(row.asaasPaymentId ?? "");
  } catch (error) {
    if (error instanceof AsaasError && error.kind === "notfound") return { kind: "replace" };
    throw error;
  }
  if (stageOf(remote.status) === "paid") return { kind: "paid", remote };
  const reusable = remote.status === "PENDING" && !remote.deleted && remote.valueCents === valueCents && remote.billingType === BILLING[method];
  return reusable ? { kind: "reuse", remote } : { kind: "replace" };
}

// Apagar uma cobrança que acabou de ser paga falha. Nesse caso o dinheiro entrou e a cobrança local quita em vez de duplicar.
async function discard(db: DB, asaas: AsaasClient, row: typeof charges.$inferSelect, now: Date): Promise<"gone" | "paid"> {
  const id = row.asaasPaymentId ?? "";
  try {
    await asaas.deletePayment(id);
  } catch (error) {
    if (!(error instanceof AsaasError && error.kind === "notfound")) {
      const check = await asaas.getPayment(id).catch(() => null);
      if (check && stageOf(check.status) === "paid") return (await settleOrDrop(db, row.id, check, now)) === "paid" ? "paid" : "gone";
      throw error;
    }
  }
  await db.update(charges).set(NO_LINK).where(eq(charges.id, row.id));
  return "gone";
}

async function present(db: DB, asaas: AsaasClient, rowId: string, method: PayMethod, valueCents: number, dueOn: string | null, now: Date): Promise<CheckoutView> {
  const [row] = await db.select().from(charges).where(eq(charges.id, rowId));
  if (!row?.asaasPaymentId) throw new AsaasError("response", "A cobrança não ficou registrada. Tente de novo.");
  const id = row.asaasPaymentId;
  if (method === "pix") {
    let { asaasPixImage: image, asaasPixPayload: payload, asaasPixExpiresAt: expiresAt } = row;
    const valid = Boolean(image && payload) && (!expiresAt || new Date(expiresAt).getTime() > now.getTime());
    if (!valid) {
      const qr = await asaas.getPixQrCode(id);
      ({ image, payload, expiresAt } = qr);
      await db.update(charges).set({ asaasPixImage: image, asaasPixPayload: payload, asaasPixExpiresAt: expiresAt }).where(eq(charges.id, row.id));
    }
    return { kind: "pix", image: image ?? "", payload: payload ?? "", expiresAt: expiresAt ?? null, valueCents };
  }
  if (method === "boleto") {
    let field = row.asaasIdentificationField;
    if (!field) {
      // A linha digitável pode demorar a existir. Sem ela, o PDF do boleto continua valendo.
      field = await asaas.getIdentificationField(id).catch(() => null);
      if (field) await db.update(charges).set({ asaasIdentificationField: field }).where(eq(charges.id, row.id));
    }
    return { kind: "boleto", identificationField: field, bankSlipUrl: row.asaasBankSlipUrl, dueOn, valueCents };
  }
  if (!row.asaasInvoiceUrl || !isAsaasUrl(row.asaasInvoiceUrl)) throw new AsaasError("response", "O Asaas não devolveu o link de pagamento. Tente de novo.");
  return { kind: "card", url: row.asaasInvoiceUrl, valueCents };
}

export async function startCheckout(db: DB, input: { chargeId: string; method: PayMethod; document?: string }, deps: CheckoutDeps = {}): Promise<CheckoutView> {
  const now = deps.now ?? new Date();
  const [charge] = await db.select().from(charges).where(eq(charges.id, input.chargeId));
  if (!charge) throw new DomainError("Cobrança não encontrada.");
  const [org] = await db.select().from(organizations).where(eq(organizations.id, charge.organizationId));
  const [client] = await db.select().from(clients).where(and(eq(clients.organizationId, charge.organizationId), eq(clients.id, charge.clientId)));
  if (!org || !client) throw new DomainError("Cobrança não encontrada.");
  const settings: PlatformSettingsRow = await loadPlatformSettings(db);
  if (!isIntegrated(org, settings) || !(await onlineAllowed(db, org, charge, now))) throw new DomainError("Este link não aceita pagamento pelo Asaas.");
  if (charge.status === "cancelada") throw new DomainError("Esta cobrança foi cancelada. Não é preciso pagar.");
  if (org.asaasWalletId.toLowerCase() === settings.asaasWalletId.toLowerCase()) throw new DomainError("A conta Asaas desta empresa é a mesma da plataforma. Conecte outra conta em Recebimentos.");

  const document = await payerDocument(db, client, input.document);
  const asaas = platformClientFor(settings, deps.fetch);
  const today = todayIn(org.timezone, now);
  // O Asaas conta o dia em Brasília: um vencimento de hoje em fuso mais a oeste pode já ser passado lá.
  const asaasToday = [today, todayIn("America/Sao_Paulo", now)].sort().at(-1) ?? today;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const [row] = await db.select().from(charges).where(eq(charges.id, charge.id));
    if (!row || !isOpen(row)) return { kind: "paid" };
    const open = row.amountCents - row.paidCents;
    const late = lateCharges(open, row.dueOn, today, org);
    const valueCents = open + late.fineCents + late.interestCents;

    if (row.asaasPaymentId) {
      const verdict = await inspect(asaas, row, input.method, valueCents);
      if (verdict.kind === "paid") {
        if ((await settleOrDrop(db, row.id, verdict.remote, now)) === "paid") return { kind: "paid" };
        continue;
      }
      if (verdict.kind === "reuse") return present(db, asaas, row.id, input.method, valueCents, verdict.remote.dueDate, now);
      if ((await discard(db, asaas, row, now)) === "paid") {
        const [after] = await db.select().from(charges).where(eq(charges.id, row.id));
        if (after && !isOpen(after)) return { kind: "paid" };
        continue;
      }
    }

    const customer = await customerOf(db, asaas, client, document);
    const created = await asaas.createPayment({
      customer,
      billingType: BILLING[input.method],
      valueCents: cents(valueCents),
      dueDate: input.method === "pix" ? asaasToday : shiftDays(asaasToday, BOLETO_DAYS),
      description: `${org.tradeName} - ${chargeTitle(row)}`,
      externalReference: row.id,
      split: splitFor(org.asaasWalletId, settings.platformFeeBp),
    });
    // Duas pessoas abrindo o link ao mesmo tempo criam duas cobranças. Só a primeira a gravar fica; a outra é apagada.
    const [claimed] = await db
      .update(charges)
      .set({
        asaasPaymentId: created.id,
        asaasBillingType: created.billingType,
        asaasInvoiceUrl: created.invoiceUrl,
        asaasBankSlipUrl: created.bankSlipUrl,
        asaasIdentificationField: null,
        asaasPixPayload: null,
        asaasPixImage: null,
        asaasPixExpiresAt: null,
        asaasValueCents: created.valueCents,
        asaasSyncedAt: now.toISOString(),
      })
      .where(and(eq(charges.id, row.id), isNull(charges.asaasPaymentId)))
      .returning({ id: charges.id });
    if (!claimed) {
      await asaas.deletePayment(created.id).catch(() => undefined);
      continue;
    }
    return present(db, asaas, row.id, input.method, valueCents, created.dueDate, now);
  }
  throw new DomainError("Não foi possível gerar o pagamento agora. Tente de novo em instantes.");
}
