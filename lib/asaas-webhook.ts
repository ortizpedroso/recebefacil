import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { DB } from "./db";
import { registerPayment } from "./ledger";
import { cents } from "./money";
import { charges, organizations, webhookEvents } from "./schema";
import { tokenHash } from "./secrets";

type PaymentNotice = {
  id?: string;
  event?: string;
  payment?: {
    id?: string;
    externalReference?: string | null;
    value?: number;
    billingType?: string;
    paymentDate?: string | null;
    clientPaymentDate?: string | null;
  };
};

const paidEvents = new Set(["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"]);

const methods: Record<string, string> = {
  PIX: "Pix",
  BOLETO: "Boleto",
  CREDIT_CARD: "Cartão de crédito",
};

export async function applyAsaasWebhook(db: DB, token: string, body: PaymentNotice) {
  const [org] = await db.select().from(organizations).where(eq(organizations.asaasWebhookHash, tokenHash(token)));
  if (!org) return { status: 401 as const, body: { ok: false } };
  const eventId = body.id || "";
  const payment = body.payment;
  if (!eventId || !payment?.id || !paidEvents.has(body.event || "")) return { status: 200 as const, body: { ok: true, ignored: true } };
  const [seen] = await db.select().from(webhookEvents).where(eq(webhookEvents.eventId, eventId));
  if (seen) return { status: 200 as const, body: { ok: true, duplicate: true } };
  const chargeId = payment.externalReference || "";
  const [charge] = await db.select().from(charges).where(eq(charges.id, chargeId));
  if (!charge || charge.organizationId !== org.id) return { status: 200 as const, body: { ok: true, ignored: true } };
  const amountCents = cents(Math.round(Number(payment.value) * 100));
  const paidOn = (payment.clientPaymentDate || payment.paymentDate || new Date().toISOString()).slice(0, 10);
  await registerPayment(db, org.id, {
    chargeId: charge.id,
    amountCents,
    paidOn,
    method: methods[payment.billingType || ""] || charge.method,
    note: `Asaas ${payment.id}`,
    idempotencyKey: `asaas:${payment.id}`,
  });
  await db.insert(webhookEvents).values({
    id: randomUUID(),
    organizationId: org.id,
    eventId,
    createdAt: new Date().toISOString(),
  });
  return { status: 200 as const, body: { ok: true } };
}
