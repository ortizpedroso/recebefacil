process.env.RECEBEFACIL_SECRET = "p".repeat(40);

import assert from "node:assert/strict";
import test from "node:test";
import { eq } from "drizzle-orm";
import { linkMerchantAccount, setReceivingMode } from "./asaas-merchant";
import { startCheckout } from "./asaas-checkout";
import { receiveManually, reverseWithAsaas } from "./asaas-settle";
import { accessFor, assertCanSell, canReceiveOnline, listSubscribers, loadSubscription, type SubscriptionRow } from "./billing";
import { shiftDays, todayIn } from "./dates";
import { DomainError } from "./errors";
import { PUBLIC_DEMO_KEY } from "./onboarding";
import { organizations, subscriptions } from "./schema";
import { chargeRow, configurePlatform, fakeAsaas, integratedCharge, MERCHANT_WALLET } from "./test-asaas";
import { addOrganization, testDatabase } from "./test-support";
import { ensureOrganization } from "./tenant";

let shared: ReturnType<typeof testDatabase> | undefined;
let configured: Promise<string> | undefined;
async function database() {
  shared ??= testDatabase();
  const db = await shared;
  configured ??= configurePlatform(db);
  await configured;
  return db;
}

const TODAY = "2026-11-17";
const NOW = new Date("2026-11-17T15:00:00Z");

type Standing = Pick<SubscriptionRow, "status" | "trialEndsOn" | "periodEndsOn">;
const standing = (status: SubscriptionRow["status"], trialEndsOn: string, periodEndsOn = trialEndsOn): Standing => ({ status, trialEndsOn, periodEndsOn });

test("accessFor: cada situação diz se dá para criar venda e o que o lojista lê", () => {
  const table: { name: string; subscription: Standing; state: string; canSell: boolean; daysLeft?: number; banner: RegExp | null }[] = [
    { name: "teste com folga", subscription: standing("teste", "2026-12-01"), state: "teste", canSell: true, daysLeft: 14, banner: null },
    { name: "teste perto do fim", subscription: standing("teste", "2026-11-19"), state: "teste", canSell: true, daysLeft: 2, banner: /em 2 dias/ },
    { name: "último dia do teste", subscription: standing("teste", TODAY), state: "teste", canSell: true, daysLeft: 0, banner: /hoje/ },
    { name: "teste vencido", subscription: standing("teste", "2026-11-16"), state: "expirada", canSell: false, banner: /terminou/ },
    { name: "ativa em dia", subscription: standing("ativa", "2026-11-01", "2026-12-17"), state: "ativa", canSell: true, daysLeft: 30, banner: null },
    { name: "ativa sem renovação registrada", subscription: standing("ativa", "2026-11-01", "2026-11-16"), state: "inadimplente", canSell: false, banner: /pausadas/ },
    { name: "inadimplente dentro do período pago", subscription: standing("inadimplente", "2026-10-01", "2026-11-20"), state: "inadimplente", canSell: true, daysLeft: 3, banner: /20\/11\/2026/ },
    { name: "inadimplente depois do período", subscription: standing("inadimplente", "2026-10-01", "2026-11-16"), state: "inadimplente", canSell: false, banner: /pausadas/ },
    { name: "cancelada dentro do período pago", subscription: standing("cancelada", "2026-10-01", "2026-12-01"), state: "cancelada", canSell: true, daysLeft: 14, banner: /01\/12\/2026/ },
    { name: "cancelada depois do período", subscription: standing("cancelada", "2026-10-01", "2026-11-16"), state: "cancelada", canSell: false, banner: /terminou/ },
    { name: "aguardando o primeiro pagamento ainda no teste", subscription: standing("aguardando_pagamento", "2026-11-25"), state: "aguardando", canSell: true, daysLeft: 8, banner: /primeira mensalidade/ },
    { name: "aguardando o primeiro pagamento com o teste vencido", subscription: standing("aguardando_pagamento", "2026-11-10"), state: "aguardando", canSell: false, banner: /primeira mensalidade/ },
    { name: "o teste que sobra vale mesmo com assinatura vencida", subscription: standing("inadimplente", "2026-12-20", "2026-11-01"), state: "inadimplente", canSell: true, daysLeft: 33, banner: /20\/12\/2026/ },
  ];
  for (const row of table) {
    const access = accessFor(row.subscription, TODAY);
    assert.equal(access.state, row.state, row.name);
    assert.equal(access.canSell, row.canSell, row.name);
    assert.equal(access.daysLeft, row.daysLeft, row.name);
    if (row.banner) assert.match(access.banner ?? "", row.banner, row.name);
    else assert.equal(access.banner, undefined, row.name);
    if (!row.canSell) assert.ok(access.banner, `${row.name}: quem não pode vender precisa ler por quê`);
  }
});

