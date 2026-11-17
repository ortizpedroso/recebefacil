import { and, asc, eq, inArray, isNotNull, isNull, like, lt, or } from "drizzle-orm";
import { AsaasError, stageOf, type AsaasClient, type AsaasPayment } from "./asaas";
import { NO_LINK } from "./asaas-link";
import type { DB } from "./db";
import { todayIn } from "./dates";
import { logWarning } from "./log";
import { registerPayment, reverseCharge } from "./ledger";
import { cents } from "./money";
import { platformClient } from "./platform-settings";
import { charges, organizations, payments } from "./schema";
import { CHARGE_STATES } from "./status";

// Uma cobrança do Asaas vira no máximo um recebimento local. A chave faz repetições (webhook duplicado, reconciliação) caírem no mesmo recebimento.
export const asaasKey = (paymentId: string) => `asaas:${paymentId}`;
export const asaasCashKey = (paymentId: string) => `asaas:${paymentId}:dinheiro`;
const CASH_SUFFIX = ":dinheiro";

const METHOD_BY_BILLING: Record<string, string> = { PIX: "Pix", BOLETO: "Boleto", CREDIT_CARD: "Cartão", DEBIT_CARD: "Cartão", UNDEFINED: "Cartão" };

export function methodOf(remote: Pick<AsaasPayment, "billingType" | "status">): string {
  if (remote.status === "RECEIVED_IN_CASH") return "Dinheiro";
  return METHOD_BY_BILLING[remote.billingType] ?? "Transferência";
}

// O que passa do principal em aberto é multa e juros: o link cobra o valor com atraso incluído.
export function splitReceipt(paidCents: number, openPrincipalCents: number): { amountCents: number; feeCents: number } {
  const amountCents = Math.min(paidCents, openPrincipalCents);
  return { amountCents, feeCents: paidCents - amountCents };
}

const OPEN_STATUSES = CHARGE_STATES.filter((state) => state.open).map((state) => state.status);

export type SettleOutcome = "settled" | "already" | "ignored";

async function chargeOf(tx: DB, remote: AsaasPayment) {
  if (!remote.externalReference) return undefined;
  // A referência é o id da cobrança. Se o dinheiro veio por uma cobrança que já foi trocada, ele vale mesmo assim.
  const [charge] = await tx.select().from(charges).where(eq(charges.id, remote.externalReference)).for("update");
  return charge;
}

export async function settleFromAsaas(db: DB, remote: AsaasPayment, now: Date): Promise<SettleOutcome> {
  return db.transaction(async (transaction) => {
    const tx = transaction as DB;
    const charge = await chargeOf(tx, remote);
    if (!charge || charge.status === "cancelada") return "ignored";
    const open = charge.amountCents - charge.paidCents;
    if (open <= 0) return "already";
    const [org] = await tx.select({ timezone: organizations.timezone }).from(organizations).where(eq(organizations.id, charge.organizationId));
    const { amountCents, feeCents } = splitReceipt(remote.valueCents, open);
    await registerPayment(tx, charge.organizationId, {
      chargeId: charge.id,
      amountCents: cents(amountCents),
      feeCents: cents(feeCents),
      paidOn: remote.paidOn ?? todayIn(org?.timezone ?? "America/Sao_Paulo", now),
      method: methodOf(remote),
      note: "Pago pelo Asaas",
      idempotencyKey: asaasKey(remote.id),
    });
    await tx.update(charges).set({ asaasSyncedAt: now.toISOString() }).where(eq(charges.id, charge.id));
    return "settled";
  });
}

export type UndoOutcome = "undone" | "ignored";

// Estorno, chargeback ou recebimento em dinheiro desfeito: só o recebimento daquela cobrança do Asaas deixa de valer.
export async function undoFromAsaas(db: DB, remote: AsaasPayment): Promise<UndoOutcome> {
  if (stageOf(remote.status) === "paid") return "ignored";
  return db.transaction(async (transaction) => {
    const tx = transaction as DB;
    const charge = await chargeOf(tx, remote);
    if (!charge) return "ignored";
    const received = await tx
      .select({ id: payments.id })
      .from(payments)
      .where(
        and(
          eq(payments.organizationId, charge.organizationId),
          eq(payments.chargeId, charge.id),
          isNull(payments.reversedAt),
          inArray(payments.idempotencyKey, [asaasKey(remote.id), asaasCashKey(remote.id)]),
        ),
      );
    await reverseCharge(tx, charge.organizationId, charge.id, received.map((row) => row.id));
    // Cobrança estornada não volta a valer. Já o dinheiro desfeito deixa a cobrança viva para o cliente pagar.
    if (stageOf(remote.status) === "dead" && charge.asaasPaymentId === remote.id) await tx.update(charges).set(NO_LINK).where(eq(charges.id, charge.id));
    return received.length > 0 ? "undone" : "ignored";
  });
}

