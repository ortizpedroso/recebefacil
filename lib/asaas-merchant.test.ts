process.env.RECEBEFACIL_SECRET = "p".repeat(40);

import assert from "node:assert/strict";
import test from "node:test";
import { eq } from "drizzle-orm";
import { linkMerchantAccount, setReceivingMode, unlinkMerchantAccount } from "./asaas-merchant";
import { DomainError } from "./errors";
import { organizations, platformSettings } from "./schema";
import { configurePlatform, fakeAsaas, MERCHANT_WALLET, PLATFORM_WALLET } from "./test-asaas";
import { addOrganization, testDatabase } from "./test-support";

let shared: ReturnType<typeof testDatabase> | undefined;
let configured: Promise<string> | undefined;
async function database() {
  shared ??= testDatabase();
  const db = await shared;
  configured ??= configurePlatform(db);
  await configured;
  return db;
}

const orgRow = async (db: Awaited<ReturnType<typeof database>>, id: string) => (await db.select().from(organizations).where(eq(organizations.id, id)))[0];

test("ligar a conta guarda só a carteira e o nome, descarta a chave e liga o modo Integrado", async () => {
  const db = await database();
  const org = await addOrganization(db, "org-liga");
  const fake = fakeAsaas({ apiKey: "chave-do-lojista", wallets: { "chave-do-lojista": MERCHANT_WALLET }, accountName: "Padaria da Ana" });
  const result = await linkMerchantAccount(db, org, "  chave-do-lojista ", fake.fetch);
  assert.equal(result.accountName, "Padaria da Ana");

  const row = await orgRow(db, org);
  assert.equal(row.asaasWalletId, MERCHANT_WALLET);
  assert.equal(row.asaasAccountName, "Padaria da Ana");
  assert.equal(row.receivingMode, "integrado");
  assert.ok(!JSON.stringify(row).includes("chave-do-lojista"), "a chave não fica em coluna nenhuma da empresa");
  assert.equal(fake.callsTo("GET", /wallets/)[0].token, "chave-do-lojista", "a consulta usa a chave do lojista");
});

test("a chave da própria plataforma é recusada, para o split nunca mandar o dinheiro para si mesmo", async () => {
  const db = await database();
  const org = await addOrganization(db, "org-mesma");
  const fake = fakeAsaas({ apiKey: "chave-da-plataforma", wallets: { "chave-da-plataforma": PLATFORM_WALLET } });
  await assert.rejects(() => linkMerchantAccount(db, org, "chave-da-plataforma", fake.fetch), /conta da plataforma/);
  const row = await orgRow(db, org);
  assert.equal(row.asaasWalletId, "");
  assert.equal(row.receivingMode, "gestao");
});

test("chave que o Asaas recusa dá mensagem clara sem repetir a chave", async () => {
  const db = await database();
  const org = await addOrganization(db, "org-invalida");
  const fake = fakeAsaas({ apiKey: "outra-chave" });
  await assert.rejects(
    () => linkMerchantAccount(db, org, "chave-errada-123", fake.fetch),
    (error) => error instanceof DomainError && /não aceitou esta chave/.test(error.message) && !error.message.includes("chave-errada-123"),
  );
  assert.equal((await orgRow(db, org)).asaasWalletId, "");
});

test("enquanto a plataforma não estiver configurada, o Integrado fica indisponível", async () => {
  const db = await database();
  const org = await addOrganization(db, "org-indisponivel");
  const fake = fakeAsaas({ apiKey: "chave-do-lojista", wallets: { "chave-do-lojista": MERCHANT_WALLET } });
  const [{ asaasWebhookTokenEnc: saved }] = await db.select().from(platformSettings);
  await db.update(platformSettings).set({ asaasWebhookTokenEnc: "" });
  try {
    await assert.rejects(() => linkMerchantAccount(db, org, "chave-do-lojista", fake.fetch), /ainda não está disponível/);
    assert.equal(fake.calls.length, 0);
    await assert.rejects(() => setReceivingMode(db, org, "integrado"), DomainError);
  } finally {
    await db.update(platformSettings).set({ asaasWebhookTokenEnc: saved });
  }
});

test("voltar para Gestão é sempre possível, e desligar a conta limpa a carteira", async () => {
  const db = await database();
  const org = await addOrganization(db, "org-volta");
  const fake = fakeAsaas({ apiKey: "chave-do-lojista", wallets: { "chave-do-lojista": MERCHANT_WALLET } });
  await linkMerchantAccount(db, org, "chave-do-lojista", fake.fetch);
  await setReceivingMode(db, org, "gestao");
  assert.equal((await orgRow(db, org)).receivingMode, "gestao");
  assert.equal((await orgRow(db, org)).asaasWalletId, MERCHANT_WALLET, "a conta continua ligada");
  await setReceivingMode(db, org, "integrado");
  assert.equal((await orgRow(db, org)).receivingMode, "integrado");
  await unlinkMerchantAccount(db, org);
  const row = await orgRow(db, org);
  assert.deepEqual([row.receivingMode, row.asaasWalletId, row.asaasAccountName], ["gestao", "", ""]);
});
