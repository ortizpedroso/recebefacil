process.env.RECEBEFACIL_SECRET = "p".repeat(40);

import assert from "node:assert/strict";
import test from "node:test";
import { eq } from "drizzle-orm";
import { AsaasError } from "./asaas";
import { createCharge } from "./ledger";
import { cents } from "./money";
import {
  checkWebhookToken,
  generateWebhookToken,
  loadPlatformSettings,
  parsePlatformForm,
  platformClientFor,
  platformSettingsView,
  savePlatformSettings,
  testPlatformConnection,
  type PlatformSettingsInput,
} from "./platform-settings";
import { charges, clients, organizations, platformSettings } from "./schema";
import { addClient, addOrganization, testDatabase } from "./test-support";
import { fakeAsaas } from "./test-asaas";

// Abrir o banco leva alguns segundos, então os testes dividem um só e recomeçam a configuração da plataforma.
let shared: ReturnType<typeof testDatabase> | undefined;
async function freshDb() {
  shared ??= testDatabase();
  const db = await shared;
  await db.delete(platformSettings);
  return db;
}

const base: PlatformSettingsInput = { environment: "sandbox", apiKey: "test-key-1234", webhookToken: null, feeBp: 150, planGestaoCents: 4990, planIntegradoCents: 3990 };

test("a plataforma nasce com taxa de 1,5% e os planos de R$ 49,90 e R$ 39,90, sem nada configurado", async () => {
  const db = await freshDb();
  const view = platformSettingsView(await loadPlatformSettings(db));
  assert.equal(view.feeBp, 150);
  assert.equal(view.planGestaoCents, 4990);
  assert.equal(view.planIntegradoCents, 3990);
  assert.equal(view.environment, "sandbox");
  assert.equal(view.ready, false);
  assert.deepEqual(view.apiKey, { configured: false, hint: "" });
});

test("a chave e o token ficam cifrados no banco e a tela nunca recebe o texto original", async () => {
  const db = await freshDb();
  await savePlatformSettings(db, base, "dono@plataforma.com");
  const token = await generateWebhookToken(db, "dono@plataforma.com");
  const row = await loadPlatformSettings(db);

  const stored = JSON.stringify(row);
  assert.ok(!stored.includes("test-key-1234"), "a chave não pode estar no banco em texto puro");
  assert.ok(!stored.includes(token), "o token não pode estar no banco em texto puro");
  assert.match(row.asaasApiKeyEnc, /^v1:/);

  const shown = JSON.stringify(platformSettingsView(row));
  for (const forbidden of ["test-key-1234", token, row.asaasApiKeyEnc, row.asaasWebhookTokenEnc]) {
    assert.ok(!shown.includes(forbidden), "a tela não pode receber segredo nem texto cifrado");
  }
  const view = platformSettingsView(row);
  assert.deepEqual(view.apiKey, { configured: true, hint: "1234" });
  assert.deepEqual(view.webhookToken, { configured: true, hint: token.slice(-4) });
  assert.equal(view.updatedBy, "dono@plataforma.com");
});

test("campo em branco mantém o segredo salvo e um valor novo substitui", async () => {
  const db = await freshDb();
  await savePlatformSettings(db, base, "dono");
  const fake = fakeAsaas({ apiKey: "test-key-1234" });

  await savePlatformSettings(db, { ...base, apiKey: null, feeBp: 200 }, "dono");
  await platformClientFor(await loadPlatformSettings(db), fake.fetch).getWallets();
  assert.equal(fake.calls.at(-1)?.token, "test-key-1234");
  assert.equal((await loadPlatformSettings(db)).platformFeeBp, 200);

  await savePlatformSettings(db, { ...base, apiKey: "test-key-9999" }, "dono");
  const next = fakeAsaas({ apiKey: "test-key-9999" });
  await platformClientFor(await loadPlatformSettings(db), next.fetch).getWallets();
  assert.equal(next.calls.at(-1)?.token, "test-key-9999");
});

