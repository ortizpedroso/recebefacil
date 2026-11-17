process.env.RECEBEFACIL_SECRET = "p".repeat(40);

import assert from "node:assert/strict";
import test from "node:test";
import { eq } from "drizzle-orm";
import { createAsaasClient } from "./asaas";
import { handleAsaasWebhook, WEBHOOK_EVENTS_TO_ENABLE } from "./asaas-webhook";
import { accessFor, loadSubscription } from "./billing";
import { DomainError } from "./errors";
import { cents } from "./money";
import { asaasWebhookEvents, organizations, platformInvoices, subscriptions } from "./schema";
import { cancelPlan, choosePlan, paidPeriodEnd, standingAfter, syncSubscription } from "./subscription";
import { configurePlatform, fakeAsaas, paymentEvent, subscriptionEvent, webhookRequest, type FakeAsaas } from "./test-asaas";
import { addOrganization, testDatabase } from "./test-support";

const NOW = new Date("2026-11-17T15:00:00Z");
const TODAY = "2026-11-17";
const CNPJ = "34.567.890/0001-30";

let shared: ReturnType<typeof testDatabase> | undefined;
let configured: Promise<string> | undefined;
async function database() {
  shared ??= testDatabase();
  const db = await shared;
  configured ??= configurePlatform(db);
  return { db, token: await configured };
}

async function merchant(id: string, document = CNPJ) {
  const { db } = await database();
  await addOrganization(db, id);
  await db.update(organizations).set({ document, email: "loja@exemplo.com", phone: "(11) 98877-1020" }).where(eq(organizations.id, id));
  return id;
}

const subscriptionOf = async (organizationId: string) => {
  const { db } = await database();
  const [row] = await db.select().from(subscriptions).where(eq(subscriptions.organizationId, organizationId));
  return row;
};
const invoicesOf = async (organizationId: string) => {
  const { db } = await database();
  return db.select().from(platformInvoices).where(eq(platformInvoices.organizationId, organizationId));
};

async function subscribed(id: string, plan: "gestao" | "integrado", fake: FakeAsaas) {
  const { db } = await database();
  const org = await merchant(id);
  const choice = await choosePlan(db, org, plan, {}, { fetch: fake.fetch, now: NOW });
  const sub = await subscriptionOf(org);
  const remote = [...fake.subscriptions.values()].find((subscription) => subscription.externalReference === `sub:${org}`);
  const firstPayment = [...fake.payments.values()].find((payment) => payment.subscription === remote?.id);
  assert.ok(remote && firstPayment && sub.asaasSubscriptionId === remote.id);
  return { org, choice, sub, remote, firstPayment };
}

async function deliver(body: unknown, fake: FakeAsaas) {
  const { db, token } = await database();
  const response = await handleAsaasWebhook(webhookRequest(body, token), { db, fetch: fake.fetch, now: NOW });
  return { status: response.status, body: (await response.json()) as Record<string, string> };
}

let fakes = 0;
const newFake = () => fakeAsaas({ idPrefix: `t${(fakes += 1)}_` });
const options = (fake: FakeAsaas) => ({ fetch: fake.fetch, now: NOW });

test("contratar cria a assinatura mensal no Asaas com o preço do plano e leva à fatura", async () => {
  const { db } = await database();
  const fake = newFake();
  const org = await merchant("org-contrata");
  const choice = await choosePlan(db, org, "integrado", {}, options(fake));

  const [create] = fake.callsTo("POST", /^\/subscriptions$/);
  const customer = fake.callsTo("POST", /^\/customers$/)[0];
  assert.equal(customer.body?.cpfCnpj, "34567890000130");
  assert.deepEqual(create.body, {
    customer: [...fake.customers.values()][0],
    billingType: "UNDEFINED",
    value: 39.9,
    nextDueDate: TODAY,
    cycle: "MONTHLY",
    description: "RecebeFácil plano Integrado",
    externalReference: `sub:${org}`,
  });
  const remote = [...fake.subscriptions.values()][0];
  const payment = [...fake.payments.values()].find((candidate) => candidate.subscription === remote.id);
  assert.deepEqual(choice, { kind: "pay", invoiceUrl: `https://sandbox.asaas.com/i/${payment?.id}` });

  const sub = await subscriptionOf(org);
  assert.equal(sub.status, "aguardando_pagamento");
  assert.equal(sub.planCode, "integrado");
  assert.equal(sub.asaasSubscriptionId, remote.id);
  const [{ asaasCustomerId }] = await db.select().from(organizations).where(eq(organizations.id, org));
  assert.equal(asaasCustomerId, remote.customer);
  const [invoice] = await invoicesOf(org);
  assert.deepEqual({ status: invoice.status, cents: invoice.amountCents, dueOn: invoice.dueOn, url: invoice.invoiceUrl }, { status: "aberta", cents: 3990, dueOn: TODAY, url: choice.kind === "pay" ? choice.invoiceUrl : "" });
});

