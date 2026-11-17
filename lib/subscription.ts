import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { AsaasError, customerContact, isAsaasUrl, stageOf, subscriptionLive, type AsaasClient, type AsaasPayment, type AsaasSubscription } from "./asaas";
import { loadSubscription, PLAN_LABEL, planPriceCents, type PlanCode, type SubscriptionRow, type SubscriptionStatus } from "./billing";
import { addPeriod, todayIn } from "./dates";
import type { DB } from "./db";
import { documentKind, onlyDigits } from "./documents";
import { DomainError } from "./errors";
import { maskDocument } from "./masks";
import { cents } from "./money";
import { loadPlatformSettings, platformClientFor, platformReady, type PlatformSettingsRow } from "./platform-settings";
import { organizations, platformInvoices, subscriptions, type InvoiceStatus } from "./schema";

export const subscriptionReference = (organizationId: string) => `sub:${organizationId}`;
const descriptionOf = (planCode: PlanCode) => `RecebeFácil plano ${PLAN_LABEL[planCode]}`;

const UNAVAILABLE = "Pagamento da assinatura ainda indisponível. Fale com o suporte.";
const PAYING: readonly SubscriptionStatus[] = ["aguardando_pagamento", "inadimplente"];

export type SubscriptionDeps = { fetch?: typeof fetch; now?: Date };

// Cada fatura do Asaas cobre um mês a partir do vencimento. O fim do período é o fim da última fatura paga.
export function paidPeriodEnd(invoices: { status: InvoiceStatus; dueOn: string }[]): string | null {
  const ends = invoices.filter((invoice) => invoice.status === "paga").map((invoice) => addPeriod(invoice.dueOn, "mensal", 1));
  return ends.length > 0 ? ends.sort().at(-1) ?? null : null;
}

// A situação que segue uma fatura lida no Asaas. Cancelada só deixa de ser cancelada por uma nova contratação.
export function standingAfter(current: SubscriptionStatus, remoteStatus: string, covered: boolean): SubscriptionStatus {
  if (current === "cancelada") return current;
  const stage = stageOf(remoteStatus);
  if (stage === "paid") return "ativa";
  if (remoteStatus === "OVERDUE") return "inadimplente";
  if (covered) return "ativa";
  if (stage === "dead") return "inadimplente";
  return current === "ativa" ? "inadimplente" : current;
}

function invoiceStatusOf(remote: AsaasPayment): InvoiceStatus {
  if (remote.deleted) return "cancelada";
  const stage = stageOf(remote.status);
  if (stage === "paid") return "paga";
  if (stage === "dead") return "estornada";
  return remote.status === "OVERDUE" ? "vencida" : "aberta";
}

// A fatura do Asaas vira no máximo uma linha local, e o mesmo evento repetido deixa tudo como estava.
export async function applyPayment(db: DB, organizationId: string, remote: AsaasPayment, now: Date): Promise<void> {
  await db.transaction(async (transaction) => {
    const tx = transaction as DB;
    const [sub] = await tx.select().from(subscriptions).where(eq(subscriptions.organizationId, organizationId)).for("update");
    if (!sub) return;
    const [org] = await tx.select({ timezone: organizations.timezone }).from(organizations).where(eq(organizations.id, organizationId));
    const today = todayIn(org?.timezone ?? "America/Sao_Paulo", now);
    const status = invoiceStatusOf(remote);
    const values = {
      status,
      amountCents: remote.valueCents,
      dueOn: remote.dueDate ?? today,
      paidOn: status === "paga" ? remote.paidOn ?? today : null,
      invoiceUrl: remote.invoiceUrl && isAsaasUrl(remote.invoiceUrl) ? remote.invoiceUrl : null,
    };
    const [known] = await tx.select({ id: platformInvoices.id }).from(platformInvoices).where(eq(platformInvoices.asaasPaymentId, remote.id));
    if (known) await tx.update(platformInvoices).set(values).where(eq(platformInvoices.id, known.id));
    else await tx.insert(platformInvoices).values({ id: randomUUID(), organizationId, subscriptionId: sub.id, asaasPaymentId: remote.id, ...values });

    const invoices = await tx.select().from(platformInvoices).where(eq(platformInvoices.subscriptionId, sub.id));
    const paidEnd = paidPeriodEnd(invoices);
    await tx
      .update(subscriptions)
      .set({ periodEndsOn: paidEnd ?? sub.trialEndsOn, status: standingAfter(sub.status, remote.status, paidEnd !== null && paidEnd >= today) })
      .where(eq(subscriptions.id, sub.id));
  });
}