export async function forgetLink(db: DB, paymentId: string): Promise<void> {
  await db.update(charges).set(NO_LINK).where(eq(charges.asaasPaymentId, paymentId));
}

export type RefreshOutcome = "paid" | "dropped" | "unchanged";

// Se o Asaas diz que foi pago, a cobrança local quita. Se ela continua aberta (o recebimento foi desfeito aqui), o vínculo morre e a cobrança aceita um pagamento novo.
export async function settleOrDrop(db: DB, chargeId: string, remote: AsaasPayment, now: Date): Promise<"paid" | "dropped"> {
  await settleFromAsaas(db, remote, now);
  const [fresh] = await db.select().from(charges).where(eq(charges.id, chargeId));
  if (fresh && fresh.paidCents < fresh.amountCents && fresh.status !== "cancelada") {
    await dropLink(db, chargeId);
    return "dropped";
  }
  return "paid";
}

async function dropLink(db: DB, chargeId: string) {
  await db.update(charges).set(NO_LINK).where(eq(charges.id, chargeId));
}

// Confere uma cobrança com o Asaas. Recebimento desfeito aqui dentro não volta sozinho: a cobrança solta o vínculo e aceita um pagamento novo.
export async function refreshCharge(db: DB, charge: typeof charges.$inferSelect, client: AsaasClient, now: Date): Promise<RefreshOutcome> {
  if (!charge.asaasPaymentId) return "unchanged";
  let remote: AsaasPayment;
  try {
    remote = await client.getPayment(charge.asaasPaymentId);
  } catch (error) {
    if (error instanceof AsaasError && error.kind === "notfound") {
      await dropLink(db, charge.id);
      return "dropped";
    }
    throw error;
  }
  const stage = stageOf(remote.status);
  if (remote.deleted || stage === "dead") {
    await undoFromAsaas(db, { ...remote, status: remote.deleted ? "REFUNDED" : remote.status });
    await dropLink(db, charge.id);
    return "dropped";
  }
  if (stage === "paid") return settleOrDrop(db, charge.id, remote, now);
  await db.update(charges).set({ asaasSyncedAt: now.toISOString() }).where(eq(charges.id, charge.id));
  return "unchanged";
}

const RECONCILE_AFTER_MS = 60 * 60 * 1000;
const RECONCILE_BATCH = 200;

export type ReconcileReport = { checked: number; settled: number; dropped: number; failed: number };

// Cobre webhook perdido: toda cobrança viva e em aberto, sem conferência há mais de uma hora, é lida de novo no Asaas.
export async function reconcileAsaas(db: DB, now: Date, options: { organizationId?: string; fetch?: typeof fetch } = {}): Promise<ReconcileReport> {
  const report: ReconcileReport = { checked: 0, settled: 0, dropped: 0, failed: 0 };
  const cutoff = new Date(now.getTime() - RECONCILE_AFTER_MS).toISOString();
  const stale = await db
    .select()
    .from(charges)
    .where(
      and(
        isNotNull(charges.asaasPaymentId),
        inArray(charges.status, [...OPEN_STATUSES]),
        or(isNull(charges.asaasSyncedAt), lt(charges.asaasSyncedAt, cutoff)),
        options.organizationId ? eq(charges.organizationId, options.organizationId) : undefined,
      ),
    )
    .orderBy(asc(charges.asaasSyncedAt))
    .limit(RECONCILE_BATCH);
  if (stale.length === 0) return report;
  let client: AsaasClient;
  try {
    client = (await platformClient(db, options.fetch)).client;
  } catch (error) {
    logWarning("asaas.reconciliacao", error);
    report.failed = stale.length;
    return report;
  }
  for (const charge of stale) {
    report.checked += 1;
    try {
      const outcome = await refreshCharge(db, charge, client, now);
      if (outcome === "paid") report.settled += 1;
      if (outcome === "dropped") report.dropped += 1;
    } catch (error) {
      report.failed += 1;
      logWarning("asaas.reconciliacao", error);
    }
  }
  return report;
}