test("o CNPJ ou CPF da empresa é pedido quando falta, conferido e guardado", async () => {
  const { db } = await database();
  const fake = newFake();
  const org = await merchant("org-sem-documento", "");
  await assert.rejects(() => choosePlan(db, org, "gestao", {}, options(fake)), (error) => error instanceof DomainError && /CPF ou CNPJ/.test(error.message));
  await assert.rejects(() => choosePlan(db, org, "gestao", { document: "111.111.111-11" }, options(fake)), (error) => error instanceof DomainError && /inválido/.test(error.message));
  assert.equal(fake.calls.length, 0, "nada vai ao Asaas com documento ruim");

  await choosePlan(db, org, "gestao", { document: "39053344705" }, options(fake));
  const [row] = await db.select().from(organizations).where(eq(organizations.id, org));
  assert.equal(row.document, "390.533.447-05");
  assert.equal(fake.callsTo("POST", /^\/customers$/)[0].body?.cpfCnpj, "39053344705");
});

test("sem o Asaas da plataforma pronto a contratação diz que está indisponível", async () => {
  const fresh = await testDatabase();
  await addOrganization(fresh, "org-indisponivel");
  await fresh.update(organizations).set({ document: CNPJ }).where(eq(organizations.id, "org-indisponivel"));
  const fake = newFake();
  await assert.rejects(() => choosePlan(fresh, "org-indisponivel", "gestao", {}, options(fake)), (error) => error instanceof DomainError && /indisponível.*suporte/.test(error.message));
  assert.equal(fake.calls.length, 0);
});

test("dois cliques em Contratar criam uma assinatura só, e uma criada por tentativa interrompida é adotada", async () => {
  const { db } = await database();
  const fake = newFake();
  const org = await merchant("org-duplo-clique");
  const [first, second] = await Promise.all([choosePlan(db, org, "gestao", {}, options(fake)), choosePlan(db, org, "gestao", {}, options(fake))]);
  assert.equal(fake.callsTo("POST", /^\/subscriptions$/).length, 1);
  assert.deepEqual(first, second);
  assert.equal((await invoicesOf(org)).length, 1);

  const orphanOrg = await merchant("org-orfa");
  const asaas = createAsaasClient({ apiKey: "test-key", environment: "sandbox", fetch: fake.fetch });
  const customer = await asaas.findOrCreateCustomer({ name: "Empresa", cpfCnpj: "34567890000130" });
  const orphan = await asaas.createSubscription({ customer, valueCents: cents(4990), nextDueDate: TODAY, description: "x", externalReference: `sub:${orphanOrg}` });
  const before = fake.callsTo("POST", /^\/subscriptions$/).length;
  await choosePlan(db, orphanOrg, "gestao", {}, options(fake));
  assert.equal(fake.callsTo("POST", /^\/subscriptions$/).length, before, "não criou outra");
  assert.equal((await subscriptionOf(orphanOrg)).asaasSubscriptionId, orphan.id);
});

