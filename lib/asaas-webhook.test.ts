process.env.RECEBEFACIL_SECRET = "p".repeat(40);

import assert from "node:assert/strict";
import test from "node:test";
import { and, eq } from "drizzle-orm";
import { startCheckout } from "./asaas-checkout";
import { reconcileAsaas, reconcileAsaasThrottled, receiveManually, reverseWithAsaas } from "./asaas-settle";
import { handleAsaasWebhook, PAYMENT_ROUTES, WEBHOOK_EVENTS_TO_ENABLE, type PaymentRoute } from "./asaas-webhook";
import { asaasWebhookEvents, charges, payments, platformSettings } from "./schema";
import { chargeRow, configurePlatform, fakeAsaas, integratedCharge, type FakeAsaas } from "./test-asaas";
import { testDatabase } from "./test-support";

const NOW = new Date("2026-11-17T15:00:00Z");

let shared: ReturnType<typeof testDatabase> | undefined;
let configured: Promise<string> | undefined;
async function database() {
  shared ??= testDatabase();
  const db = await shared;
  configured ??= configurePlatform(db);
  return { db, token: await configured };
}

function request(body: unknown, token: string | null, extra: Record<string, string> = {}) {
  const headers: Record<string, string> = { "content-type": "application/json", ...extra };
  if (token !== null) headers["asaas-access-token"] = token;
  return new Request("http://localhost/api/webhooks/asaas", { method: "POST", headers, body: typeof body === "string" ? body : JSON.stringify(body) });
}

let eventSequence = 0;
const event = (name: string, paymentId: string, extra: Record<string, unknown> = {}) => ({ id: `evt_${(eventSequence += 1)}`, event: name, payment: { id: paymentId, ...extra } });

async function liveCharge(options: Parameters<typeof integratedCharge>[2] & { id: string }, fake: FakeAsaas) {
  const { db } = await database();
  const created = await integratedCharge(db, options.id, options);
  await startCheckout(db, { chargeId: created.chargeId, method: "pix" }, { fetch: fake.fetch, now: NOW });
  const paymentId = (await chargeRow(db, created.chargeId)).asaasPaymentId ?? "";
  return { ...created, paymentId };
}

const paymentsOf = async (chargeId: string) => {
  const { db } = await database();
  return db.select().from(payments).where(eq(payments.chargeId, chargeId));
};

test("token errado dá 401 sem nem ler o corpo; sem token configurado dá 503", async () => {
  const { db, token } = await database();
  let pulled = false;
  const body = new ReadableStream({ pull(controller) { pulled = true; controller.close(); } }, { highWaterMark: 0 });
  const streaming = new Request("http://localhost/api/webhooks/asaas", { method: "POST", headers: { "asaas-access-token": "errado" }, body, duplex: "half" } as RequestInit);
  assert.equal((await handleAsaasWebhook(streaming, { db })).status, 401);
  assert.equal(pulled, false, "o corpo não foi lido antes de conferir o token");
  assert.equal((await handleAsaasWebhook(request(event("PAYMENT_RECEIVED", "pay_1"), null), { db })).status, 401);
  assert.equal((await handleAsaasWebhook(request(event("PAYMENT_RECEIVED", "pay_1"), `${token}x`), { db })).status, 401);

  const [{ asaasWebhookTokenEnc: saved }] = await db.select().from(platformSettings);
  await db.update(platformSettings).set({ asaasWebhookTokenEnc: "" });
  try {
    assert.equal((await handleAsaasWebhook(request(event("PAYMENT_RECEIVED", "pay_1"), token), { db })).status, 503);
  } finally {
    await db.update(platformSettings).set({ asaasWebhookTokenEnc: saved });
  }
});

test("PAYMENT_RECEIVED quita a cobrança: o principal vira recebimento e a multa e os juros viram taxa", async () => {
  const { db, token } = await database();
  const fake = fakeAsaas();
  const { chargeId, org, paymentId } = await liveCharge({ id: "org-recebido", dueOn: "2026-11-10" }, fake);
  assert.equal(fake.payments.get(paymentId)?.value, 102.23);
  fake.settle(paymentId, "RECEIVED", "2026-11-17");

  const response = await handleAsaasWebhook(request(event("PAYMENT_RECEIVED", paymentId), token), { db, fetch: fake.fetch, now: NOW });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok" });
  const [row] = await paymentsOf(chargeId);
  assert.equal(row.organizationId, org);
  assert.equal(row.amountCents, 10_000);
  assert.equal(row.feeCents, 223);
  assert.equal(row.method, "Pix");
  assert.equal(row.note, "Pago pelo Asaas");
  assert.equal(row.paidOn, "2026-11-17");
  assert.equal(row.idempotencyKey, `asaas:${paymentId}`);
  const charge = await chargeRow(db, chargeId);
  assert.equal(charge.status, "paga");
  assert.equal(charge.paidCents, 10_000);
});

