import assert from "node:assert/strict";
import test from "node:test";
import { and, eq } from "drizzle-orm";
import { DomainError, createContractForSale, createSale, endSubscription } from "./ledger";
import { cents } from "./money";
import { addClient, addOrganization, saleInput, testDatabase } from "./test-support";
import { previewDraft, trimmedRows, type Draft } from "./sale-draft";
import { catalogImages, catalogItems, charges, clients, contracts, organizations, payments, recurrences, sales } from "./schema";
import { clientSchema, saleSchema, toClientInput } from "./schemas";
import { insertCatalog, ensureOrganization } from "./tenant";
import { loadCatalogPhoto, parsePhoto, saveCatalogPhoto } from "./photos";

const newClient = { kind: "pf" as const, name: "Cliente Novo", document: "", email: "", phone: "(11) 98877-1020", whatsapp: "(11) 98877-1020", zip: "", state: "", city: "", district: "", street: "", number: "", complement: "", notes: "" };

test("cliente novo e venda entram juntos, e uma venda inválida não deixa o cliente para trás", async () => {
  const db = await testDatabase();
  const org = await addOrganization(db, "org-1");
  const saleId = await createSale(db, org, saleInput("", { mode: "avista", firstDue: "2026-10-01" }), newClient);
  const [sale] = await db.select().from(sales).where(eq(sales.id, saleId));
  const [client] = await db.select().from(clients).where(eq(clients.id, sale.clientId));
  assert.equal(client.name, "Cliente Novo");

  const before = await db.select().from(clients).where(eq(clients.organizationId, org));
  await assert.rejects(() => createSale(db, org, saleInput("", { discountCents: cents(40_000) }), { ...newClient, name: "Fantasma" }), DomainError);
  const failedMidway = saleInput("", { items: [{ catalogItemId: "nao-existe", description: "Item", kind: "produto", quantity: 1, unitCents: cents(1_000) }] });
  await assert.rejects(() => createSale(db, org, failedMidway, { ...newClient, name: "Fantasma 2" }), DomainError);
  const after = await db.select().from(clients).where(eq(clients.organizationId, org));
  assert.equal(after.length, before.length);
});

test("à vista com Já recebi agora cria o pagamento na mesma transação e quita a venda", async () => {
  const db = await testDatabase();
  const org = await addOrganization(db, "org-2");
  const client = await addClient(db, org, "Ana");
  const saleId = await createSale(db, org, saleInput(client, { mode: "avista", firstDue: "2026-11-17", paidNow: { method: "Dinheiro", paidOn: "2026-11-17" } }));
  const [sale] = await db.select().from(sales).where(eq(sales.id, saleId));
  assert.equal(sale.status, "paga");
  const [payment] = await db.select().from(payments).where(eq(payments.organizationId, org));
  assert.equal(payment.amountCents, 40_000);
  assert.equal(payment.method, "Dinheiro");
  await assert.rejects(() => createSale(db, org, saleInput(client, { mode: "parcelado", paidNow: { method: "Pix", paidOn: "2026-11-17" } })), /à vista/);
});

