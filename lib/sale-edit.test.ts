import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { and, eq } from "drizzle-orm";
import { openIsolatedDatabase } from "./db";
import { DomainError, createSale, registerPayment, updateSale } from "./ledger";
import { cents } from "./money";
import { charges, organizations, sales } from "./schema";
import { insertClient } from "./tenant";

async function setup() {
  const dir = await mkdtemp(join(tmpdir(), "recebefacil-"));
  const db = await openIsolatedDatabase(dir);
  const organizationId = "org-edit";
  await db.insert(organizations).values({
    id: organizationId,
    viewerKey: "test:org-edit",
    tradeName: "Teste",
    legalName: "Teste",
    document: "00.000.000/0001-00",
    email: "t@exemplo.com",
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
    email: "",
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
  return { db, organizationId, clientId };
}

test("editar uma venda sem pagamento refaz parcelas e cobranças", async () => {
  const { db, organizationId, clientId } = await setup();
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
    items: [{ catalogItemId: null, description: "Projeto", kind: "produto", quantity: 1, unitCents: cents(1_000_000) }],
  });
  await updateSale(db, organizationId, saleId, {
    clientId,
    soldOn: "2026-06-01",
    discountCents: cents(0),
    notes: "editado",
    mode: "parcelado",
    entryCents: cents(100_000),
    installmentCount: 2,
    firstDue: "2026-07-01",
    periodicity: "mensal",
    method: "Boleto",
    makeContract: true,
    items: [{ catalogItemId: null, description: "Projeto", kind: "produto", quantity: 1, unitCents: cents(500_000) }],
  });
  const chargeRows = await db.select().from(charges).where(and(eq(charges.organizationId, organizationId), eq(charges.saleId, saleId)));
  assert.equal(chargeRows.length, 3);
  assert.equal(chargeRows.reduce((sum, row) => sum + row.amountCents, 0), 500_000);
  const [sale] = await db.select().from(sales).where(eq(sales.id, saleId));
  assert.equal(sale.notes, "editado");
  assert.equal(sale.totalCents, 500_000);
});

test("editar uma venda com pagamento é recusado", async () => {
  const { db, organizationId, clientId } = await setup();
  const saleId = await createSale(db, organizationId, {
    clientId,
    soldOn: "2026-06-01",
    discountCents: cents(0),
    notes: "",
    mode: "avista",
    entryCents: cents(0),
    installmentCount: 1,
    firstDue: "2026-06-01",
    periodicity: "mensal",
    method: "Pix",
    makeContract: false,
    items: [{ catalogItemId: null, description: "Consulta", kind: "servico", quantity: 1, unitCents: cents(15_000) }],
  });
  const [charge] = await db.select().from(charges).where(eq(charges.saleId, saleId));
  await registerPayment(db, organizationId, { chargeId: charge.id, amountCents: cents(15_000), paidOn: "2026-06-01", method: "Pix", note: "" });
  await assert.rejects(
    () =>
      updateSale(db, organizationId, saleId, {
        clientId,
        soldOn: "2026-06-01",
        discountCents: cents(0),
        notes: "tentativa",
        mode: "avista",
        entryCents: cents(0),
        installmentCount: 1,
        firstDue: "2026-06-01",
        periodicity: "mensal",
        method: "Pix",
        makeContract: false,
        items: [{ catalogItemId: null, description: "Consulta", kind: "servico", quantity: 1, unitCents: cents(20_000) }],
      }),
    DomainError,
  );
});