test("sem chave salva, não existe cliente do Asaas para usar", () => {
  assert.throws(() => platformClientFor({ ...platformSettingsRow(), asaasApiKeyEnc: "" }), (error) => error instanceof AsaasError && error.kind === "config");
});

function platformSettingsRow() {
  return {
    id: "default",
    asaasEnvironment: "sandbox" as const,
    asaasApiKeyEnc: "",
    asaasApiKeyHint: "",
    asaasWalletId: "",
    asaasAccountName: "",
    asaasWebhookTokenEnc: "",
    asaasWebhookTokenHint: "",
    platformFeeBp: 150,
    planGestaoCents: 4990,
    planIntegradoCents: 3990,
    updatedAt: "",
    updatedBy: "",
  };
}

test("o token gerado tem 32 bytes, aparece uma vez e só ele passa na conferência", async () => {
  const db = await freshDb();
  assert.equal(checkWebhookToken(await loadPlatformSettings(db), "qualquer"), "unconfigured");
  const token = await generateWebhookToken(db, "dono");
  assert.equal(Buffer.from(token, "base64url").length, 32);
  const row = await loadPlatformSettings(db);
  assert.equal(checkWebhookToken(row, token), "match");
  assert.equal(checkWebhookToken(row, `${token}x`), "mismatch");
  assert.equal(checkWebhookToken(row, ""), "mismatch");
  assert.notEqual(await generateWebhookToken(db, "dono"), token);
});

test("segredo cifrado com outro segredo mestre conta como não configurado, sem derrubar o webhook", async () => {
  const db = await freshDb();
  const token = await generateWebhookToken(db, "dono");
  const row = await loadPlatformSettings(db);
  process.env.RECEBEFACIL_SECRET = "q".repeat(40);
  try {
    assert.equal(checkWebhookToken(row, token), "unconfigured");
  } finally {
    process.env.RECEBEFACIL_SECRET = "p".repeat(40);
  }
});

test("testar a conexão guarda a carteira e o nome da conta, e a plataforma só fica pronta com chave, carteira e token", async () => {
  const db = await freshDb();
  await savePlatformSettings(db, base, "dono");
  const fake = fakeAsaas({ apiKey: "test-key-1234", wallets: { "test-key-1234": "wallet-plataforma" }, accountName: "RecebeFácil Ltda" });
  const result = await testPlatformConnection(db, fake.fetch);
  assert.deepEqual(result, { accountName: "RecebeFácil Ltda", environment: "sandbox", walletId: "wallet-plataforma" });
  assert.equal(platformSettingsView(await loadPlatformSettings(db)).ready, false, "falta o token do webhook");
  await generateWebhookToken(db, "dono");
  const view = platformSettingsView(await loadPlatformSettings(db));
  assert.equal(view.ready, true);
  assert.equal(view.accountName, "RecebeFácil Ltda");
});

test("chave recusada pelo Asaas dá erro claro e não grava carteira", async () => {
  const db = await freshDb();
  await savePlatformSettings(db, base, "dono");
  const fake = fakeAsaas({ apiKey: "outra" });
  await assert.rejects(() => testPlatformConnection(db, fake.fetch), (error) => error instanceof AsaasError && error.kind === "auth");
  assert.equal((await loadPlatformSettings(db)).asaasWalletId, "");
});

