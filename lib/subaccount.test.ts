import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { eq } from "drizzle-orm";
import { decryptSecret } from "./crypto";
import { loadPlatformSettings } from "./platform-settings";
import { organizations, subscriptions, withdrawals } from "./schema";
import { openSubaccount, parseSubaccountForm, refreshSubaccountStatus } from "./subaccount";
import { configurePlatform, fakeAsaas, VALID_CPF } from "./test-asaas";
import { addOrganization, testDatabase } from "./test-support";
import { authorizeTransfer, inferPixKeyType, loadWallet, requestWithdrawal } from "./withdrawals";

const FORM = {
  document: VALID_CPF,
  name: "Maria Souza",
  email: "maria@loja.com",
  birthDate: "1990-05-10",
  phone: "(92) 98888-1234",
  income: "5.000,00",
  zip: "69000-000",
  street: "Rua das Flores",
  number: "100",
  district: "Centro",
};

async function setup() {
  const db = await testDatabase();
  await configurePlatform(db);
  const org = await addOrganization(db, randomUUID());
  await db.insert(subscriptions).values({ id: `sub-${org}`, organizationId: org, planCode: "integrado", status: "ativa", trialEndsOn: "2026-01-01", periodEndsOn: "2099-01-01" });
  const asaas = fakeAsaas();
  const row = async () => (await db.select().from(organizations).where(eq(organizations.id, org)))[0];
  return { db, org, asaas, row };
}

test("o formulário recusa CPF sem data de nascimento e CEP curto", () => {
  const company = { name: "Loja", email: "loja@x.com" };
  assert.throws(() => parseSubaccountForm({ ...FORM, birthDate: "" }, company), /data de nascimento/);
  assert.throws(() => parseSubaccountForm({ ...FORM, zip: "123" }, company), /CEP/);
  assert.throws(() => parseSubaccountForm({ ...FORM, document: "123" }, company), /CPF ou CNPJ/);
  const parsed = parseSubaccountForm(FORM, company);
  assert.equal(parsed.cpfCnpj, "39053344705");
  assert.equal(parsed.incomeValueCents, 500_000);
  assert.equal(parsed.mobilePhone, "92988881234");
});

test("abrir a subconta guarda conta, carteira e a chave cifrada, e liga o modo Integrado", async () => {
  const { db, org, asaas, row } = await setup();
  await openSubaccount(db, org, FORM, asaas.fetch);
  const saved = await row();
  assert.equal(saved.asaasAccountStatus, "pendente");
  assert.equal(saved.receivingMode, "integrado");
  assert.match(saved.asaasWalletId, /^wallet-sub-/);
  assert.notEqual(saved.asaasAccountKeyEnc, "");
  assert.ok(!saved.asaasAccountKeyEnc.includes("sub-key"));
  assert.match(decryptSecret(saved.asaasAccountKeyEnc), /^sub-key-/);
  const sent = asaas.callsTo("POST", /^\/accounts$/)[0];
  assert.equal(sent.token, "test-key");
  assert.equal(sent.body?.incomeValue, 5000);
  await assert.rejects(openSubaccount(db, org, FORM, asaas.fetch), /já foi aberta/);
});

test("o status acompanha o Asaas a cada leitura", async () => {
  const { db, org, asaas, row } = await setup();
  await openSubaccount(db, org, FORM, asaas.fetch);
  const settings = await loadPlatformSettings(db);
  const key = decryptSecret((await row()).asaasAccountKeyEnc);
  asaas.setAccount(key, { status: "AWAITING_APPROVAL" });
  assert.equal(await refreshSubaccountStatus(db, await row(), settings, asaas.fetch), "em_analise");
  asaas.setAccount(key, { status: "APPROVED" });
  assert.equal(await refreshSubaccountStatus(db, await row(), settings, asaas.fetch), "aprovada");
  assert.equal((await row()).asaasAccountStatus, "aprovada");
});

test("saque só com conta aprovada, dentro do saldo, e o status converge para o do Asaas", async () => {
  const { db, org, asaas, row } = await setup();
  await openSubaccount(db, org, FORM, asaas.fetch);
  const settings = await loadPlatformSettings(db);
  const key = decryptSecret((await row()).asaasAccountKeyEnc);
  asaas.setAccount(key, { balance: 100 });
  await assert.rejects(requestWithdrawal(db, await row(), settings, { amountCents: 5_000 as never, pixKey: "maria@loja.com" }, new Date(), asaas.fetch), /aprovar/);
  asaas.setAccount(key, { status: "APPROVED" });
  await refreshSubaccountStatus(db, await row(), settings, asaas.fetch);
  await assert.rejects(requestWithdrawal(db, await row(), settings, { amountCents: 20_000 as never, pixKey: "maria@loja.com" }, new Date(), asaas.fetch), /saldo/);
  const made = await requestWithdrawal(db, await row(), settings, { amountCents: 5_000 as never, pixKey: "Maria@Loja.com" }, new Date(), asaas.fetch);
  assert.equal(made.status, "processando");
  assert.equal(made.pixKey, "maria@loja.com");
  const transfer = asaas.callsTo("POST", /^\/transfers$/)[0];
  assert.equal(transfer.token, key);
  assert.equal(transfer.body?.externalReference, made.id);
  assert.equal(transfer.body?.value, 50);

  assert.deepEqual(await authorizeTransfer(db, { id: made.asaasTransferId, value: 50, externalReference: made.id }), { approved: true, reason: "" });
  assert.equal((await authorizeTransfer(db, { id: made.asaasTransferId, value: 60, externalReference: made.id })).approved, false);
  assert.equal((await authorizeTransfer(db, { id: "tra_x", value: 50, externalReference: "outro" })).approved, false);

  asaas.setTransferStatus(made.asaasTransferId ?? "", "DONE");
  const wallet = await loadWallet(db, await row(), settings, new Date(), asaas.fetch);
  assert.equal(wallet.history[0].status, "pago");
  assert.equal(wallet.balanceCents, 10_000);
  assert.equal(wallet.nextFeeCents, 0);
  assert.equal((await db.select().from(withdrawals)).length, 1);
});

test("a chave Pix é reconhecida pelo formato", () => {
  assert.deepEqual(inferPixKeyType("390.533.447-05"), { key: "39053344705", type: "CPF" });
  assert.deepEqual(inferPixKeyType("34.567.890/0001-30"), { key: "34567890000130", type: "CNPJ" });
  assert.deepEqual(inferPixKeyType("(92) 98888-1234"), { key: "92988881234", type: "PHONE" });
  assert.equal(inferPixKeyType("123e4567-e89b-12d3-a456-426614174000").type, "EVP");
  assert.throws(() => inferPixKeyType("abc"), /Chave Pix/);
});
