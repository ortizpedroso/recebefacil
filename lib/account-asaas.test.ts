import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { authenticate, registerCompany } from "./accounts";
import { issueAsaasCharge, saveAsaasCredentials } from "./asaas-book";
import { applyAsaasWebhook } from "./asaas-webhook";
import { dumpCompanies, restoreCompanies } from "./backup";
import { openIsolatedDatabase } from "./db";
import { createSale } from "./ledger";
import { applyMigrations } from "./migrate";
import { cents } from "./money";
import { eraseClient } from "./privacy";
import { charges, clients, organizations, payments } from "./schema";
import { openSeal } from "./secrets";
import { insertClient } from "./tenant";

process.env.RECEBEFACIL_SECRET = "segredo-de-teste-longo";

async function database() {
  const dir = await mkdtemp(join(tmpdir(), "recebefacil-asaas-"));
  return openIsolatedDatabase(dir);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

test("a empresa nova nasce vazia com o nome e o CNPJ dela", async () => {
  const db = await database();
  const id = await registerCompany(db, {
    tradeName: "Oficina Norte",
    legalName: "Oficina Norte Ltda",
    document: "34.567.890/0001-30",
    email: "oficina@exemplo.com",
    password: "senha-forte",
  });
  const [org] = await db.select().from(organizations).where(eq(organizations.id, id));
  const people = await db.select().from(clients).where(eq(clients.organizationId, id));
  assert.equal(org?.tradeName, "Oficina Norte");
  assert.equal(org?.document, "34.567.890/0001-30");
  assert.equal(people.length, 0);
  assert.equal(await authenticate(db, "oficina@exemplo.com", "senha-errada"), null);
  assert.ok(await authenticate(db, "oficina@exemplo.com", "senha-forte"));
});

test("a chave do Asaas fica cifrada e a cobrança devolve o link", async () => {
  const db = await database();
  const organizationId = await registerCompany(db, {
    tradeName: "Oficina Norte",
    legalName: "Oficina Norte Ltda",
    document: "34.567.890/0001-30",
    email: "oficina@exemplo.com",
    password: "senha-forte",
  });
  const apiKey = "$aact_test_chave_que_nao_pode_aparecer";
  const saved = await saveAsaasCredentials(db, organizationId, { apiKey, environment: "sandbox" }, async (url) => {
    if (String(url).endsWith("/myAccount")) return json({ name: "Oficina Norte", email: "oficina@exemplo.com", cpfCnpj: "34567890000130" });
    return json({}, 404);
  });
  const [org] = await db.select().from(organizations).where(eq(organizations.id, organizationId));
  assert.equal(org?.asaasApiKeyCipher?.includes(apiKey), false);
  assert.equal(openSeal(org?.asaasApiKeyCipher || "", process.env.RECEBEFACIL_SECRET || ""), apiKey);
  assert.ok(saved.webhookToken.length > 10);

  const clientId = await insertClient(db, organizationId, {
    kind: "pf",
    name: "João Silva",
    document: "111.444.777-35",
    email: "joao@exemplo.com",
    phone: "92988880000",
    whatsapp: "",
    zip: "",
    state: "AM",
    city: "Manaus",
    district: "",
    street: "",
    number: "",
    complement: "",
    notes: "",
  });
  await createSale(db, organizationId, {
    clientId,
    soldOn: "2026-11-16",
    discountCents: cents(0),
    notes: "",
    mode: "avista",
    entryCents: cents(0),
    installmentCount: 1,
    firstDue: "2026-11-16",
    periodicity: "mensal",
    method: "Pix",
    makeContract: false,
    items: [{ catalogItemId: null, description: "Serviço", kind: "servico", quantity: 1, unitCents: cents(1500) }],
  });
  const [charge] = await db.select().from(charges).where(eq(charges.organizationId, organizationId));
  await issueAsaasCharge(db, organizationId, charge.id, async (url) => {
    const path = String(url);
    if (path.endsWith("/customers")) return json({ id: "cus_1" });
    if (path.endsWith("/payments")) return json({ id: "pay_1", invoiceUrl: "https://sandbox.asaas.com/i/1", bankSlipUrl: null });
    if (path.endsWith("/pixQrCode")) return json({ payload: "000201" });
    return json({}, 404);
  });
  const [issued] = await db.select().from(charges).where(eq(charges.id, charge.id));
  assert.equal(issued?.invoiceUrl, "https://sandbox.asaas.com/i/1");
  assert.equal(issued?.pixPayload, "000201");

  const notice = {
    id: "evt_1",
    event: "PAYMENT_RECEIVED",
    payment: { id: "pay_1", externalReference: charge.id, value: 15, billingType: "PIX", paymentDate: "2026-11-16" },
  };
  await applyAsaasWebhook(db, saved.webhookToken, notice);
  await applyAsaasWebhook(db, saved.webhookToken, notice);
  const rows = await db.select().from(payments).where(eq(payments.organizationId, organizationId));
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.idempotencyKey, "asaas:pay_1");
});