// Fatura apagada no Asaas deixa de aparecer como aberta. Pagamento já feito fica no histórico.
export async function forgetInvoice(db: DB, paymentId: string): Promise<void> {
  await db
    .update(platformInvoices)
    .set({ status: "cancelada" })
    .where(and(eq(platformInvoices.asaasPaymentId, paymentId), inArray(platformInvoices.status, ["aberta", "vencida"])));
}

// A assinatura acabou no Asaas. O acesso segue até o fim do que já foi pago. Aviso de uma assinatura antiga, já trocada, não mexe na atual.
export async function closeSubscription(db: DB, asaasSubscriptionId: string, remote: AsaasSubscription | null): Promise<void> {
  if (remote && subscriptionLive(remote)) return;
  await db.transaction(async (transaction) => {
    const tx = transaction as DB;
    const [sub] = await tx.select().from(subscriptions).where(eq(subscriptions.asaasSubscriptionId, asaasSubscriptionId)).for("update");
    if (!sub) return;
    await tx.update(subscriptions).set({ status: "cancelada" }).where(eq(subscriptions.id, sub.id));
    await tx
      .update(platformInvoices)
      .set({ status: "cancelada" })
      .where(and(eq(platformInvoices.subscriptionId, sub.id), inArray(platformInvoices.status, ["aberta", "vencida"])));
  });
}

// O Asaas conta o dia em Brasília: um vencimento de hoje em fuso mais a oeste pode já ser passado lá.
function asaasToday(timezone: string, now: Date): string {
  return [todayIn(timezone, now), todayIn("America/Sao_Paulo", now)].sort().at(-1) ?? todayIn(timezone, now);
}

async function companyDocument(db: DB, org: typeof organizations.$inferSelect, given: string | undefined): Promise<string> {
  if (documentKind(org.document)) return org.document;
  const typed = (given ?? "").trim();
  const kind = documentKind(typed);
  if (!kind) throw new DomainError(typed ? "CPF ou CNPJ inválido. Confira os números." : "Informe o CPF ou CNPJ da empresa para gerar a cobrança.");
  const document = maskDocument(typed, kind);
  await db.update(organizations).set({ document }).where(eq(organizations.id, org.id));
  return document;
}

async function customerOf(db: DB, asaas: AsaasClient, org: typeof organizations.$inferSelect, document: string): Promise<string> {
  if (org.asaasCustomerId) return org.asaasCustomerId;
  const id = await asaas.findOrCreateCustomer({ name: org.legalName || org.tradeName, cpfCnpj: onlyDigits(document), ...customerContact(org.email, org.phone) });
  await db.update(organizations).set({ asaasCustomerId: id }).where(eq(organizations.id, org.id));
  return id;
}

// Se uma tentativa anterior criou a assinatura no Asaas e caiu antes de gravar aqui, ela é adotada em vez de duplicada.
async function remoteSubscriptionFor(asaas: AsaasClient, org: typeof organizations.$inferSelect, customer: string, planCode: PlanCode, valueCents: number, nextDueDate: string): Promise<AsaasSubscription> {
  const reference = subscriptionReference(org.id);
  const alive = (await asaas.findSubscriptions(reference)).find(subscriptionLive);
  if (alive) return alive.valueCents === valueCents ? alive : asaas.updateSubscription(alive.id, { valueCents: cents(valueCents), description: descriptionOf(planCode) });
  return asaas.createSubscription({ customer, valueCents: cents(valueCents), nextDueDate, description: descriptionOf(planCode), externalReference: reference });
}

// A fatura em aberta mais antiga é a que o lojista precisa pagar agora.
async function openInvoiceUrl(db: DB, asaas: AsaasClient, organizationId: string, asaasSubscriptionId: string, now: Date): Promise<string> {
  const payments = await asaas.listSubscriptionPayments(asaasSubscriptionId);
  const open = payments
    .filter((payment) => !payment.deleted && stageOf(payment.status) === "open")
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))[0];
  if (!open) throw new AsaasError("response", "A fatura da assinatura ainda não ficou pronta. Tente de novo em instantes.");
  await applyPayment(db, organizationId, open, now);
  if (!open.invoiceUrl || !isAsaasUrl(open.invoiceUrl)) throw new AsaasError("response", "O Asaas não devolveu o link da fatura. Tente de novo.");
  return open.invoiceUrl;
}

export type PlanChoice = { kind: "pay"; invoiceUrl: string } | { kind: "changed" };

type Context = { org: typeof organizations.$inferSelect; sub: SubscriptionRow; settings: PlatformSettingsRow; asaas: AsaasClient; now: Date };

