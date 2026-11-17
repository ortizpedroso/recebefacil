import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { and, eq } from "drizzle-orm";
import { openIsolatedDatabase } from "./db";
import { createSale, deleteSale, registerPayment } from "./ledger";
import { cents } from "./money";
import { charges, organizations, sales } from "./schema";
import { insertCatalog, insertClient } from "./tenant";

async function setup() {
  const dir = await mkdtemp(join(tmpdir(), "recebefacil-"));
  const db = await openIsolatedDatabase(dir);
  const organizationId = "org-delete";
  await db.insert(organizations).values({
    id: organizationId,
    viewerKey: "test:org-delete",
    tradeName: "Teste",
    legalName: "Teste",
    document: "00.000.000/0001-00",
    email: "t@exemplo.com",
    phone: "(92) 90000-0000",
    address: "Rua 1",
    timezone: "America/Manaus",
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

test("excluir venda sem pagamento apaga a venda e devolve o estoque", async () => {
  const { db, organizationId, clientId } = await setup();
  const itemId = await insertCatalog(db, organizationId, {
    kind: "produto",
    name: "Terreno",
    description: "Lote",
    category: "Imóveis",
    sku: "IMV-01",
    priceCents: cents(1_000_000),
    stockQuantity: 5,
  });
  const saleId = await createSale(db, organizationId, {
    clientId,
    soldOn: "2026-06-01",
    discountCents: cents(0),
    notes: "",
    mode: "parcelado",
    entryCents: cents(0),
    installmentCount: 2,
    firstDue: "2026-07-01",
    periodicity: "mensal",
    method: "Pix",
    makeContract: true,
    items: [{ catalogItemId: itemId, description: "Terreno", kind: "produto", quantity: 1, unitCents: cents(1_000_000) }],
  });
  await deleteSale(db, organizationId, saleId);
  const gone = await db.select().from(sales).where(eq(sales.id, saleId));
  assert.equal(gone.length, 0);
  const chargeRows = await db.select().from(charges).where(and(eq(charges.organizationId, organizationId), eq(charges.saleId, saleId)));
  assert.equal(chargeRows.length, 0);
});

test("excluir venda com pagamento é recusado", async () => {
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
  await assert.rejects(() => deleteSale(db, organizationId, saleId), /Desfaça/);
});