test("o mesmo evento duas vezes dá 200 duplicado, e um evento novo da mesma cobrança paga não conta de novo", async () => {
  const { db, token } = await database();
  const fake = fakeAsaas();
  const { chargeId, paymentId } = await liveCharge({ id: "org-duplicado" }, fake);
  fake.settle(paymentId, "CONFIRMED");
  const first = event("PAYMENT_CONFIRMED", paymentId);
  assert.deepEqual(await (await handleAsaasWebhook(request(first, token), { db, fetch: fake.fetch, now: NOW })).json(), { status: "ok" });
  const again = await handleAsaasWebhook(request(first, token), { db, fetch: fake.fetch, now: NOW });
  assert.equal(again.status, 200);
  assert.deepEqual(await again.json(), { status: "duplicado" });
  const later = await handleAsaasWebhook(request(event("PAYMENT_RECEIVED", paymentId), token), { db, fetch: fake.fetch, now: NOW });
  assert.equal(later.status, 200);
  assert.equal((await paymentsOf(chargeId)).length, 1, "um recebimento só");
  assert.equal((await chargeRow(db, chargeId)).paidCents, 10_000);
  const stored = await db.select().from(asaasWebhookEvents).where(eq(asaasWebhookEvents.id, first.id));
  assert.equal(stored.length, 1);
  assert.ok(stored[0].processedAt);
});

test("o corpo do evento não manda: se o Asaas ainda diz PENDING, nada é recebido", async () => {
  const { db, token } = await database();
  const fake = fakeAsaas();
  const { chargeId, paymentId } = await liveCharge({ id: "org-falso" }, fake);
  const response = await handleAsaasWebhook(request(event("PAYMENT_RECEIVED", paymentId, { status: "RECEIVED", value: 100 }), token), { db, fetch: fake.fetch, now: NOW });
  assert.equal(response.status, 200);
  assert.equal((await paymentsOf(chargeId)).length, 0);
  assert.equal((await chargeRow(db, chargeId)).status, "pendente");
});

test("estorno desfaz só o recebimento do Asaas e solta a cobrança para um pagamento novo", async () => {
  const { db, token } = await database();
  const fake = fakeAsaas();
  const { chargeId, paymentId } = await liveCharge({ id: "org-estorno" }, fake);
  fake.settle(paymentId);
  await handleAsaasWebhook(request(event("PAYMENT_RECEIVED", paymentId), token), { db, fetch: fake.fetch, now: NOW });
  assert.equal((await chargeRow(db, chargeId)).status, "paga");

  fake.setStatus(paymentId, "REFUNDED");
  const response = await handleAsaasWebhook(request(event("PAYMENT_REFUNDED", paymentId), token), { db, fetch: fake.fetch, now: NOW });
  assert.equal(response.status, 200);
  const charge = await chargeRow(db, chargeId);
  assert.equal(charge.status, "pendente");
  assert.equal(charge.paidCents, 0);
  assert.equal(charge.asaasPaymentId, null, "cobrança estornada não volta a valer");
  const [row] = await paymentsOf(chargeId);
  assert.ok(row.reversedAt, "o recebimento ficou marcado como desfeito");
});

test("chargeback desfaz o recebimento, mas um evento velho com o Asaas ainda pago é ignorado", async () => {
  const { db, token } = await database();
  const fake = fakeAsaas();
  const { chargeId, paymentId } = await liveCharge({ id: "org-chargeback" }, fake);
  fake.settle(paymentId);
  await handleAsaasWebhook(request(event("PAYMENT_RECEIVED", paymentId), token), { db, fetch: fake.fetch, now: NOW });
  await handleAsaasWebhook(request(event("PAYMENT_CHARGEBACK_REQUESTED", paymentId), token), { db, fetch: fake.fetch, now: NOW });
  assert.equal((await chargeRow(db, chargeId)).status, "paga", "o Asaas ainda diz pago, então o evento está velho");
  fake.setStatus(paymentId, "CHARGEBACK_REQUESTED");
  await handleAsaasWebhook(request(event("PAYMENT_CHARGEBACK_DISPUTE", paymentId), token), { db, fetch: fake.fetch, now: NOW });
  assert.equal((await chargeRow(db, chargeId)).status, "pendente");
});