test("apagar o cliente leva os lançamentos dele", async () => {
  const db = await database();
  const organizationId = "org-erase";
  await db.insert(organizations).values({
    id: organizationId,
    viewerKey: "test:erase",
    tradeName: "Teste",
    legalName: "Teste",
    document: "34.567.890/0001-30",
    email: "teste@exemplo.com",
    phone: "",
    address: "",
    timezone: "America/Manaus",
    asaasEnvironment: "sandbox",
    asaasConnected: false,
    asaasSyncedAt: null,
    createdAt: "2026-11-16T00:00:00.000Z",
  });
  const clientId = await insertClient(db, organizationId, {
    kind: "pf",
    name: "João Silva",
    document: "111.444.777-35",
    email: "",
    phone: "92988880000",
    whatsapp: "",
    zip: "",
    state: "AM",
    city: "Manaus",
    district: "",
    street: "",
    number: "",
    complement: "",
    notes: "",
  });
  await createSale(db, organizationId, {
    clientId,
    soldOn: "2026-11-16",
    discountCents: cents(0),
    notes: "",
    mode: "avista",
    entryCents: cents(0),
    installmentCount: 1,
    firstDue: "2026-11-16",
    periodicity: "mensal",
    method: "Pix",
    makeContract: false,
    items: [{ catalogItemId: null, description: "Serviço", kind: "servico", quantity: 1, unitCents: cents(1000) }],
  });
  await eraseClient(db, organizationId, clientId);
  assert.equal((await db.select().from(clients).where(eq(clients.organizationId, organizationId))).length, 0);
  assert.equal((await db.select().from(charges).where(eq(charges.organizationId, organizationId))).length, 0);
});

test("o dump de empresas restaura a linha em outro banco", async () => {
  const source = await database();
  await registerCompany(source, {
    tradeName: "Oficina Norte",
    legalName: "Oficina Norte Ltda",
    document: "34.567.890/0001-30",
    email: "oficina@exemplo.com",
    password: "senha-forte",
  });
  const dump = await dumpCompanies(source);
  const target = await database();
  assert.equal(await restoreCompanies(target, dump), 1);
  const rows = await target.select().from(organizations);
  assert.equal(rows[0]?.tradeName, "Oficina Norte");
});

test("a migração acrescenta coluna numa tabela que já existe", async () => {
  const client = new PGlite();
  await client.waitReady;
  await client.exec(`create table organizations (
    id text primary key,
    viewer_key text not null,
    trade_name text not null,
    legal_name text not null,
    document text not null,
    email text not null,
    phone text not null,
    address text not null,
    timezone text not null,
    asaas_environment text not null,
    asaas_connected boolean not null,
    asaas_synced_at text,
    created_at text not null
  )`);
  await client.exec("create table clients (id text primary key)");
  await client.exec("create table charges (id text primary key)");
  await client.exec("create table catalog_items (id text primary key)");
  await applyMigrations(
    (statement) => client.exec(statement).then(() => undefined),
    async () => ((await client.query<{ id: string }>("select id from schema_migrations")).rows).map((row) => row.id),
  );
  await client.exec(`insert into organizations (id, viewer_key, trade_name, legal_name, document, email, phone, address, timezone, asaas_environment, asaas_connected, created_at, password_hash)
    values ('1', 'k', 'n', 'n', 'd', 'e', '', '', 'America/Manaus', 'sandbox', false, '2026-11-16', 'hash')`);
  const rows = await client.query<{ password_hash: string }>("select password_hash from organizations");
  assert.equal(rows.rows[0]?.password_hash, "hash");
});
