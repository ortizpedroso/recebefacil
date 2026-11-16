import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { and, eq } from "drizzle-orm";
import { openIsolatedDatabase } from "./db";
import { DomainError, createSale, registerPayment } from "./ledger";
import { cents } from "./money";
import { clients, installments, organizations, sales } from "./schema";
import { ensureOrganization, insertClient } from "./tenant";

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
  const rows = await db.select().from(installments).where(and(eq(installments.organizationId, organizationId), eq(installments.saleId, saleId)));
  assert.equal(rows.reduce((sum, row) => sum + row.amountCents, 0), 1_000_000);
  assert.equal(rows[0]?.amountCents, 200_000);
  const entry = rows.find((row) => row.label === "Entrada");
  assert.ok(entry);
  const { charges } = await import("./schema");
  const chargeRows = await db.select().from(charges).where(eq(charges.installmentId, entry.id));
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