test("PAYMENT_DELETED solta o vínculo da cobrança e PAYMENT_OVERDUE mantém", async () => {
  const { db, token } = await database();
  const fake = fakeAsaas();
  const { chargeId, paymentId } = await liveCharge({ id: "org-apagada" }, fake);
  assert.equal((await handleAsaasWebhook(request(event("PAYMENT_OVERDUE", paymentId), token), { db, fetch: fake.fetch, now: NOW })).status, 200);
  assert.equal((await chargeRow(db, chargeId)).asaasPaymentId, paymentId);
  assert.equal((await handleAsaasWebhook(request(event("PAYMENT_DELETED", paymentId), token), { db, fetch: fake.fetch, now: NOW })).status, 200);
  assert.equal((await chargeRow(db, chargeId)).asaasPaymentId, null);
});

test("erro no processamento dá 503 e o evento não fica gravado, então o reenvio do Asaas funciona", async () => {
  const { db, token } = await database();
  const fake = fakeAsaas();
  const { chargeId, paymentId } = await liveCharge({ id: "org-erro-webhook" }, fake);
  fake.settle(paymentId);
  const failing = event("PAYMENT_RECEIVED", paymentId);
  fake.failNext("GET", /^\/payments\/pay_\d+$/, 500, 2);
  assert.equal((await handleAsaasWebhook(request(failing, token), { db, fetch: fake.fetch, now: NOW })).status, 503);
  assert.equal((await db.select().from(asaasWebhookEvents).where(eq(asaasWebhookEvents.id, failing.id))).length, 0);
  assert.equal((await paymentsOf(chargeId)).length, 0);
  assert.equal((await handleAsaasWebhook(request(failing, token), { db, fetch: fake.fetch, now: NOW })).status, 200);
  assert.equal((await chargeRow(db, chargeId)).status, "paga");
});

test("erro depois de gravar o evento, dentro da transação, desfaz o evento junto", async () => {
  const { db, token } = await database();
  const exploding: PaymentRoute = {
    prefix: "boom:",
    async handle() {
      throw new Error("falha de teste");
    },
  };
  PAYMENT_ROUTES.push(exploding);
  try {
    const fake = fakeAsaas();
    const { paymentId } = await liveCharge({ id: "org-boom" }, fake);
    fake.payments.get(paymentId)!.externalReference = "boom:1";
    const boom = event("PAYMENT_RECEIVED", paymentId);
    fake.settle(paymentId);
    assert.equal((await handleAsaasWebhook(request(boom, token), { db, fetch: fake.fetch, now: NOW })).status, 503);
    assert.equal((await db.select().from(asaasWebhookEvents).where(eq(asaasWebhookEvents.id, boom.id))).length, 0);
  } finally {
    PAYMENT_ROUTES.splice(PAYMENT_ROUTES.indexOf(exploding), 1);
  }
});

test("a tabela de rotas leva cobranças com prefixo reservado para fora das cobranças comuns", async () => {
  const { db, token } = await database();
  const fake = fakeAsaas();
  const { chargeId, paymentId } = await liveCharge({ id: "org-prefixo" }, fake);
  fake.payments.get(paymentId)!.externalReference = "sub:abc";
  fake.settle(paymentId);
  const sub = event("PAYMENT_RECEIVED", paymentId);
  const response = await handleAsaasWebhook(request(sub, token), { db, fetch: fake.fetch, now: NOW });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ignorado" });
  assert.equal((await paymentsOf(chargeId)).length, 0);
  assert.equal((await db.select().from(asaasWebhookEvents).where(eq(asaasWebhookEvents.id, sub.id))).length, 0, "ignorado não é gravado");
});

test("evento desconhecido, corpo inválido e corpo grande demais têm respostas próprias", async () => {
  const { db, token } = await database();
  const unknown = await handleAsaasWebhook(request({ id: "evt_x", event: "ACCOUNT_STATUS_UPDATED" }, token), { db });
  assert.equal(unknown.status, 200);
  assert.deepEqual(await unknown.json(), { status: "ignorado" });
  assert.equal((await handleAsaasWebhook(request("{nao é json", token), { db })).status, 400);
  assert.equal((await handleAsaasWebhook(request({ event: "PAYMENT_RECEIVED" }, token), { db })).status, 400);
  assert.equal((await handleAsaasWebhook(request({ id: "e", event: "X" }, token, { "content-length": String(600 * 1024) }), { db })).status, 413);
  const huge = JSON.stringify({ id: "evt_huge", event: "PAYMENT_RECEIVED", payment: { id: "p" }, padding: "x".repeat(520 * 1024) });
  assert.equal((await handleAsaasWebhook(request(huge, token), { db })).status, 413);
});