test("mudar de ambiente solta o que o ambiente anterior conhecia e preserva o que já foi pago", async () => {
  const db = await freshDb();
  const org = await addOrganization(db, "org-ambiente");
  const client = await addClient(db, org, "Cliente");
  await db.update(clients).set({ asaasCustomerId: "cus_1" }).where(eq(clients.id, client));
  await db.update(organizations).set({ receivingMode: "integrado", asaasWalletId: "wallet-loja", asaasAccountName: "Loja" }).where(eq(organizations.id, org));
  const open = await createCharge(db, org, { clientId: client, amountCents: cents(10_000), dueOn: "2026-12-01", method: "Pix" });
  const paid = await createCharge(db, org, { clientId: client, amountCents: cents(5_000), dueOn: "2026-12-01", method: "Pix" });
  await db.update(charges).set({ asaasPaymentId: "pay_open", asaasBillingType: "PIX", asaasValueCents: 10_000 }).where(eq(charges.id, open));
  await db.update(charges).set({ asaasPaymentId: "pay_paid", paidCents: 5_000, status: "paga" }).where(eq(charges.id, paid));
  await savePlatformSettings(db, base, "dono");
  await db.update(platformSettings).set({ asaasWalletId: "wallet-plataforma", asaasAccountName: "Plataforma" });

  await savePlatformSettings(db, { ...base, apiKey: null, feeBp: 100 }, "dono");
  assert.equal((await loadPlatformSettings(db)).asaasWalletId, "wallet-plataforma", "mesmo ambiente mantém a carteira");
  assert.equal((await db.select().from(charges).where(eq(charges.id, open)))[0].asaasPaymentId, "pay_open");

  await savePlatformSettings(db, { ...base, apiKey: "chave-de-producao", environment: "producao" }, "dono");
  const row = await loadPlatformSettings(db);
  assert.equal(row.asaasWalletId, "");
  assert.equal(row.asaasAccountName, "");
  assert.equal((await db.select().from(clients).where(eq(clients.id, client)))[0].asaasCustomerId, null);
  const [openRow] = await db.select().from(charges).where(eq(charges.id, open));
  assert.equal(openRow.asaasPaymentId, null);
  assert.equal(openRow.asaasValueCents, null);
  assert.equal((await db.select().from(charges).where(eq(charges.id, paid)))[0].asaasPaymentId, "pay_paid");
  const [orgRow] = await db.select().from(organizations).where(eq(organizations.id, org));
  assert.equal(orgRow.receivingMode, "gestao");
  assert.equal(orgRow.asaasWalletId, "");
});

test("o formulário converte percentual e reais, e recusa o que não faz sentido", () => {
  const ok = parsePlatformForm({ environment: "producao", apiKey: "", webhookToken: "", fee: "1,5", planGestao: "49,90", planIntegrado: "39,90" });
  assert.deepEqual(ok, { environment: "producao", apiKey: null, webhookToken: null, feeBp: 150, planGestaoCents: 4990, planIntegradoCents: 3990 });
  const form = { environment: "sandbox", apiKey: "", webhookToken: "", fee: "1,5", planGestao: "49,90", planIntegrado: "39,90" };
  assert.throws(() => parsePlatformForm({ ...form, fee: "25" }), /0% a 20%/);
  assert.throws(() => parsePlatformForm({ ...form, fee: "abc" }), /percentual/);
  assert.throws(() => parsePlatformForm({ ...form, planGestao: "grátis" }), /Gestão/);
  assert.throws(() => parsePlatformForm({ ...form, planIntegrado: "" }), /Integrado/);
  assert.throws(() => parsePlatformForm({ ...form, environment: "demo" }), /ambiente/);
  assert.throws(() => parsePlatformForm({ ...form, webhookToken: "curto" }), /32 a 255/);
  assert.throws(() => parsePlatformForm({ ...form, apiKey: "abc" }), /curta/);
  assert.throws(() => parsePlatformForm({ ...form, apiKey: "$aact_prod_000abcdef" }), /Escolha o ambiente Produção/);
  assert.throws(() => parsePlatformForm({ ...form, environment: "producao", apiKey: "$aact_hmlg_000abcdef" }), /Escolha o ambiente Sandbox/);
  assert.equal(parsePlatformForm({ ...form, apiKey: "$aact_hmlg_000abcdef" }).apiKey, "$aact_hmlg_000abcdef");
  assert.equal(parsePlatformForm({ ...form, apiKey: "$aact_YTU5YTE0M2M2" }).apiKey, "$aact_YTU5YTE0M2M2", "chave antiga, sem marca de ambiente, passa");
});
