import { eq } from "drizzle-orm";
import { z } from "zod";
import { AsaasError, stageOf, type AsaasClient, type AsaasPayment } from "./asaas";
import { forgetLink, settleFromAsaas, undoFromAsaas } from "./asaas-settle";
import type { DB } from "./db";
import { logError } from "./log";
import { checkWebhookToken, loadPlatformSettings, platformClientFor } from "./platform-settings";
import { asaasWebhookEvents } from "./schema";

export const MAX_WEBHOOK_BYTES = 512 * 1024;

// O que cada evento do Asaas faz. "keep" é de propósito: a cobrança vencida continua viva e a próxima visita decide se a troca.
export type PaymentEffect = "settle" | "undo" | "forget" | "keep";

export const PAYMENT_EVENTS: Record<string, PaymentEffect> = {
  PAYMENT_RECEIVED: "settle",
  PAYMENT_CONFIRMED: "settle",
  PAYMENT_REFUNDED: "undo",
  PAYMENT_CHARGEBACK_REQUESTED: "undo",
  PAYMENT_CHARGEBACK_DISPUTE: "undo",
  PAYMENT_AWAITING_CHARGEBACK_REVERSAL: "undo",
  PAYMENT_RECEIVED_IN_CASH_UNDONE: "undo",
  PAYMENT_DELETED: "forget",
  PAYMENT_OVERDUE: "keep",
};

// A tela do dono mostra esta lista: só os eventos que mudam alguma coisa precisam ser ligados no Asaas.
export const WEBHOOK_EVENTS_TO_ENABLE: string[] = Object.entries(PAYMENT_EVENTS)
  .filter(([, effect]) => effect !== "keep")
  .map(([name]) => name);

export type PaymentContext = {
  db: DB;
  effect: PaymentEffect;
  event: string;
  paymentId: string;
  // Lida de novo no Asaas para settle e undo. O corpo do webhook nunca decide o que foi pago.
  remote: AsaasPayment | null;
  now: Date;
};

// Cada rota cuida de um tipo de cobrança, escolhido pelo começo do externalReference.
// A unidade de assinaturas acrescenta aqui { prefix: "sub:", handle }. Sem rota para um prefixo reservado, o evento é ignorado.
export type PaymentRoute = { prefix: string | null; handle(context: PaymentContext): Promise<void> };

export const RESERVED_PREFIXES = ["sub:"];

export const chargeRoute: PaymentRoute = {
  prefix: null,
  async handle({ db, effect, paymentId, remote, now }) {
    if (effect === "settle" && remote && stageOf(remote.status) === "paid") await settleFromAsaas(db, remote, now);
    if (effect === "undo" && remote) await undoFromAsaas(db, remote);
    if (effect === "forget") await forgetLink(db, paymentId);
  },
};

export const PAYMENT_ROUTES: PaymentRoute[] = [chargeRoute];

export function routeFor(reference: string | null | undefined): PaymentRoute | null {
  const prefixed = PAYMENT_ROUTES.find((route) => route.prefix !== null && (reference ?? "").startsWith(route.prefix));
  if (prefixed) return prefixed;
  if (RESERVED_PREFIXES.some((prefix) => (reference ?? "").startsWith(prefix))) return null;
  return PAYMENT_ROUTES.find((route) => route.prefix === null) ?? null;
}

const bodySchema = z.object({
  id: z.string().min(1).max(200),
  event: z.string().min(1).max(100),
  payment: z.object({ id: z.string().min(1), externalReference: z.string().nullish() }).optional(),
});

const reply = (status: number, body: Record<string, string>) => Response.json(body, { status });

async function readCapped(request: Request, max: number): Promise<string | null> {
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export type WebhookDeps = { db: DB; fetch?: typeof fetch; now?: Date };

// Ordem de defesa: token (sem ler o corpo), tamanho, formato, duplicidade. O evento só é gravado junto com o efeito dele, na mesma transação.
export async function handleAsaasWebhook(request: Request, deps: WebhookDeps): Promise<Response> {
  const { db } = deps;
  const settings = await loadPlatformSettings(db);
  const check = checkWebhookToken(settings, request.headers.get("asaas-access-token") ?? "");
  if (check === "unconfigured") return reply(503, { error: "Webhook não configurado." });
  if (check === "mismatch") return reply(401, { error: "Token inválido." });

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_WEBHOOK_BYTES) return reply(413, { error: "Corpo grande demais." });
  const raw = await readCapped(request, MAX_WEBHOOK_BYTES);
  if (raw === null) return reply(413, { error: "Corpo grande demais." });

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(JSON.parse(raw));
  } catch {
    return reply(400, { error: "Corpo inválido." });
  }

  const effect = PAYMENT_EVENTS[parsed.event];
  if (!effect || !parsed.payment) return reply(200, { status: "ignorado" });

  const [seen] = await db.select({ id: asaasWebhookEvents.id }).from(asaasWebhookEvents).where(eq(asaasWebhookEvents.id, parsed.id));
  if (seen) return reply(200, { status: "duplicado" });

  const now = deps.now ?? new Date();
  const paymentId = parsed.payment.id;
  try {
    let remote: AsaasPayment | null = null;
    if (effect === "settle" || effect === "undo") {
      const client: AsaasClient = platformClientFor(settings, deps.fetch);
      try {
        remote = await client.getPayment(paymentId);
      } catch (error) {
        if (error instanceof AsaasError && error.kind === "notfound") return reply(200, { status: "ignorado" });
        throw error;
      }
    }
    const route = routeFor(remote?.externalReference ?? parsed.payment.externalReference);
    if (!route) return reply(200, { status: "ignorado" });
    const outcome = await db.transaction(async (transaction) => {
      const tx = transaction as DB;
      const [inserted] = await tx
        .insert(asaasWebhookEvents)
        .values({ id: parsed.id, event: parsed.event, paymentId, receivedAt: now.toISOString(), processedAt: null })
        .onConflictDoNothing()
        .returning({ id: asaasWebhookEvents.id });
      if (!inserted) return "duplicado";
      await route.handle({ db: tx, effect, event: parsed.event, paymentId, remote, now });
      await tx.update(asaasWebhookEvents).set({ processedAt: new Date().toISOString() }).where(eq(asaasWebhookEvents.id, parsed.id));
      return "ok";
    });
    return reply(200, { status: outcome });
  } catch (error) {
    // A transação desfeita leva o registro do evento junto, então o Asaas reenvia e o evento é processado do zero.
    await logError(db, null, "webhook.asaas", error);
    return reply(503, { error: "Não foi possível processar agora. Tente de novo." });
  }
}