test("PAYMENT_RECEIVED ativa o plano até um mês depois do vencimento e registra a fatura paga", async () => {
  const { db } = await database();
  const fake = newFake();
  const { org, firstPayment } = await subscribed("org-paga", "gestao", fake);
  fake.settle(firstPayment.id, "RECEIVED", TODAY);

  const received = paymentEvent("PAYMENT_RECEIVED", firstPayment.id);
  assert.deepEqual(await deliver(received, fake), { status: 200, body: { status: "ok" } });
  const sub = await subscriptionOf(org);
  assert.equal(sub.status, "ativa");
  assert.equal(sub.periodEndsOn, "2026-12-17");
  const [invoice] = await invoicesOf(org);
  assert.deepEqual({ status: invoice.status, paidOn: invoice.paidOn, dueOn: invoice.dueOn, cents: invoice.amountCents, payment: invoice.asaasPaymentId }, { status: "paga", paidOn: TODAY, dueOn: TODAY, cents: 4990, payment: firstPayment.id });
  assert.deepEqual(accessFor(sub, TODAY), { state: "ativa", canSell: true, daysLeft: 30 });

  assert.deepEqual(await deliver(received, fake), { status: 200, body: { status: "duplicado" } });
  const confirmed = await deliver(paymentEvent("PAYMENT_CONFIRMED", firstPayment.id), fake);
  assert.equal(confirmed.status, 200);
  assert.equal((await invoicesOf(org)).length, 1, "a mesma fatura não vira duas");
  assert.equal((await subscriptionOf(org)).periodEndsOn, "2026-12-17");
  const [stored] = await db.select().from(asaasWebhookEvents).where(eq(asaasWebhookEvents.id, received.id));
  assert.ok(stored.processedAt);
});

test("o corpo do evento não ativa nada: se o Asaas ainda diz PENDING, o plano segue aguardando", async () => {
  const fake = newFake();
  const { org, firstPayment } = await subscribed("org-corpo-falso", "gestao", fake);
  const response = await deliver(paymentEvent("PAYMENT_RECEIVED", firstPayment.id, { status: "RECEIVED", externalReference: `sub:${org}` }), fake);
  assert.equal(response.status, 200);
  assert.equal((await subscriptionOf(org)).status, "aguardando_pagamento");
  assert.equal((await invoicesOf(org))[0].status, "aberta");
});

test("fatura vencida deixa a empresa inadimplente, e o aviso velho de uma fatura já paga não derruba", async () => {
  const fake = newFake();
  const { org, remote, firstPayment } = await subscribed("org-vencida", "gestao", fake);
  fake.settle(firstPayment.id, "RECEIVED", TODAY);
  await deliver(paymentEvent("PAYMENT_RECEIVED", firstPayment.id), fake);

  const next = fake.renew(remote.id, "2026-12-17");
  fake.setStatus(next.id, "OVERDUE");
  const overdue = await deliver(paymentEvent("PAYMENT_OVERDUE", next.id, { externalReference: `sub:${org}` }), fake);
  assert.equal(overdue.status, 200);
  assert.equal((await subscriptionOf(org)).status, "inadimplente");
  const invoices = await invoicesOf(org);
  assert.equal(invoices.find((invoice) => invoice.asaasPaymentId === next.id)?.status, "vencida");
  assert.equal((await subscriptionOf(org)).periodEndsOn, "2026-12-17", "o período pago não muda");

  fake.settle(next.id, "RECEIVED", "2026-12-18");
  await deliver(paymentEvent("PAYMENT_RECEIVED", next.id), fake);
  assert.equal((await subscriptionOf(org)).status, "ativa");
  assert.equal((await subscriptionOf(org)).periodEndsOn, "2027-01-17");
  await deliver(paymentEvent("PAYMENT_OVERDUE", next.id, { externalReference: `sub:${org}` }), fake);
  assert.equal((await subscriptionOf(org)).status, "ativa", "o Asaas diz pago: o aviso de vencida é velho");
});

test("estorno deixa inadimplente só quando nenhum outro período pago cobre hoje", async () => {
  const fake = newFake();
  const alone = await subscribed("org-estorno-unico", "gestao", fake);
  fake.settle(alone.firstPayment.id, "RECEIVED", TODAY);
  await deliver(paymentEvent("PAYMENT_RECEIVED", alone.firstPayment.id), fake);
  fake.setStatus(alone.firstPayment.id, "REFUNDED");
  await deliver(paymentEvent("PAYMENT_REFUNDED", alone.firstPayment.id), fake);
  assert.equal((await subscriptionOf(alone.org)).status, "inadimplente");
  assert.equal((await invoicesOf(alone.org))[0].status, "estornada");

  const covered = await subscribed("org-estorno-coberto", "gestao", fake);
  const earlier = fake.renew(covered.remote.id, "2026-11-10");
  fake.settle(earlier.id, "RECEIVED", "2026-11-10");
  fake.settle(covered.firstPayment.id, "RECEIVED", TODAY);
  await deliver(paymentEvent("PAYMENT_RECEIVED", earlier.id), fake);
  await deliver(paymentEvent("PAYMENT_RECEIVED", covered.firstPayment.id), fake);
  fake.setStatus(covered.firstPayment.id, "REFUNDED");
  await deliver(paymentEvent("PAYMENT_REFUNDED", covered.firstPayment.id), fake);
  const sub = await subscriptionOf(covered.org);
  assert.equal(sub.status, "ativa", "a fatura de 10/11 ainda cobre hoje");
  assert.equal(sub.periodEndsOn, "2026-12-10");
});

