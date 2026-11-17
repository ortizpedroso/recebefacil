import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { and, eq } from "drizzle-orm";
import { openIsolatedDatabase } from "./db";
import { DomainError, advanceRecurrences, cancelSale, createSale, registerPayment } from "./ledger";
import { cents } from "./money";
import { charges, clients, organizations, recurrences, sales } from "./schema";
import { ensureOrganization, insertClient, updateClient } from "./tenant";

test("uma venda de R$ 10.000 fecha entrada e quatro parcelas, e rejeita pagamento acima do saldo", async () => {
  const dir = await mkdtemp(join(tmpdir(), "recebefacil-"));
  const db = await openIsolatedDatabase(dir);
  const organizationId = "org-1";
  await db.insert(organizations).values({
    id: organizationId,
    viewerKey: "test:org-1",
    tradeName: "Teste",
    legalName: "Teste",
    document: "00.000.000/0001-00",
    email: "teste@exemplo.com",
    phone: "(92) 90000-0000",
    address: "Rua 1",
    timezone: "America/Manaus",
    asaasEnvironment: "demonstracao",
    asaasConnected: false,
    asaasSyncedAt: null,
    createdAt: new Date().toISOString(),
  });
  const clientId = await insertClient(db, organizationId, {
    kind: "pf",
    name: "João Silva",
    document: "111.444.777-35",
    email: "joao@exemplo.com",
    phone: "(92) 98888-0000",
    whatsapp: "(92) 98888-0000",
    zip: "",
    state: "AM",
    city: "Manaus",
    district: "",
    street: "",
    number: "",
    complement: "",
    notes: "",
  });
  const saleId = await createSale(db, organizationId, {
    clientId,
    soldOn: "2026-06-01",
    discountCents: cents(0),
    notes: "",
    mode: "parcelado",
    entryCents: cents(200_000),
    installmentCount: 4,
    firstDue: "2026-07-01",
    periodicity: "mensal",
    method: "Pix",
    makeContract: true,
    items: [{ catalogItemId: null, description: "Projeto de móveis", kind: "produto", quantity: 1, unitCents: cents(1_000_000) }],
  });
  const rows = await db.select().from(charges).where(and(eq(charges.organizationId, organizationId), eq(charges.saleId, saleId)));
  assert.equal(rows.length, 5);
  assert.equal(rows.reduce((sum, row) => sum + row.amountCents, 0), 1_000_000);
  const chargeRows = rows.filter((row) => row.label === "Entrada");
  assert.equal(chargeRows.length, 1);
  assert.equal(chargeRows[0]?.amountCents, 200_000);
  const paymentId = await registerPayment(db, organizationId, {
    chargeId: chargeRows[0].id,
    amountCents: cents(200_000),
    paidOn: "2026-06-01",
    method: "Pix",
    note: "entrada",
    idempotencyKey: "pay-1",
  });
  const replay = await registerPayment(db, organizationId, {
    chargeId: chargeRows[0].id,
    amountCents: cents(200_000),
    paidOn: "2026-06-01",
    method: "Pix",
    note: "entrada",
    idempotencyKey: "pay-1",
  });
  assert.equal(replay, paymentId);
  await assert.rejects(
    () =>
      registerPayment(db, organizationId, {
        chargeId: chargeRows[0].id,
        amountCents: cents(1),
        paidOn: "2026-06-02",
        method: "Pix",
        note: "outro",
        idempotencyKey: "pay-1",
      }),
    DomainError,
  );
  const [sale] = await db.select().from(sales).where(eq(sales.id, saleId));
  assert.equal(sale.status, "parcial");
});

test("duas aberturas ao mesmo tempo criam uma empresa só", async () => {
  const dir = await mkdtemp(join(tmpdir(), "recebefacil-"));
  const db = await openIsolatedDatabase(dir);
  const [first, second] = await Promise.all([
    ensureOrganization(db, "viewer:paralelo", "Ana"),
    ensureOrganization(db, "viewer:paralelo", "Bruno"),
  ]);
  assert.equal(first.id, second.id);
  const rows = await db.select().from(clients).where(eq(clients.organizationId, first.id));
  assert.equal(rows.length, 8);
});