test("canReceiveOnline: teste ou plano Integrado em dia, e só", () => {
  const plan = (planCode: "gestao" | "integrado", subscription: Standing) => ({ ...subscription, planCode });
  assert.equal(canReceiveOnline(plan("gestao", standing("teste", "2026-12-01")), TODAY), true, "teste vale para tudo");
  assert.equal(canReceiveOnline(plan("gestao", standing("teste", "2026-11-16")), TODAY), false, "teste vencido");
  assert.equal(canReceiveOnline(plan("gestao", standing("ativa", "2026-11-01", "2026-12-17")), TODAY), false, "Gestão paga não recebe pelo Asaas");
  assert.equal(canReceiveOnline(plan("integrado", standing("ativa", "2026-11-01", "2026-12-17")), TODAY), true);
  assert.equal(canReceiveOnline(plan("integrado", standing("ativa", "2026-11-01", "2026-11-16")), TODAY), false, "Integrado sem renovar");
  assert.equal(canReceiveOnline(plan("integrado", standing("inadimplente", "2026-11-01", "2026-11-20")), TODAY), true, "o mês pago ainda vale");
  assert.equal(canReceiveOnline(plan("integrado", standing("cancelada", "2026-11-01", "2026-12-01")), TODAY), true, "cancelado vale até o fim do período");
});

test("empresa nova ganha 14 dias de teste, e a demonstração pública não tem assinatura", async () => {
  const db = await database();
  const company = await ensureOrganization(db, "production:novo", "Fulana");
  const [row] = await db.select().from(subscriptions).where(eq(subscriptions.organizationId, company.id));
  assert.equal(row.status, "teste");
  assert.equal(row.trialEndsOn, shiftDays(todayIn("America/Sao_Paulo"), 14));
  assert.equal(row.periodEndsOn, row.trialEndsOn);

  await ensureOrganization(db, "production:novo", "Fulana");
  assert.equal((await db.select().from(subscriptions).where(eq(subscriptions.organizationId, company.id))).length, 1, "voltar não abre outro teste");

  const demo = await ensureOrganization(db, PUBLIC_DEMO_KEY, "Visitante");
  assert.equal((await db.select().from(subscriptions).where(eq(subscriptions.organizationId, demo.id))).length, 0);
  assert.equal(await loadSubscription(db, demo), null);
});

test("empresa de antes dos planos ganha o teste na primeira leitura, uma vez só", async () => {
  const db = await database();
  const id = await addOrganization(db, "org-antiga");
  const [org] = await db.select().from(organizations).where(eq(organizations.id, id));
  const first = await loadSubscription(db, org, NOW);
  assert.equal(first?.trialEndsOn, "2026-12-01");
  const second = await loadSubscription(db, org, new Date("2026-11-20T15:00:00Z"));
  assert.equal(second?.id, first?.id);
  assert.equal(second?.trialEndsOn, "2026-12-01");
});

async function expire(db: Awaited<ReturnType<typeof database>>, organizationId: string) {
  const [org] = await db.select().from(organizations).where(eq(organizations.id, organizationId));
  await loadSubscription(db, org, NOW);
  await db.update(subscriptions).set({ trialEndsOn: "2026-10-01", periodEndsOn: "2026-10-01" }).where(eq(subscriptions.organizationId, organizationId));
  return org;
}

