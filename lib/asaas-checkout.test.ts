process.env.RECEBEFACIL_SECRET = "p".repeat(40);

import assert from "node:assert/strict";
import test from "node:test";
import { and, eq } from "drizzle-orm";
import { AsaasError } from "./asaas";
import { NeedsDocumentError, splitFor, startCheckout } from "./asaas-checkout";
import { DomainError } from "./errors";
import { loadPayPage } from "./pay-page";
import { payState } from "./pay-status";
import { signToken } from "./secret";
import { charges, clients, payments, platformSettings } from "./schema";
import { chargeRow, configurePlatform, fakeAsaas, integratedCharge, MERCHANT_WALLET, PLATFORM_WALLET, VALID_CPF } from "./test-asaas";
import { testDatabase } from "./test-support";

const NOW = new Date("2026-11-17T15:00:00Z");

let shared: ReturnType<typeof testDatabase> | undefined;
let configured: Promise<string> | undefined;
async function database() {
  shared ??= testDatabase();
  const db = await shared;
  configured ??= configurePlatform(db);
  await configured;
  return db;
}

test("a divisão manda ao lojista tudo menos a taxa, com quatro casas", () => {
  assert.deepEqual(splitFor("w", 150), [{ walletId: "w", percentualValue: 98.5 }]);
  assert.deepEqual(splitFor("w", 0), [{ walletId: "w", percentualValue: 100 }]);
  assert.deepEqual(splitFor("w", 333), [{ walletId: "w", percentualValue: 96.67 }]);
});

test("Pix: a cobrança nasce na conta da plataforma com valor em reais, referência, vencimento de hoje e divisão para o lojista", async () => {
  const db = await database();
  const fake = fakeAsaas();
  const { chargeId } = await integratedCharge(db, "org-pix", { amountCents: 123_456 });
  const view = await startCheckout(db, { chargeId, method: "pix" }, { fetch: fake.fetch, now: NOW });

  const [created] = fake.callsTo("POST", /^\/payments$/);
  assert.equal(created.token, "test-key", "usa a chave da plataforma, não a do lojista");
  assert.deepEqual(created.body, {
    customer: "cus_1",
    billingType: "PIX",
    value: 1234.56,
    dueDate: "2026-11-17",
    description: "Empresa de Teste - Cobrança avulsa",
    externalReference: chargeId,
    split: [{ walletId: MERCHANT_WALLET, percentualValue: 98.5 }],
  });
  assert.equal(view.kind, "pix");
  if (view.kind !== "pix") return;
  assert.equal(view.valueCents, 123_456);
  assert.equal(view.payload, "000201-pay_2");
  const row = await chargeRow(db, chargeId);
  assert.equal(row.asaasPaymentId, "pay_2");
  assert.equal(row.asaasValueCents, 123_456);
  assert.equal(row.asaasBillingType, "PIX");
  assert.equal(row.asaasPixPayload, "000201-pay_2");
});