test("a prévia da tela mostra as mesmas parcelas que o servidor grava, com juros e reajuste", async () => {
  const db = await testDatabase();
  const org = await addOrganization(db, "org-3");
  const client = await addClient(db, org, "Marcos");
  const draft: Draft = {
    lines: [{ key: "a", catalogItemId: null, description: "Lote", kind: "produto", quantity: 1, unitCents: 4_500_000 }],
    discountCents: 0,
    plan: "parcelado",
    count: 240,
    entryCents: 900_000,
    firstDue: "2026-02-10",
    periodicity: "mensal",
    interestBp: 100,
    adjustBp: 500,
    paidNow: false,
    method: "Pix",
    today: "2026-01-10",
  };
  const preview = previewDraft(draft);
  assert.ok(preview.ok);
  const saleId = await createSale(db, org, {
    clientId: client,
    soldOn: draft.today,
    discountCents: cents(0),
    notes: "",
    mode: "parcelado",
    entryCents: cents(draft.entryCents),
    installmentCount: 240,
    firstDue: draft.firstDue,
    periodicity: "mensal",
    interestMonthlyBp: 100,
    adjustYearlyBp: 500,
    method: "Pix",
    makeContract: false,
    items: [{ catalogItemId: null, description: "Lote", kind: "produto", quantity: 1, unitCents: cents(4_500_000) }],
  });
  const saved = await db.select().from(charges).where(and(eq(charges.organizationId, org), eq(charges.saleId, saleId)));
  const byNumber = saved.sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
  assert.equal(byNumber.length, preview.rows.length);
  assert.deepEqual(byNumber.map((row) => row.amountCents), preview.rows.map((row) => row.amountCents));
  assert.deepEqual(byNumber.map((row) => row.dueOn), preview.rows.map((row) => row.dueOn));
  assert.equal(preview.payTotalCents, saved.reduce((sum, row) => sum + row.amountCents, 0));
  const trimmed = trimmedRows(preview.rows);
  assert.equal(trimmed.shown.length, 6);
  assert.equal(trimmed.hidden, 241 - 6 - 1);
  assert.equal(trimmed.last, preview.rows[240]);
});

test("a prévia explica o erro em português e a mensalidade mostra os três primeiros ciclos", () => {
  const base: Draft = { lines: [{ key: "a", catalogItemId: null, description: "Plano", kind: "servico", quantity: 1, unitCents: 24_900 }], discountCents: 0, plan: "mensalidade", count: 3, entryCents: 0, firstDue: "2026-12-31", periodicity: "mensal", interestBp: 0, adjustBp: 0, paidNow: false, method: "Pix", today: "2026-11-17" };
  const monthly = previewDraft(base);
  assert.ok(monthly.ok && monthly.recurring);
  assert.deepEqual(monthly.rows.map((row) => row.dueOn), ["2026-12-31", "2027-01-31", "2027-02-28"]);
  const broken = previewDraft({ ...base, plan: "parcelado", entryCents: 30_000 });
  assert.deepEqual(broken, { ok: false, error: "A entrada passa do total.", totalCents: 24_900 });
  assert.deepEqual(previewDraft({ ...base, lines: [] }), { ok: false, error: null, totalCents: 0 });
});

test("gerar contrato cria um só por venda e encerrar mensalidade para as cobranças futuras", async () => {
  const db = await testDatabase();
  const org = await addOrganization(db, "org-4");
  const client = await addClient(db, org, "Patrícia");
  const parceled = await createSale(db, org, saleInput(client));
  const first = await createContractForSale(db, org, parceled);
  assert.equal(await createContractForSale(db, org, parceled), first);
  const rows = await db.select().from(contracts).where(eq(contracts.organizationId, org));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].endsOn, "2027-01-17");

  const monthly = await createSale(db, org, saleInput(client, { mode: "recorrente", soldOn: "2026-11-01", firstDue: "2026-11-20", items: [{ catalogItemId: null, description: "Plano mensal", kind: "servico", quantity: 1, unitCents: cents(24_900) }] }));
  await assert.rejects(() => endSubscription(db, org, parceled, "2026-11-17"), /mensalidade/);
  await endSubscription(db, org, monthly, "2026-11-17");
  const [recurrence] = await db.select().from(recurrences).where(eq(recurrences.organizationId, org));
  assert.equal(recurrence.status, "cancelada");
  const left = await db.select().from(charges).where(and(eq(charges.organizationId, org), eq(charges.saleId, monthly)));
  assert.equal(left.filter((row) => row.status === "cancelada").length, 1);
});

