import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { eq } from "drizzle-orm";
import { openIsolatedDatabase } from "./db";
import { createCharge } from "./ledger";
import { cents } from "./money";
import { charges, organizations } from "./schema";
import { insertClient } from "./tenant";

async function setup() {
  const dir = await mkdtemp(join(tmpdir(), "recebefacil-"));
  const db = await openIsolatedDatabase(dir);
  const organizationId = "org-charge";
  await db.insert(organizations).values({
    id: organizationId,
    viewerKey: "test:org-charge",
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
    name: "Carlos Santos",
    document: "529.982.247-25",
    email: "",
    phone: "(92) 98888-2222",
    whatsapp: "(92) 98888-2222",
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

test("criar cobrança avulsa fica pendente e sem origem", async () => {
  const { db, organizationId, clientId } = await setup();
  const chargeId = await createCharge(db, organizationId, {
    clientId,
    amountCents: cents(45_000),
    dueOn: "2026-05-01",
    method: "Pix",
  });
  const [charge] = await db.select().from(charges).where(eq(charges.id, chargeId));
  assert.equal(charge.saleId, null);
  assert.equal(charge.status, "pendente");
  assert.equal(charge.amountCents, 45_000);
  assert.equal(charge.code, "COB-0001");
});

test("o código da cobrança não repete após remover uma do meio", async () => {
  const { db, organizationId, clientId } = await setup();
  await createCharge(db, organizationId, { clientId, amountCents: cents(100), dueOn: "2026-01-01", method: "Pix" });
  const middle = await createCharge(db, organizationId, { clientId, amountCents: cents(100), dueOn: "2026-01-02", method: "Pix" });
  await createCharge(db, organizationId, { clientId, amountCents: cents(100), dueOn: "2026-01-03", method: "Pix" });
  await db.delete(charges).where(eq(charges.id, middle));
  const fourth = await createCharge(db, organizationId, { clientId, amountCents: cents(100), dueOn: "2026-01-04", method: "Pix" });
  const [charge] = await db.select().from(charges).where(eq(charges.id, fourth));
  assert.equal(charge.code, "COB-0004");
});