test("cancelar apaga a assinatura no Asaas e o acesso segue até o fim do período pago", async () => {
  const { db } = await database();
  const fake = newFake();
  const { org, remote, firstPayment } = await subscribed("org-cancela", "gestao", fake);
  fake.settle(firstPayment.id, "RECEIVED", TODAY);
  await deliver(paymentEvent("PAYMENT_RECEIVED", firstPayment.id), fake);

  await cancelPlan(db, org, options(fake));
  assert.equal(fake.callsTo("DELETE", new RegExp(`^/subscriptions/${remote.id}$`)).length, 1);
  assert.equal(fake.subscriptions.get(remote.id)?.deleted, true);
  const sub = await subscriptionOf(org);
  assert.equal(sub.status, "cancelada");
  assert.equal(accessFor(sub, TODAY).canSell, true);
  assert.equal(accessFor(sub, "2026-12-18").canSell, false);
  await assert.rejects(() => cancelPlan(db, org, options(fake)), DomainError);

  const event = subscriptionEvent("SUBSCRIPTION_DELETED", remote.id, { externalReference: `sub:${org}` });
  assert.equal((await deliver(event, fake)).status, 200);
  assert.equal((await subscriptionOf(org)).status, "cancelada");
  assert.equal((await subscriptionOf(org)).periodEndsOn, "2026-12-17");

  const again = await choosePlan(db, org, "gestao", {}, options(fake));
  assert.equal(again.kind, "pay");
  const creates = fake.callsTo("POST", /^\/subscriptions$/);
  assert.equal(creates.length, 2, "voltar a contratar cria uma assinatura nova");
  assert.equal(creates[1].body?.nextDueDate, "2026-12-17", "a nova fatura começa quando o período pago acaba, sem pagar o mesmo mês duas vezes");
  assert.equal((await subscriptionOf(org)).status, "ativa", "o período pago ainda cobre hoje");
});

test("SUBSCRIPTION_DELETED cancela, mas o aviso de uma assinatura antiga não mexe na atual", async () => {
  const { db } = await database();
  const fake = newFake();
  const { org, remote } = await subscribed("org-assinatura-velha", "gestao", fake);
  await cancelPlan(db, org, options(fake));
  await choosePlan(db, org, "gestao", {}, options(fake));
  const current = await subscriptionOf(org);
  const currentId = current.asaasSubscriptionId ?? "";
  assert.notEqual(currentId, remote.id);
  const stale = subscriptionEvent("SUBSCRIPTION_DELETED", remote.id, { externalReference: `sub:${org}` });
  assert.equal((await deliver(stale, fake)).status, 200);
  assert.equal((await subscriptionOf(org)).status, "aguardando_pagamento");

  const fresh = fake.subscriptions.get(currentId);
  assert.ok(fresh);
  fresh.status = "INACTIVE";
  const gone = subscriptionEvent("SUBSCRIPTION_INACTIVATED", currentId, { externalReference: `sub:${org}` });
  assert.equal((await deliver(gone, fake)).status, 200);
  assert.equal((await subscriptionOf(org)).status, "cancelada");
});