async function contextFor(db: DB, organizationId: string, deps: SubscriptionDeps): Promise<Context> {
  const now = deps.now ?? new Date();
  const [org] = await db.select().from(organizations).where(eq(organizations.id, organizationId));
  if (!org) throw new DomainError("Empresa não encontrada.");
  const sub = await loadSubscription(db, org, now);
  if (!sub) throw new DomainError("A demonstração não tem plano. Entre com a sua conta para assinar.");
  const settings = await loadPlatformSettings(db);
  if (!platformReady(settings)) throw new DomainError(UNAVAILABLE);
  return { org, sub, settings, asaas: platformClientFor(settings, deps.fetch), now };
}

// Contratar cria a assinatura mensal no Asaas e devolve o link da primeira fatura. Quem já tem assinatura viva só troca de plano.
export async function choosePlan(db: DB, organizationId: string, planCode: PlanCode, input: { document?: string }, deps: SubscriptionDeps = {}): Promise<PlanChoice> {
  const { org, sub, settings, asaas, now } = await contextFor(db, organizationId, deps);
  const valueCents = planPriceCents(settings, planCode);
  if (valueCents <= 0) throw new DomainError(UNAVAILABLE);

  if (sub.asaasSubscriptionId && sub.status !== "cancelada") {
    if (planCode !== sub.planCode) {
      await asaas.updateSubscription(sub.asaasSubscriptionId, { valueCents: cents(valueCents), description: descriptionOf(planCode) });
      await db.update(subscriptions).set({ planCode }).where(eq(subscriptions.id, sub.id));
    } else if (!PAYING.includes(sub.status)) {
      throw new DomainError(`Você já está no plano ${PLAN_LABEL[planCode]}.`);
    }
    if (!PAYING.includes(sub.status)) return { kind: "changed" };
    return { kind: "pay", invoiceUrl: await openInvoiceUrl(db, asaas, org.id, sub.asaasSubscriptionId, now) };
  }

  const document = await companyDocument(db, org, input.document);
  // Quem cancelou e volta antes do fim do período pago só começa a pagar quando ele acaba, para não pagar duas vezes o mesmo mês.
  const today = asaasToday(org.timezone, now);
  const firstDue = sub.status === "cancelada" && sub.periodEndsOn > today ? sub.periodEndsOn : today;
  // Dois cliques seguidos em Contratar não podem criar duas assinaturas: a linha fica travada até a assinatura do Asaas estar gravada.
  const asaasId = await db.transaction(async (transaction) => {
    const tx = transaction as DB;
    const [locked] = await tx.select().from(subscriptions).where(eq(subscriptions.id, sub.id)).for("update");
    if (locked?.asaasSubscriptionId && locked.status !== "cancelada") return locked.asaasSubscriptionId;
    const customer = await customerOf(tx, asaas, org, document);
    const remote = await remoteSubscriptionFor(asaas, org, customer, planCode, valueCents, firstDue);
    await tx.update(subscriptions).set({ planCode, status: "aguardando_pagamento", asaasSubscriptionId: remote.id }).where(eq(subscriptions.id, sub.id));
    return remote.id;
  });
  return { kind: "pay", invoiceUrl: await openInvoiceUrl(db, asaas, org.id, asaasId, now) };
}

// Cancelar apaga a assinatura no Asaas, mas o plano segue valendo até o fim do período pago.
export async function cancelPlan(db: DB, organizationId: string, deps: SubscriptionDeps = {}): Promise<void> {
  const { sub, asaas } = await contextFor(db, organizationId, deps);
  if (!sub.asaasSubscriptionId || sub.status === "cancelada") throw new DomainError("Você não tem uma assinatura para cancelar.");
  try {
    await asaas.deleteSubscription(sub.asaasSubscriptionId);
  } catch (error) {
    if (!(error instanceof AsaasError && error.kind === "notfound")) throw error;
  }
  await closeSubscription(db, sub.asaasSubscriptionId, null);
}

// Quem volta do Asaas depois de pagar vê o plano ativo sem esperar o webhook, e um webhook perdido se corrige sozinho.
export async function syncSubscription(db: DB, organizationId: string, deps: SubscriptionDeps = {}): Promise<boolean> {
  const now = deps.now ?? new Date();
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.organizationId, organizationId));
  if (!sub?.asaasSubscriptionId || !PAYING.includes(sub.status)) return false;
  const settings = await loadPlatformSettings(db);
  if (!platformReady(settings)) return false;
  const payments = await platformClientFor(settings, deps.fetch).listSubscriptionPayments(sub.asaasSubscriptionId);
  for (const payment of payments.sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))) await applyPayment(db, organizationId, payment, now);
  return true;
}