test("sem plano não dá para criar venda, mas dar baixa, desfazer e o que já foi enviado seguem funcionando", async () => {
  const db = await database();
  const fake = fakeAsaas();
  const { org: orgId, chargeId } = await integratedCharge(db, "org-bloqueada");
  const live = await startCheckout(db, { chargeId, method: "pix" }, { fetch: fake.fetch, now: NOW });
  assert.equal(live.kind, "pix");
  const paymentId = (await chargeRow(db, chargeId)).asaasPaymentId;
  assert.ok(paymentId);
  const org = await expire(db, orgId);

  await assert.rejects(() => assertCanSell(db, org, NOW), (error) => error instanceof DomainError && /teste grátis terminou/.test(error.message));

  const received = await receiveManually(db, orgId, { chargeId, amountCents: 10_000, paidOn: TODAY, method: "Dinheiro", note: "" }, fake.fetch);
  assert.ok(received.paymentId);
  assert.equal((await chargeRow(db, chargeId)).status, "paga");
  await reverseWithAsaas(db, orgId, chargeId, fake.fetch);
  assert.equal((await chargeRow(db, chargeId)).status, "pendente");

  const again = await startCheckout(db, { chargeId, method: "pix" }, { fetch: fake.fetch, now: NOW });
  assert.equal(again.kind, "pix", "o Pix que o cliente já recebeu continua pagável");
  assert.equal(fake.callsTo("POST", /^\/payments$/).length, 1, "nenhuma cobrança nova no Asaas");
});

test("quem tem plano em dia, ou teste, passa pelo bloqueio", async () => {
  const db = await database();
  const org = await addOrganization(db, "org-liberada");
  const [row] = await db.select().from(organizations).where(eq(organizations.id, org));
  await assertCanSell(db, row, NOW);
  await db.update(subscriptions).set({ status: "ativa", planCode: "gestao", periodEndsOn: "2026-12-17" }).where(eq(subscriptions.organizationId, org));
  await assertCanSell(db, row, NOW);
  await db.update(subscriptions).set({ periodEndsOn: "2026-11-16", trialEndsOn: "2026-11-01" }).where(eq(subscriptions.organizationId, org));
  await assert.rejects(() => assertCanSell(db, row, NOW), DomainError);
});

test("o modo Integrado exige plano Integrado ou teste ativo", async () => {
  const db = await database();
  const fake = fakeAsaas({ apiKey: "merchant-key", wallets: { "merchant-key": MERCHANT_WALLET, "test-key": "wallet-plataforma" } });
  const link = (id: string) => linkMerchantAccount(db, id, "merchant-key", fake.fetch);
  const org = (id: string) => addOrganization(db, id);

  const trial = await org("org-teste");
  await link(trial);
  await setReceivingMode(db, trial, "gestao");
  await setReceivingMode(db, trial, "integrado");

  const gestao = await org("org-gestao");
  await db.update(organizations).set({ asaasWalletId: MERCHANT_WALLET }).where(eq(organizations.id, gestao));
  await loadSubscription(db, (await db.select().from(organizations).where(eq(organizations.id, gestao)))[0], NOW);
  await db.update(subscriptions).set({ status: "ativa", planCode: "gestao", periodEndsOn: "2099-01-01", trialEndsOn: "2026-10-01" }).where(eq(subscriptions.organizationId, gestao));
  await assert.rejects(() => setReceivingMode(db, gestao, "integrado"), (error) => error instanceof DomainError && /plano Integrado/.test(error.message));
  await assert.rejects(() => link(gestao), DomainError);
  assert.equal((await db.select().from(organizations).where(eq(organizations.id, gestao)))[0].receivingMode, "gestao");

  await db.update(subscriptions).set({ planCode: "integrado" }).where(eq(subscriptions.organizationId, gestao));
  await setReceivingMode(db, gestao, "integrado");
  assert.equal((await db.select().from(organizations).where(eq(organizations.id, gestao)))[0].receivingMode, "integrado");
});

test("o link novo de quem está no Gestão não abre o Asaas, e o dono vê os assinantes", async () => {
  const db = await database();
  const fake = fakeAsaas();
  const { org, chargeId } = await integratedCharge(db, "org-link-gestao");
  const [row] = await db.select().from(organizations).where(eq(organizations.id, org));
  await loadSubscription(db, row, NOW);
  await db.update(subscriptions).set({ status: "ativa", planCode: "gestao", periodEndsOn: "2099-01-01", trialEndsOn: "2026-10-01" }).where(eq(subscriptions.organizationId, org));
  await assert.rejects(() => startCheckout(db, { chargeId, method: "pix" }, { fetch: fake.fetch, now: NOW }), DomainError);
  assert.equal(fake.calls.length, 0);

  const subscribers = await listSubscribers(db, TODAY);
  const mine = subscribers.find((subscriber) => subscriber.organizationId === org);
  assert.deepEqual(mine && { planCode: mine.planCode, state: mine.state, dueOn: mine.dueOn }, { planCode: "gestao", state: "ativa", dueOn: "2099-01-01" });
});