const THROTTLE_MS = 10 * 60 * 1000;
const globalRuns = globalThis as unknown as { recebefacilReconciledAt?: Map<string, number> };

// Abrir A receber confere o Asaas em segundo plano, no máximo uma vez a cada 10 minutos por empresa.
export async function reconcileAsaasThrottled(db: DB, organizationId: string, now: Date = new Date()): Promise<ReconcileReport | null> {
  const runs = (globalRuns.recebefacilReconciledAt ??= new Map());
  if (now.getTime() - (runs.get(organizationId) ?? 0) < THROTTLE_MS) return null;
  runs.set(organizationId, now.getTime());
  return reconcileAsaas(db, now, { organizationId });
}

type ManualReceipt = { chargeId: string; amountCents: number; feeCents?: number; paidOn: string; method: string; note: string; idempotencyKey?: string };

function warningFor(error: unknown): string {
  const detail = error instanceof AsaasError ? ` ${error.message}` : "";
  return `Recebimento registrado, mas o Asaas não foi avisado e pode continuar cobrando seu cliente.${detail}`;
}

// "Recebi" numa cobrança do Asaas: o recebimento local vem primeiro e vale sozinho. Avisar o Asaas só serve para ele parar de cobrar.
export async function receiveManually(db: DB, organizationId: string, input: ManualReceipt, fetchImpl?: typeof fetch): Promise<{ paymentId: string; warning: string | null }> {
  const [charge] = await db.select().from(charges).where(and(eq(charges.organizationId, organizationId), eq(charges.id, input.chargeId)));
  const link = charge?.asaasPaymentId ?? null;
  const register = (idempotencyKey: string | undefined) =>
    registerPayment(db, organizationId, { ...input, amountCents: cents(input.amountCents), feeCents: cents(input.feeCents ?? 0), idempotencyKey });
  if (!link) return { paymentId: await register(input.idempotencyKey), warning: null };

  const paymentId = await register(asaasCashKey(link));
  const [after] = await db.select().from(charges).where(eq(charges.id, input.chargeId));
  const settled = Boolean(after) && after.paidCents >= after.amountCents;
  let warning: string | null = null;
  try {
    const { client } = await platformClient(db, fetchImpl);
    if (settled) {
      await client.receiveInCash(link, cents(input.amountCents + (input.feeCents ?? 0)), input.paidOn);
    } else {
      // Recebimento parcial muda o saldo: a cobrança antiga, com o valor velho, não pode mais ser paga.
      await client.deletePayment(link).catch((error: unknown) => {
        if (!(error instanceof AsaasError && error.kind === "notfound")) throw error;
      });
    }
  } catch (error) {
    warning = warningFor(error);
    logWarning("asaas.recebi", error);
  }
  if (!settled) await dropLink(db, input.chargeId);
  return { paymentId, warning };
}

// Desfazer um recebimento em dinheiro avisa o Asaas, que volta a cobrar. O que o Asaas recebeu de verdade só se desfaz aqui.
export async function reverseWithAsaas(db: DB, organizationId: string, chargeId: string, fetchImpl?: typeof fetch): Promise<{ warning: string | null }> {
  const cash = await db
    .select({ key: payments.idempotencyKey })
    .from(payments)
    .where(and(eq(payments.organizationId, organizationId), eq(payments.chargeId, chargeId), isNull(payments.reversedAt), like(payments.idempotencyKey, `asaas:%${CASH_SUFFIX}`)));
  await reverseCharge(db, organizationId, chargeId);
  if (cash.length === 0) return { warning: null };
  let warning: string | null = null;
  try {
    const { client } = await platformClient(db, fetchImpl);
    for (const { key } of cash) {
      await client.undoReceivedInCash((key ?? "").slice("asaas:".length, -CASH_SUFFIX.length));
    }
  } catch (error) {
    warning = `Recebimento desfeito, mas o Asaas não foi avisado e ainda pode considerar a cobrança como paga.${error instanceof AsaasError ? ` ${error.message}` : ""}`;
    logWarning("asaas.desfazer", error);
  }
  return { warning };
}
