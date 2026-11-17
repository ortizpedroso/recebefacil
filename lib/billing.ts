import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { daysBetween, formatDateBR, shiftDays, todayIn } from "./dates";
import type { DB } from "./db";
import { DomainError } from "./errors";
import { PUBLIC_DEMO_KEY } from "./onboarding";
import { organizations, subscriptions, type PlanCode } from "./schema";

export type { InvoiceStatus, PlanCode, SubscriptionStatus } from "./schema";

export const TRIAL_DAYS = 14;
const TRIAL_WARNING_DAYS = 3;

export const PLAN_CODES: readonly PlanCode[] = ["gestao", "integrado"];
export const PLAN_LABEL: Record<PlanCode, string> = { gestao: "Gestão", integrado: "Integrado" };

export function isPlan(value: string): value is PlanCode {
  return (PLAN_CODES as readonly string[]).includes(value);
}

export type PlanPrices = { planGestaoCents: number; planIntegradoCents: number };

export function planPriceCents(prices: PlanPrices, code: PlanCode): number {
  return code === "integrado" ? prices.planIntegradoCents : prices.planGestaoCents;
}

export type SubscriptionRow = typeof subscriptions.$inferSelect;
type Standing = Pick<SubscriptionRow, "status" | "trialEndsOn" | "periodEndsOn">;

export type AccessState = "teste" | "ativa" | "aguardando" | "inadimplente" | "cancelada" | "expirada";

export const STATE_LABEL: Record<AccessState, string> = {
  teste: "Em teste grátis",
  ativa: "Ativa",
  aguardando: "Aguardando pagamento",
  inadimplente: "Em atraso",
  cancelada: "Cancelada",
  expirada: "Teste encerrado",
};

export type Access = { state: AccessState; canSell: boolean; daysLeft?: number; banner?: string };

// A demonstração pública não assina nada: vende sempre.
export const OPEN_ACCESS: Access = { state: "ativa", canSell: true };

function when(days: number): string {
  if (days === 0) return "hoje";
  if (days === 1) return "amanhã";
  return `em ${days} dias`;
}

// Só criar venda e cobrança depende disto. O acesso vale até o fim do que foi pago (ou do teste), seja qual for a situação.
export function accessFor(subscription: Standing, today: string): Access {
  const until = subscription.periodEndsOn > subscription.trialEndsOn ? subscription.periodEndsOn : subscription.trialEndsOn;
  const live = today <= until;
  const daysLeft = live ? daysBetween(today, until) : undefined;
  const end = formatDateBR(until);
  const grant = (state: AccessState, banner?: string): Access => ({ state, canSell: true, daysLeft, ...(banner ? { banner } : {}) });
  const block = (state: AccessState, banner: string): Access => ({ state, canSell: false, banner });

  switch (subscription.status) {
    case "teste":
      if (!live) return block("expirada", "Seu teste grátis terminou. Escolha um plano para continuar fazendo vendas e cobranças.");
      return grant("teste", (daysLeft ?? 0) <= TRIAL_WARNING_DAYS ? `Seu teste grátis termina ${when(daysLeft ?? 0)}. Escolha um plano para continuar vendendo.` : undefined);
    case "aguardando_pagamento":
      return live
        ? grant("aguardando", "Falta pagar a primeira mensalidade para ativar o seu plano.")
        : block("aguardando", "O teste grátis terminou e a primeira mensalidade ainda não foi paga. Pague para voltar a vender.");
    case "ativa":
      if (live) return grant("ativa");
      return block("inadimplente", "A mensalidade do seu plano venceu e ainda não foi paga. Novas vendas e cobranças ficam pausadas até o pagamento.");
    case "inadimplente":
      return live
        ? grant("inadimplente", `A mensalidade do seu plano está em atraso. Pague até ${end} para continuar vendendo.`)
        : block("inadimplente", "A mensalidade do seu plano está em atraso. Novas vendas e cobranças ficam pausadas até o pagamento.");
    case "cancelada":
      return live
        ? grant("cancelada", `Seu plano foi cancelado e vale até ${end}. Depois disso não dá para criar novas vendas.`)
        : block("cancelada", "Seu plano terminou. Escolha um plano para voltar a criar vendas e cobranças.");
  }
}

