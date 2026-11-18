import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { eq } from "drizzle-orm";
import { openIsolatedDatabase } from "./db";
import { createRecurrence, updateRecurrence } from "./ledger";
import { cents } from "./money";
import { charges, organizations, recurrences } from "./schema";
import { insertClient } from "./tenant";

async function setup() {
  const dir = await mkdtemp(join(tmpdir(), "recebefacil-"));
  const db = await openIsolatedDatabase(dir);
  const organizationId = "org-recurrence";
  await db.insert(organizations).values({
    id: organizationId,
    viewerKey: "test:org-recurrence",
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
  return { db, organizationId, clientId };
}

test("criar recorrência manual gera a primeira cobrança", async () => {
  const { db, organizationId, clientId } = await setup();
  const recurrenceId = await createRecurrence(db, organizationId, {
    clientId,
    description: "Mensalidade do curso",
    amountCents: cents(200_000),
    periodicity: "mensal",
    startsOn: "2026-03-01",
    endsOn: null,
    method: "Pix",
  });
  const [recurrence] = await db.select().from(recurrences).where(eq(recurrences.id, recurrenceId));
  assert.equal(recurrence.status, "ativa");
  assert.equal(recurrence.nextOn, "2026-04-01");
  const chargeRows = await db.select().from(charges).where(eq(charges.recurrenceId, recurrenceId));
  assert.equal(chargeRows.length, 1);
  assert.equal(chargeRows[0].dueOn, "2026-03-01");
  assert.equal(chargeRows[0].amountCents, 200_000);
});

test("editar recorrência muda descrição, valor e encerramento", async () => {
  const { db, organizationId, clientId } = await setup();
  const recurrenceId = await createRecurrence(db, organizationId, {
    clientId,
    description: "Mensalidade",
    amountCents: cents(200_000),
    periodicity: "mensal",
    startsOn: "2026-03-01",
    endsOn: null,
    method: "Pix",
  });
  await updateRecurrence(db, organizationId, recurrenceId, {
    description: "Mensalidade nova",
    amountCents: cents(250_000),
    endsOn: "2026-12-31",
  });
  const [recurrence] = await db.select().from(recurrences).where(eq(recurrences.id, recurrenceId));
  assert.equal(recurrence.description, "Mensalidade nova");
  assert.equal(recurrence.amountCents, 250_000);
  assert.equal(recurrence.endsOn, "2026-12-31");
  assert.equal(recurrence.periodicity, "mensal");
});