test("boleto vence em 3 dias e traz linha digitável e PDF; cartão manda o pagador ao link do Asaas sem pedir cartão", async () => {
  const db = await database();
  const fake = fakeAsaas();
  const { chargeId } = await integratedCharge(db, "org-boleto", { amountCents: 20_000 });
  const boleto = await startCheckout(db, { chargeId, method: "boleto" }, { fetch: fake.fetch, now: NOW });
  assert.equal(fake.callsTo("POST", /^\/payments$/)[0].body?.billingType, "BOLETO");
  assert.equal(fake.callsTo("POST", /^\/payments$/)[0].body?.dueDate, "2026-11-20");
  assert.equal(boleto.kind, "boleto");
  if (boleto.kind !== "boleto") return;
  assert.match(boleto.identificationField ?? "", /^34191/);
  assert.match(boleto.bankSlipUrl ?? "", /^https:\/\/sandbox\.asaas\.com\/b\/pdf\//);
  assert.equal(boleto.dueOn, "2026-11-20");

  const card = await startCheckout(db, { chargeId, method: "cartao" }, { fetch: fake.fetch, now: NOW });
  const posts = fake.callsTo("POST", /^\/payments$/);
  assert.equal(posts.length, 2, "trocar de forma troca a cobrança");
  assert.equal(posts[1].body?.billingType, "UNDEFINED");
  assert.equal(fake.callsTo("DELETE", /^\/payments\/pay_\d+$/).length, 1, "a cobrança de boleto foi apagada");
  assert.equal(card.kind, "card");
  if (card.kind !== "card") return;
  assert.match(card.url, /^https:\/\/sandbox\.asaas\.com\/i\//);
  assert.ok(!JSON.stringify(posts.map((post) => post.body)).includes("creditCard"), "dado de cartão nunca passa por aqui");
});

test("Pix repetido reaproveita a cobrança e o QR enquanto não vence, e gera QR novo quando vence", async () => {
  const db = await database();
  const fake = fakeAsaas({ pixExpiresAt: "2026-11-17 13:00:00" });
  const { chargeId } = await integratedCharge(db, "org-reuso");
  const first = await startCheckout(db, { chargeId, method: "pix" }, { fetch: fake.fetch, now: NOW });
  const second = await startCheckout(db, { chargeId, method: "pix" }, { fetch: fake.fetch, now: new Date("2026-11-17T15:30:00Z") });
  assert.deepEqual(second, first);
  assert.equal(fake.callsTo("POST", /^\/payments$/).length, 1, "uma só cobrança");
  assert.equal(fake.callsTo("GET", /pixQrCode/).length, 1, "o QR guardado foi reaproveitado");

  fake.state.pixExpiresAt = "2026-11-17 23:59:59";
  const third = await startCheckout(db, { chargeId, method: "pix" }, { fetch: fake.fetch, now: new Date("2026-11-17T17:00:00Z") });
  assert.equal(fake.callsTo("POST", /^\/payments$/).length, 1, "a cobrança continua a mesma");
  assert.equal(fake.callsTo("GET", /pixQrCode/).length, 2, "o QR vencido foi pedido de novo");
  assert.equal(third.kind, "pix");
  if (third.kind === "pix") assert.equal(third.expiresAt, "2026-11-18T02:59:59.000Z");
});

test("quando a multa e os juros crescem, a cobrança velha é apagada e uma nova nasce com o valor de hoje", async () => {
  const db = await database();
  const fake = fakeAsaas();
  const { chargeId } = await integratedCharge(db, "org-atraso", { dueOn: "2026-11-10" });
  const today = await startCheckout(db, { chargeId, method: "pix" }, { fetch: fake.fetch, now: NOW });
  assert.equal(today.kind === "pix" && today.valueCents, 10_223, "R$ 100,00 + multa de 2% + 7 dias de juros");
  const tomorrow = await startCheckout(db, { chargeId, method: "pix" }, { fetch: fake.fetch, now: new Date("2026-11-18T15:00:00Z") });
  assert.equal(tomorrow.kind === "pix" && tomorrow.valueCents, 10_227);

  const deletions = fake.callsTo("DELETE", /^\/payments\//);
  assert.equal(deletions.length, 1);
  assert.equal(deletions[0].path, "/payments/pay_2");
  const posts = fake.callsTo("POST", /^\/payments$/);
  assert.equal(posts.length, 2);
  assert.equal(posts[1].body?.value, 102.27);
  const row = await chargeRow(db, chargeId);
  assert.equal(row.asaasPaymentId, "pay_3");
  assert.equal(row.asaasValueCents, 10_227);
});

test("sem CPF ou CNPJ o pagamento pede o documento, e o documento digitado fica no cliente e vai ao Asaas só com dígitos", async () => {
  const db = await database();
  const fake = fakeAsaas();
  const { chargeId, client } = await integratedCharge(db, "org-documento", { document: "" });
  await assert.rejects(() => startCheckout(db, { chargeId, method: "pix" }, { fetch: fake.fetch, now: NOW }), NeedsDocumentError);
  await assert.rejects(() => startCheckout(db, { chargeId, method: "pix", document: "123.456.789-00" }, { fetch: fake.fetch, now: NOW }), /inválido/);
  assert.equal(fake.calls.length, 0, "nada saiu para o Asaas");

  await startCheckout(db, { chargeId, method: "pix", document: "39053344705" }, { fetch: fake.fetch, now: NOW });
  assert.deepEqual(fake.callsTo("POST", /customers/)[0].body, { name: "Maria Souza", cpfCnpj: "39053344705", email: "maria@exemplo.com", mobilePhone: "11988771020" });
  const [saved] = await db.select().from(clients).where(eq(clients.id, client));
  assert.equal(saved.document, VALID_CPF);
  assert.equal(saved.kind, "pf");
  assert.equal(saved.asaasCustomerId, "cus_1");
});

test("o cliente do Asaas é criado uma vez e reaproveitado nas cobranças seguintes", async () => {
  const db = await database();
  const fake = fakeAsaas();
  const { chargeId } = await integratedCharge(db, "org-cliente");
  await startCheckout(db, { chargeId, method: "pix" }, { fetch: fake.fetch, now: NOW });
  await startCheckout(db, { chargeId, method: "boleto" }, { fetch: fake.fetch, now: NOW });
  assert.equal(fake.callsTo("POST", /customers/).length, 1);
  assert.equal(fake.callsTo("GET", /customers/).length, 1, "o id guardado no cliente evita nova busca");
});

test("o pagamento detectado no Asaas quita a cobrança em vez de criar outra", async () => {
  const db = await database();
  const fake = fakeAsaas();
  const { chargeId, org } = await integratedCharge(db, "org-pago");
  await startCheckout(db, { chargeId, method: "pix" }, { fetch: fake.fetch, now: NOW });
  const paymentId = (await chargeRow(db, chargeId)).asaasPaymentId ?? "";
  fake.settle(paymentId);
  const view = await startCheckout(db, { chargeId, method: "pix" }, { fetch: fake.fetch, now: NOW });
  assert.deepEqual(view, { kind: "paid" });
  assert.equal(fake.callsTo("POST", /^\/payments$/).length, 1);
  assert.equal((await chargeRow(db, chargeId)).status, "paga");
  const rows = await db.select().from(payments).where(and(eq(payments.organizationId, org), eq(payments.chargeId, chargeId)));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].idempotencyKey, `asaas:${paymentId}`);
});

test("lojista em modo Gestão, cobrança cancelada e plataforma sem carteira não geram pagamento no Asaas", async () => {
  const db = await database();
  const fake = fakeAsaas();
  const gestao = await integratedCharge(db, "org-gestao", { integrated: false });
  await assert.rejects(() => startCheckout(db, { chargeId: gestao.chargeId, method: "pix" }, { fetch: fake.fetch, now: NOW }), DomainError);
  const cancelled = await integratedCharge(db, "org-cancelada");
  await db.update(charges).set({ status: "cancelada" }).where(eq(charges.id, cancelled.chargeId));
  await assert.rejects(() => startCheckout(db, { chargeId: cancelled.chargeId, method: "pix" }, { fetch: fake.fetch, now: NOW }), /cancelada/);

  const open = await integratedCharge(db, "org-sem-carteira");
  await db.update(platformSettings).set({ asaasWalletId: "" }).where(eq(platformSettings.id, "default"));
  try {
    await assert.rejects(() => startCheckout(db, { chargeId: open.chargeId, method: "pix" }, { fetch: fake.fetch, now: NOW }), /não aceita pagamento/);
  } finally {
    await db.update(platformSettings).set({ asaasWalletId: PLATFORM_WALLET }).where(eq(platformSettings.id, "default"));
  }
  assert.equal(fake.calls.length, 0);
});

test("erro do Asaas na criação chega como erro tipado e não deixa cobrança pela metade", async () => {
  const db = await database();
  const fake = fakeAsaas();
  const { chargeId } = await integratedCharge(db, "org-erro");
  fake.failNext("POST", /^\/payments$/, 400, 1, { errors: [{ code: "invalid_value", description: "O valor mínimo é R$ 5,00." }] });
  await assert.rejects(() => startCheckout(db, { chargeId, method: "pix" }, { fetch: fake.fetch, now: NOW }), (error) => error instanceof AsaasError && error.message === "O valor mínimo é R$ 5,00.");
  assert.equal((await chargeRow(db, chargeId)).asaasPaymentId, null);
});

test("dois pagadores abrindo o link juntos não deixam duas cobranças vivas: a perdedora é apagada", async () => {
  const db = await database();
  const fake = fakeAsaas();
  const { chargeId } = await integratedCharge(db, "org-corrida");
  let raced = false;
  const racing = (async (input: URL | string | Request, init?: RequestInit) => {
    const response = await fake.fetch(input, init);
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (!raced && init?.method === "POST" && url.pathname.endsWith("/payments")) {
      raced = true;
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      const rival = await fake.fetch(url, { ...init, body: JSON.stringify(body) });
      const rivalId = ((await rival.json()) as { id: string }).id;
      await db.update(charges).set({ asaasPaymentId: rivalId, asaasBillingType: "PIX", asaasValueCents: 10_000, asaasSyncedAt: NOW.toISOString() }).where(eq(charges.id, chargeId));
    }
    return response;
  }) as typeof fetch;

  const view = await startCheckout(db, { chargeId, method: "pix" }, { fetch: racing, now: NOW });
  assert.equal(view.kind, "pix");
  const live = [...fake.payments.values()].filter((payment) => !payment.deleted);
  assert.equal(live.length, 1, "só uma cobrança viva");
  assert.equal((await chargeRow(db, chargeId)).asaasPaymentId, live[0].id);
});

test("o status que o pagador consulta só confere o Asaas a cada 15 segundos, e mostra pago mesmo sem o webhook", async () => {
  const db = await database();
  const fake = fakeAsaas();
  const { chargeId } = await integratedCharge(db, "org-status");
  await startCheckout(db, { chargeId, method: "pix" }, { fetch: fake.fetch, now: NOW });
  fake.settle((await chargeRow(db, chargeId)).asaasPaymentId ?? "");
  const lookups = () => fake.callsTo("GET", /^\/payments\/pay_\d+$/).length;

  assert.equal(await payState(db, chargeId, new Date(NOW.getTime() + 5_000), fake.fetch), "open", "ainda dentro dos 15 segundos");
  assert.equal(lookups(), 0);
  assert.equal(await payState(db, chargeId, new Date(NOW.getTime() + 16_000), fake.fetch), "paid");
  assert.equal(lookups(), 1);
  assert.equal(await payState(db, chargeId, new Date(NOW.getTime() + 60_000), fake.fetch), "paid");
  assert.equal(lookups(), 1, "cobrança paga não consulta mais");
});

test("o status sabe quando a cobrança foi cancelada, não existe ou não usa o Asaas", async () => {
  const db = await database();
  const fake = fakeAsaas();
  const cancelled = await integratedCharge(db, "org-status-cancelada");
  await db.update(charges).set({ status: "cancelada" }).where(eq(charges.id, cancelled.chargeId));
  assert.equal(await payState(db, cancelled.chargeId, NOW, fake.fetch), "cancelled");
  assert.equal(await payState(db, "00000000-0000-4000-8000-000000000000", NOW, fake.fetch), null);
  const plain = await integratedCharge(db, "org-status-simples", { integrated: false });
  assert.equal(await payState(db, plain.chargeId, NOW, fake.fetch), "open");
  assert.equal(fake.calls.length, 0);
});

test("o link público só oferece Pix, boleto e cartão com lojista Integrado e plataforma pronta, e avisa quando falta o documento", async () => {
  const db = await database();
  const ready = await integratedCharge(db, "org-pagina");
  assert.deepEqual((await loadPayPage(db, signToken(ready.chargeId)))?.online, { needsDocument: false });
  const noDocument = await integratedCharge(db, "org-pagina-sem-documento", { document: "" });
  assert.deepEqual((await loadPayPage(db, signToken(noDocument.chargeId)))?.online, { needsDocument: true });
  const gestao = await integratedCharge(db, "org-pagina-gestao", { integrated: false });
  assert.equal((await loadPayPage(db, signToken(gestao.chargeId)))?.online, null, "Gestão mantém a página da chave Pix");

  await db.update(platformSettings).set({ asaasApiKeyEnc: "" }).where(eq(platformSettings.id, "default"));
  try {
    assert.equal((await loadPayPage(db, signToken(ready.chargeId)))?.online, null, "plataforma sem chave volta para a página da chave Pix");
  } finally {
    await configurePlatform(db);
  }
});