test("trocar de plano muda o valor na mesma assinatura, inclusive o da fatura ainda aberta", async () => {
  const { db } = await database();
  const fake = newFake();
  const { org, remote, firstPayment } = await subscribed("org-troca", "gestao", fake);
  assert.equal(firstPayment.value, 49.9);
  const waiting = await choosePlan(db, org, "integrado", {}, options(fake));
  assert.equal(waiting.kind, "pay", "ainda falta pagar a primeira fatura");
  const [update] = fake.callsTo("POST", new RegExp(`^/subscriptions/${remote.id}$`));
  assert.deepEqual(update.body, { value: 39.9, description: "RecebeFácil plano Integrado", updatePendingPayments: true });
  assert.equal(fake.payments.get(firstPayment.id)?.value, 39.9);
  assert.equal(fake.callsTo("POST", /^\/subscriptions$/).length, 1, "a assinatura é a mesma");
  assert.equal((await subscriptionOf(org)).planCode, "integrado");

  fake.settle(firstPayment.id, "RECEIVED", TODAY);
  await deliver(paymentEvent("PAYMENT_RECEIVED", firstPayment.id), fake);
  const back = await choosePlan(db, org, "gestao", {}, options(fake));
  assert.deepEqual(back, { kind: "changed" });
  assert.equal(fake.subscriptions.get(remote.id)?.value, 49.9);
  assert.equal((await subscriptionOf(org)).planCode, "gestao");
  await assert.rejects(() => choosePlan(db, org, "gestao", {}, options(fake)), (error) => error instanceof DomainError && /já está/.test(error.message));
});

test("quem volta do Asaas depois de pagar vê o plano ativo mesmo sem o webhook", async () => {
  const { db } = await database();
  const fake = newFake();
  const { org, firstPayment } = await subscribed("org-sem-webhook", "integrado", fake);
  fake.settle(firstPayment.id, "CONFIRMED", TODAY);
  assert.equal(await syncSubscription(db, org, options(fake)), true);
  const sub = await subscriptionOf(org);
  assert.equal(sub.status, "ativa");
  assert.equal(sub.periodEndsOn, "2026-12-17");
  assert.equal(await syncSubscription(db, org, options(fake)), false, "ativa não precisa conferir");
});

test("fatura de empresa desconhecida é aceita sem efeito, e os eventos de assinatura entram na lista do dono", async () => {
  const fake = newFake();
  const unknown = await deliver(paymentEvent("PAYMENT_RECEIVED", "pay_inexistente", { externalReference: "sub:empresa-que-nao-existe" }), fake);
  assert.equal(unknown.status, 200);
  assert.ok(WEBHOOK_EVENTS_TO_ENABLE.includes("PAYMENT_OVERDUE"));
  assert.ok(WEBHOOK_EVENTS_TO_ENABLE.includes("SUBSCRIPTION_DELETED"));
  assert.ok(WEBHOOK_EVENTS_TO_ENABLE.includes("SUBSCRIPTION_INACTIVATED"));
});

test("o fim do período pago prende o dia no último dia do mês, e a situação segue uma tabela", () => {
  assert.equal(paidPeriodEnd([{ status: "paga", dueOn: "2026-01-31" }]), "2026-02-28");
  assert.equal(paidPeriodEnd([{ status: "paga", dueOn: "2026-11-17" }, { status: "estornada", dueOn: "2026-12-17" }, { status: "aberta", dueOn: "2027-01-17" }]), "2026-12-17");
  assert.equal(paidPeriodEnd([{ status: "aberta", dueOn: "2026-11-17" }]), null);
  assert.equal(standingAfter("cancelada", "RECEIVED", true), "cancelada");
  assert.equal(standingAfter("aguardando_pagamento", "RECEIVED", true), "ativa");
  assert.equal(standingAfter("ativa", "OVERDUE", true), "inadimplente");
  assert.equal(standingAfter("aguardando_pagamento", "PENDING", false), "aguardando_pagamento");
  assert.equal(standingAfter("ativa", "REFUNDED", false), "inadimplente");
  assert.equal(standingAfter("inadimplente", "REFUNDED", true), "ativa");
});

test("a assinatura lida de uma empresa nova é um teste, e o plano pago só nasce pelo Asaas", async () => {
  const { db } = await database();
  const org = await addOrganization(db, "org-so-teste");
  const [row] = await db.select().from(organizations).where(eq(organizations.id, org));
  const sub = await loadSubscription(db, row, NOW);
  assert.equal(sub?.status, "teste");
  assert.equal(sub?.asaasSubscriptionId, null);
});