test("a lista de eventos mostrada ao dono vem da tabela de rotas e não traz o que não muda nada", () => {
  assert.ok(WEBHOOK_EVENTS_TO_ENABLE.includes("PAYMENT_RECEIVED"));
  assert.ok(WEBHOOK_EVENTS_TO_ENABLE.includes("PAYMENT_REFUNDED"));
  assert.ok(!WEBHOOK_EVENTS_TO_ENABLE.includes("PAYMENT_OVERDUE"));
});

test("Recebi manual numa cobrança do Asaas avisa o Asaas, e o webhook que vem depois não conta de novo", async () => {
  const { db, token } = await database();
  const fake = fakeAsaas();
  const { chargeId, org, paymentId } = await liveCharge({ id: "org-manual" }, fake);
  const result = await receiveManually(db, org, { chargeId, amountCents: 10_000, paidOn: "2026-11-17", method: "Dinheiro", note: "", idempotencyKey: "chave-do-formulario" }, fake.fetch);
  assert.equal(result.warning, null);
  const [row] = await paymentsOf(chargeId);
  assert.equal(row.idempotencyKey, `asaas:${paymentId}:dinheiro`);
  assert.equal(row.method, "Dinheiro");
  assert.deepEqual(fake.callsTo("POST", /receiveInCash/)[0].body, { paymentDate: "2026-11-17", value: 100, notifyCustomer: false });
  assert.equal(fake.payments.get(paymentId)?.status, "RECEIVED_IN_CASH");

  const webhook = await handleAsaasWebhook(request(event("PAYMENT_RECEIVED", paymentId), token), { db, fetch: fake.fetch, now: NOW });
  assert.equal(webhook.status, 200);
  assert.equal((await paymentsOf(chargeId)).length, 1, "nada contado em dobro");
  assert.equal((await chargeRow(db, chargeId)).paidCents, 10_000);
});

test("se o Asaas falhar no Recebi, o recebimento local fica e vem um aviso que não bloqueia", async () => {
  const { db } = await database();
  const fake = fakeAsaas();
  const { chargeId, org } = await liveCharge({ id: "org-manual-falha" }, fake);
  fake.failNext("POST", /receiveInCash/, 500);
  const result = await receiveManually(db, org, { chargeId, amountCents: 10_000, paidOn: "2026-11-17", method: "Pix", note: "" }, fake.fetch);
  assert.match(result.warning ?? "", /Asaas não foi avisado/);
  assert.equal((await chargeRow(db, chargeId)).status, "paga");
  assert.equal((await paymentsOf(chargeId)).length, 1);
});

test("desfazer um recebimento em dinheiro chama undoReceivedInCash e a cobrança volta a ser cobrada", async () => {
  const { db, token } = await database();
  const fake = fakeAsaas();
  const { chargeId, org, paymentId } = await liveCharge({ id: "org-desfazer" }, fake);
  await receiveManually(db, org, { chargeId, amountCents: 10_000, paidOn: "2026-11-17", method: "Dinheiro", note: "" }, fake.fetch);
  const undone = await reverseWithAsaas(db, org, chargeId, fake.fetch);
  assert.equal(undone.warning, null);
  assert.equal(fake.callsTo("POST", /undoReceivedInCash/).length, 1);
  assert.equal(fake.payments.get(paymentId)?.status, "PENDING");
  assert.equal((await chargeRow(db, chargeId)).status, "pendente");

  const response = await handleAsaasWebhook(request(event("PAYMENT_RECEIVED_IN_CASH_UNDONE", paymentId), token), { db, fetch: fake.fetch, now: NOW });
  assert.equal(response.status, 200);
  assert.equal((await chargeRow(db, chargeId)).paidCents, 0);
});

test("recebimento manual parcial apaga a cobrança do Asaas, que tinha o valor velho", async () => {
  const { db } = await database();
  const fake = fakeAsaas();
  const { chargeId, org, paymentId } = await liveCharge({ id: "org-parcial" }, fake);
  await receiveManually(db, org, { chargeId, amountCents: 4_000, paidOn: "2026-11-17", method: "Dinheiro", note: "" }, fake.fetch);
  assert.equal(fake.payments.get(paymentId)?.deleted, true);
  const charge = await chargeRow(db, chargeId);
  assert.equal(charge.asaasPaymentId, null);
  assert.equal(charge.paidCents, 4_000);
  assert.equal(charge.status, "parcial");
});

