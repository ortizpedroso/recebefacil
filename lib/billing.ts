import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { shiftDays } from "./dates";
import type { DB } from "./db";
import { DomainError } from "./ledger";
import { cents, type Cents } from "./money";
import { platformInvoices, subscriptions } from "./schema";

export const plans = {
  essencial: { label: "Essencial", priceCents: 9_900 },
  profissional: { label: "Profissional", priceCents: 19_900 },
  empresa: { label: "Empresa", priceCents: 39_900 },
} as const;

export type PlanCode = keyof typeof plans;

export function isPlan(value: string): value is PlanCode {
  return value in plans;
}

export async function ensureSubscription(db: DB, organizationId: string, today: string) {
  const [existing] = await db.select().from(subscriptions).where(eq(subscriptions.organizationId, organizationId));
  if (existing) return existing;
  const id = randomUUID();
  await db.insert(subscriptions).values({
    id,
    organizationId,
    planCode: "essencial",
    status: "trial",
    trialEndsOn: shiftDays(today, 14),
    periodEndsOn: shiftDays(today, 14),
  });
  const [created] = await db.select().from(subscriptions).where(eq(subscriptions.id, id));
  if (!created) throw new Error("Assinatura indisponível.");
  return created;
}

export async function subscribe(db: DB, organizationId: string, planCode: PlanCode, today: string) {
  const subscription = await ensureSubscription(db, organizationId, today);
  const periodEndsOn = shiftDays(today, 30);
  await db.update(subscriptions).set({ planCode, status: "ativa", periodEndsOn }).where(eq(subscriptions.id, subscription.id));
  const invoiceId = randomUUID();
  await db.insert(platformInvoices).values({
    id: invoiceId,
    organizationId,
    subscriptionId: subscription.id,
    amountCents: plans[planCode].priceCents,
    status: "aberta",
    dueOn: today,
    paidOn: null,
  });
  return invoiceId;
}

export async function payPlatformInvoice(db: DB, organizationId: string, invoiceId: string, today: string) {
  const [invoice] = await db.select().from(platformInvoices).where(eq(platformInvoices.id, invoiceId));
  if (!invoice || invoice.organizationId !== organizationId) throw new DomainError("Fatura não encontrada.");
  if (invoice.status === "paga") return;
  await db.update(platformInvoices).set({ status: "paga", paidOn: today }).where(eq(platformInvoices.id, invoiceId));
  await db.update(subscriptions).set({ status: "ativa", periodEndsOn: shiftDays(today, 30) }).where(eq(subscriptions.id, invoice.subscriptionId));
}

export function planPrice(planCode: string): Cents {
  if (!isPlan(planCode)) return cents(0);
  return cents(plans[planCode].priceCents);
}