// Receber pelo Asaas vale durante o teste ou no plano Integrado em dia. Quem escolheu Gestão fica de fora.
export function canReceiveOnline(subscription: Standing & { planCode: PlanCode }, today: string): boolean {
  const access = accessFor(subscription, today);
  return access.state === "teste" || (access.canSell && subscription.planCode === "integrado");
}

type OrgRef = { id: string; viewerKey: string; timezone: string };

export async function startTrial(db: DB, organizationId: string, today: string): Promise<void> {
  const trialEndsOn = shiftDays(today, TRIAL_DAYS);
  await db
    .insert(subscriptions)
    .values({ id: randomUUID(), organizationId, planCode: "gestao", status: "teste", trialEndsOn, periodEndsOn: trialEndsOn })
    .onConflictDoNothing();
}

// Toda empresa de verdade tem assinatura: quem nasceu antes dos planos ganha o teste na primeira leitura.
export async function loadSubscription(db: DB, org: OrgRef, now: Date = new Date()): Promise<SubscriptionRow | null> {
  if (org.viewerKey === PUBLIC_DEMO_KEY) return null;
  const read = async () => (await db.select().from(subscriptions).where(eq(subscriptions.organizationId, org.id)))[0];
  const existing = await read();
  if (existing) return existing;
  await startTrial(db, org.id, todayIn(org.timezone, now));
  return (await read()) ?? null;
}

export async function loadAccess(db: DB, org: OrgRef, now: Date = new Date()): Promise<{ subscription: SubscriptionRow | null; access: Access; today: string }> {
  const today = todayIn(org.timezone, now);
  const subscription = await loadSubscription(db, org, now);
  return { subscription, access: subscription ? accessFor(subscription, today) : OPEN_ACCESS, today };
}

export async function assertCanSell(db: DB, org: OrgRef, now?: Date): Promise<void> {
  const { access } = await loadAccess(db, org, now);
  if (!access.canSell) throw new DomainError(access.banner ?? "Escolha um plano para continuar vendendo.");
}

export async function canReceiveOnlineNow(db: DB, org: OrgRef, now?: Date): Promise<boolean> {
  const { subscription, today } = await loadAccess(db, org, now);
  return subscription ? canReceiveOnline(subscription, today) : false;
}

// Cobrança que já tem pagamento no Asaas segue valendo mesmo que o plano tenha caído: o cliente pode já ter pago.
export async function onlineAllowed(db: DB, org: OrgRef, charge: { asaasPaymentId: string | null }, now?: Date): Promise<boolean> {
  return Boolean(charge.asaasPaymentId) || canReceiveOnlineNow(db, org, now);
}

export const ONLINE_NEEDS_PLAN = "O modo Integrado faz parte do plano Integrado. Escolha esse plano em Plano para receber pelo Asaas.";

export async function assertCanReceiveOnline(db: DB, organizationId: string, now?: Date): Promise<void> {
  const [org] = await db.select().from(organizations).where(eq(organizations.id, organizationId));
  if (!org || !(await canReceiveOnlineNow(db, org, now))) throw new DomainError(ONLINE_NEEDS_PLAN);
}

export type SubscriberRow = { organizationId: string; company: string; planCode: PlanCode; state: AccessState; dueOn: string };

export async function listSubscribers(db: DB, today: string): Promise<SubscriberRow[]> {
  const rows = await db
    .select({ organizationId: organizations.id, company: organizations.tradeName, subscription: subscriptions })
    .from(subscriptions)
    .innerJoin(organizations, eq(organizations.id, subscriptions.organizationId))
    .orderBy(asc(organizations.tradeName))
    .limit(500);
  return rows.map(({ organizationId, company, subscription }) => ({
    organizationId,
    company,
    planCode: subscription.planCode,
    state: accessFor(subscription, today).state,
    dueOn: subscription.status === "teste" ? subscription.trialEndsOn : subscription.periodEndsOn,
  }));
}