test("sem cobrança no Asaas o Recebi segue o caminho de sempre, com a chave do formulário", async () => {
  const { db } = await database();
  const fake = fakeAsaas();
  const { chargeId, org } = await integratedCharge(db, "org-sem-asaas");
  const result = await receiveManually(db, org, { chargeId, amountCents: 10_000, paidOn: "2026-11-17", method: "Pix", note: "", idempotencyKey: "chave-do-formulario-2" }, fake.fetch);
  assert.equal(result.warning, null);
  assert.equal(fake.calls.length, 0);
  assert.equal((await paymentsOf(chargeId))[0].idempotencyKey, "chave-do-formulario-2");
});

test("a reconciliação quita o que foi pago sem o webhook chegar, e só relê o que está sem conferência há mais de uma hora", async () => {
  const { db } = await database();
  const fake = fakeAsaas();
  const paid = await liveCharge({ id: "org-reconcilia-paga" }, fake);
  const pending = await liveCharge({ id: "org-reconcilia-aberta" }, fake);
  const recent = await liveCharge({ id: "org-reconcilia-recente" }, fake);
  fake.settle(paid.paymentId);
  fake.settle(recent.paymentId);
  const twoHoursAgo = new Date(NOW.getTime() - 2 * 3_600_000).toISOString();
  await db.update(charges).set({ asaasSyncedAt: twoHoursAgo }).where(eq(charges.id, paid.chargeId));
  await db.update(charges).set({ asaasSyncedAt: twoHoursAgo }).where(eq(charges.id, pending.chargeId));
  await db.update(charges).set({ asaasSyncedAt: new Date(NOW.getTime() - 600_000).toISOString() }).where(eq(charges.id, recent.chargeId));

  const report = await reconcileAsaas(db, NOW, { fetch: fake.fetch });
  assert.deepEqual(report, { checked: 2, settled: 1, dropped: 0, failed: 0 });
  assert.equal((await chargeRow(db, paid.chargeId)).status, "paga");
  assert.equal((await paymentsOf(paid.chargeId))[0].idempotencyKey, `asaas:${paid.paymentId}`);
  assert.equal((await chargeRow(db, pending.chargeId)).status, "pendente");
  assert.equal((await chargeRow(db, pending.chargeId)).asaasSyncedAt, NOW.toISOString(), "a conferência foi anotada");
  assert.equal((await chargeRow(db, recent.chargeId)).status, "pendente", "conferida há menos de uma hora, fica para depois");

  const again = await reconcileAsaas(db, NOW, { fetch: fake.fetch });
  assert.equal(again.checked, 0, "rodar de novo não repete trabalho");
});

test("a reconciliação por empresa só mexe nas cobranças daquela empresa e uma falha não derruba as outras", async () => {
  const { db } = await database();
  const fake = fakeAsaas();
  const first = await liveCharge({ id: "org-rec-a" }, fake);
  const second = await liveCharge({ id: "org-rec-b" }, fake);
  const old = new Date(NOW.getTime() - 3 * 3_600_000).toISOString();
  await db.update(charges).set({ asaasSyncedAt: old }).where(and(eq(charges.id, first.chargeId)));
  await db.update(charges).set({ asaasSyncedAt: old }).where(and(eq(charges.id, second.chargeId)));
  fake.settle(first.paymentId);
  fake.settle(second.paymentId);
  const scoped = await reconcileAsaas(db, NOW, { fetch: fake.fetch, organizationId: first.org });
  assert.equal(scoped.settled, 1);
  assert.equal((await chargeRow(db, second.chargeId)).status, "pendente");

  fake.failNext("GET", /^\/payments\/pay_\d+$/, 500, 2);
  const failed = await reconcileAsaas(db, NOW, { fetch: fake.fetch, organizationId: second.org });
  assert.equal(failed.failed, 1);
  const recovered = await reconcileAsaas(db, NOW, { fetch: fake.fetch, organizationId: second.org });
  assert.equal(recovered.settled, 1);
});

test("a conferência em segundo plano roda no máximo a cada 10 minutos por empresa", async () => {
  const { db } = await database();
  assert.ok(await reconcileAsaasThrottled(db, "org-sem-nada", NOW));
  assert.equal(await reconcileAsaasThrottled(db, "org-sem-nada", new Date(NOW.getTime() + 5 * 60_000)), null);
  assert.ok(await reconcileAsaasThrottled(db, "org-sem-nada", new Date(NOW.getTime() + 11 * 60_000)));
  assert.ok(await reconcileAsaasThrottled(db, "outra-empresa", NOW), "cada empresa tem a própria janela");
});