test("a recorrência gera o ciclo vencido, o cancelamento respeita o recebimento e a outra empresa não vê o cliente", async () => {
  const dir = await mkdtemp(join(tmpdir(), "recebefacil-"));
  const db = await openIsolatedDatabase(dir);
  const organizationId = "org-a";
  await db.insert(organizations).values({
    id: organizationId,
    viewerKey: "test:org-a",
    tradeName: "Empresa A",
    legalName: "Empresa A",
    document: "00.000.000/0001-00",
    email: "a@exemplo.com",
    phone: "(92) 90000-0000",
    address: "Rua 1",
    timezone: "America/Manaus",
    asaasEnvironment: "demonstracao",
    asaasConnected: false,
    asaasSyncedAt: null,
    createdAt: new Date().toISOString(),
  });
  await db.insert(organizations).values({
    id: "org-b",
    viewerKey: "test:org-b",
    tradeName: "Empresa B",
    legalName: "Empresa B",
    document: "00.000.000/0001-01",
    email: "b@exemplo.com",
    phone: "(92) 90000-0001",
    address: "Rua 2",
    timezone: "America/Manaus",
    asaasEnvironment: "demonstracao",
    asaasConnected: false,
    asaasSyncedAt: null,
    createdAt: new Date().toISOString(),
  });
  const clientId = await insertClient(db, organizationId, {
    kind: "pf",
    name: "Maria Oliveira",
    document: "529.982.247-25",
    email: "",
    phone: "(92) 98888-1111",
    whatsapp: "(92) 98888-1111",
    zip: "",
    state: "AM",
    city: "Manaus",
    district: "",
    street: "",
    number: "",
    complement: "",
    notes: "",
  });
  await updateClient(db, organizationId, clientId, {
    kind: "pf",
    name: "Maria Oliveira Atualizada",
    document: "529.982.247-25",
    email: "",
    phone: "(92) 98888-1111",
    whatsapp: "(92) 98888-1111",
    zip: "",
    state: "AM",
    city: "Manaus",
    district: "",
    street: "",
    number: "",
    complement: "",
    notes: "",
  });
  const [renamed] = await db.select().from(clients).where(eq(clients.id, clientId));
  assert.equal(renamed.name, "Maria Oliveira Atualizada");
  const hidden = await db.select().from(clients).where(eq(clients.organizationId, "org-b"));
  assert.equal(hidden.length, 0);

  await createSale(db, organizationId, {
    clientId,
    soldOn: "2026-10-01",
    discountCents: cents(0),
    notes: "",
    mode: "recorrente",
    entryCents: cents(0),
    installmentCount: 1,
    firstDue: "2026-10-01",
    periodicity: "mensal",
    method: "Pix",
    makeContract: true,
    items: [{ catalogItemId: null, description: "Curso", kind: "servico", quantity: 1, unitCents: cents(200_000) }],
  });
  await advanceRecurrences(db, organizationId, "2026-11-16");
  const cycle = await db.select().from(charges).where(eq(charges.organizationId, organizationId));
  assert.equal(cycle.length, 2);
  const [recurrence] = await db.select().from(recurrences).where(eq(recurrences.organizationId, organizationId));
  assert.equal(recurrence.nextOn, "2026-12-01");

  const cashId = await createSale(db, organizationId, {
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
    items: [{ catalogItemId: null, description: "Consulta", kind: "servico", quantity: 1, unitCents: cents(15_000) }],
  });
  await cancelSale(db, organizationId, cashId);
  const [cancelled] = await db.select().from(sales).where(eq(sales.id, cashId));
  assert.equal(cancelled.status, "cancelada");

  const openSale = await createSale(db, organizationId, {
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
    items: [{ catalogItemId: null, description: "Consulta paga", kind: "servico", quantity: 1, unitCents: cents(15_000) }],
  });
  const [openCharge] = await db.select().from(charges).where(eq(charges.saleId, openSale));
  await registerPayment(db, organizationId, { chargeId: openCharge.id, amountCents: cents(15_000), paidOn: "2026-11-16", method: "Pix", note: "" });
  await assert.rejects(() => cancelSale(db, organizationId, openSale), DomainError);
});