test("empresa nova nasce vazia e só a demonstração pública traz dados de exemplo", async () => {
  const db = await testDatabase();
  const fresh = await ensureOrganization(db, "production:user:novo", "Joana", "joana@loja.com.br");
  assert.equal(fresh.tradeName, "Minha empresa");
  assert.equal(fresh.timezone, "America/Sao_Paulo");
  assert.equal((await db.select().from(clients).where(eq(clients.organizationId, fresh.id))).length, 0);
  assert.equal((await db.select().from(catalogItems).where(eq(catalogItems.organizationId, fresh.id))).length, 0);
  assert.equal((await db.select().from(charges).where(eq(charges.organizationId, fresh.id))).length, 0);
  const demo = await ensureOrganization(db, "public:demonstracao", "Visitante");
  assert.equal((await db.select().from(clients).where(eq(clients.organizationId, demo.id))).length, 8);
  assert.equal((await db.select().from(organizations)).length, 2);
});

test("foto do produto: uma por item, a nova troca a antiga e outra empresa não enxerga", async () => {
  const db = await testDatabase();
  const org = await addOrganization(db, "org-5");
  const other = await addOrganization(db, "org-6");
  const item = await insertCatalog(db, org, { kind: "produto", name: "Sérum", description: "", category: "", sku: "", priceCents: cents(8_990), stockQuantity: 3 });
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]);
  await saveCatalogPhoto(db, org, item, parsePhoto(png));
  await saveCatalogPhoto(db, org, item, parsePhoto(Uint8Array.from([0xff, 0xd8, 0xff, 9, 9, 9])));
  const rows = await db.select().from(catalogImages).where(eq(catalogImages.catalogItemId, item));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].mime, "image/jpeg");
  const stored = await loadCatalogPhoto(db, org, rows[0].id);
  assert.deepEqual([...(stored?.bytes ?? [])], [0xff, 0xd8, 0xff, 9, 9, 9]);
  assert.equal(await loadCatalogPhoto(db, other, rows[0].id), null);
  await assert.rejects(() => saveCatalogPhoto(db, other, item, parsePhoto(png)), /não encontrado/);
});

test("cadastro de cliente pede nome e WhatsApp, e valida CPF ou CNPJ só quando preenchido", () => {
  const base = { name: "Ana Souza", whatsapp: "(11) 98877-1020", document: "", email: "" };
  const ok = clientSchema.safeParse(base);
  assert.ok(ok.success);
  assert.equal(toClientInput(ok.data).phone, "(11) 98877-1020");
  assert.equal(toClientInput(ok.data).kind, "pf");
  assert.equal(clientSchema.safeParse({ ...base, document: "111.444.777-35" }).success, true);
  const cnpj = clientSchema.safeParse({ ...base, document: "11.222.333/0001-81" });
  assert.ok(cnpj.success);
  assert.equal(toClientInput(cnpj.data).kind, "pj");
  assert.equal(clientSchema.safeParse({ ...base, document: "123.456.789-00" }).success, false);
  assert.equal(clientSchema.safeParse({ ...base, whatsapp: "9887" }).success, false);
  assert.equal(clientSchema.safeParse({ ...base, name: "A" }).success, false);
});

test("a venda aceita cliente já cadastrado ou cliente novo, nunca os dois nem nenhum", () => {
  const sale = { soldOn: "2026-11-17", discountCents: 0, mode: "avista", entryCents: 0, installmentCount: 1, firstDue: "2026-11-17", periodicity: "mensal", method: "Pix", items: [{ catalogItemId: null, description: "Item", kind: "produto", quantity: 1, unitCents: 100 }] };
  const person = { name: "Ana Souza", whatsapp: "(11) 98877-1020", document: "" };
  assert.equal(saleSchema.safeParse({ ...sale, newClient: person }).success, true);
  assert.equal(saleSchema.safeParse({ ...sale, clientId: "3f2b8c3e-8f3a-4a52-9c1e-0e8d7b6a5f4d" }).success, true);
  assert.equal(saleSchema.safeParse(sale).success, false);
  assert.equal(saleSchema.safeParse({ ...sale, newClient: person, clientId: "3f2b8c3e-8f3a-4a52-9c1e-0e8d7b6a5f4d" }).success, false);
});
