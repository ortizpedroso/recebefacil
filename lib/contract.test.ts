import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { eq } from "drizzle-orm";
import { openIsolatedDatabase } from "./db";
import { createContract, updateContract } from "./ledger";
import { cents } from "./money";
import { charges, contracts, organizations } from "./schema";
import { insertClient } from "./tenant";

async function setup() {
  const dir = await mkdtemp(join(tmpdir(), "recebefacil-"));
  const db = await openIsolatedDatabase(dir);
  const organizationId = "org-contract";
  await db.insert(organizations).values({
    id: organizationId,
    viewerKey: "test:org-contract",
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

test("criar contrato manual gera parcelas e cobranças sem venda", async () => {
  const { db, organizationId, clientId } = await setup();
  const contractId = await createContract(db, organizationId, {
    clientId,
    description: "Manutenção anual",
    totalCents: cents(1_200_000),
    startsOn: "2026-01-01",
    endsOn: null,
    terms: "Contrato de manutenção.",
    installmentCount: 12,
    firstDue: "2026-02-01",
    periodicity: "mensal",
    method: "Boleto",
  });
  const [contract] = await db.select().from(contracts).where(eq(contracts.id, contractId));
  assert.equal(contract.saleId, null);
  assert.equal(contract.status, "ativo");
  const rows = await db.select().from(charges).where(eq(charges.contractId, contractId));
  assert.equal(rows.length, 12);
  assert.equal(rows.reduce((sum, row) => sum + row.amountCents, 0), 1_200_000);
  assert.equal(rows[0]?.count, 12);
  assert.ok(rows.some((row) => row.label === "Parcela 12 de 12"));
});

test("editar contrato muda só os dados, não o valor nem as parcelas", async () => {
  const { db, organizationId, clientId } = await setup();
  const contractId = await createContract(db, organizationId, {
    clientId,
    description: "Manutenção anual",
    totalCents: cents(1_200_000),
    startsOn: "2026-01-01",
    endsOn: null,
    terms: "",
    installmentCount: 12,
    firstDue: "2026-02-01",
    periodicity: "mensal",
    method: "Boleto",
  });
  await updateContract(db, organizationId, contractId, {
    description: "Manutenção editada",
    startsOn: "2026-01-15",
    endsOn: "2026-12-31",
    terms: "Termo novo",
  });
  const [contract] = await db.select().from(contracts).where(eq(contracts.id, contractId));
  assert.equal(contract.description, "Manutenção editada");
  assert.equal(contract.startsOn, "2026-01-15");
  assert.equal(contract.endsOn, "2026-12-31");
  assert.equal(contract.terms, "Termo novo");
  assert.equal(contract.totalCents, 1_200_000);
  const rows = await db.select().from(charges).where(eq(charges.contractId, contractId));
  assert.equal(rows.length, 12);
});
