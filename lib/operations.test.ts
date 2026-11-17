import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { eq } from "drizzle-orm";
import { payPlatformInvoice, subscribe } from "./billing";
import { openIsolatedDatabase } from "./db";
import { DomainError, createSale } from "./ledger";
import { cents } from "./money";
import { bucketCounts, listReceivables } from "./receivables";
import { catalogItems, charges, organizations, platformInvoices, sales } from "./schema";
import { insertCatalog, insertClient } from "./tenant";

async function org() {
  const dir = await mkdtemp(join(tmpdir(), "recebefacil-ops-"));
  const db = await openIsolatedDatabase(dir);
  const organizationId = "org-ops";
  await db.insert(organizations).values({
    id: organizationId,
    viewerKey: "test:ops",
    tradeName: "Teste",
    legalName: "Teste",
    document: "34.567.890/0001-30",
    email: "teste@exemplo.com",
    phone: "(92) 90000-0000",
    address: "Rua 1",
    timezone: "America/Manaus",
    asaasEnvironment: "demonstracao",
    asaasConnected: false,
    asaasSyncedAt: null,
    createdAt: "2026-11-16T00:00:00.000Z",
  });
  return { db, organizationId };
}

test("a venda de produto baixa o estoque e recusa quantidade maior", async () => {
  const { db, organizationId } = await org();
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
  const itemId = await insertCatalog(db, organizationId, {
    kind: "produto",
    name: "Peça",
    description: "",
    category: "Peças",
    sku: "P1",
    priceCents: cents(1000),
    stockQuantity: 1,
  });
  const sale = {
    clientId,
    soldOn: "2026-11-16",
    discountCents: cents(0),
    notes: "",
    mode: "avista" as const,
    entryCents: cents(0),
    installmentCount: 1,
    firstDue: "2026-11-16",
    periodicity: "mensal" as const,
    method: "Pix",
    makeContract: false,
  };
  await assert.rejects(
    createSale(db, organizationId, { ...sale, items: [{ catalogItemId: itemId, description: "Peça", kind: "produto", quantity: 2, unitCents: cents(1000) }] }),
    DomainError,
  );
  await createSale(db, organizationId, { ...sale, items: [{ catalogItemId: itemId, description: "Peça", kind: "produto", quantity: 1, unitCents: cents(1000) }] });
  const [item] = await db.select().from(catalogItems).where(eq(catalogItems.id, itemId));
  assert.equal(item?.stockQuantity, 0);
});

test("assinar o plano abre fatura e o pagamento fecha o período", async () => {
  const { db, organizationId } = await org();
  const invoiceId = await subscribe(db, organizationId, "profissional", "2026-11-16");
  const [open] = await db.select().from(platformInvoices).where(eq(platformInvoices.id, invoiceId));
  assert.equal(open?.status, "aberta");
  assert.equal(open?.amountCents, 19_900);
  await payPlatformInvoice(db, organizationId, invoiceId, "2026-11-16");
  const [paid] = await db.select().from(platformInvoices).where(eq(platformInvoices.id, invoiceId));
  assert.equal(paid?.status, "paga");
});

test("parcelas passam para a página seguinte", async () => {
  const { db, organizationId } = await org();
  const clientId = await insertClient(db, organizationId, {
    kind: "pf",
    name: "João Silva",
    document: "111.444.777-35",
    email: "",
    phone: "(92) 98888-0000",
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
  await db.insert(sales).values({
    id: "sale-1",
    organizationId,
    code: "VND-1",
    clientId,
    soldOn: "2026-11-16",
    discountCents: 0,
    totalCents: 900,
    notes: "",
    mode: "parcelado",
    status: "aguardando",
    createdAt: "2026-11-16T00:00:00.000Z",
  });
  for (let index = 0; index < 9; index += 1) {
    await db.insert(charges).values({
      id: `charge-${index}`,
      organizationId,
      code: `COB-${index + 1}`,
      saleId: "sale-1",
      contractId: null,
      recurrenceId: null,
      clientId,
      number: index + 1,
      count: 9,
      label: `Parcela ${index + 1}`,
      method: "Pix",
      paidOn: null,
      dueOn: `2026-12-${String(index + 1).padStart(2, "0")}`,
      amountCents: 100,
      paidCents: 0,
      status: "pendente",
    });
  }
  const settings = { lateFineBp: 200, lateInterestMonthlyBp: 100 };
  assert.equal((await bucketCounts(db, organizationId, "2026-11-16")).proximas, 9);
  const second = await listReceivables(db, organizationId, "2026-11-16", settings, { bucket: "proximas", limit: 8, offset: 8 });
  assert.equal(second.length, 1);
  assert.equal(second[0].title, "Parcela 9");
});
