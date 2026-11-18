import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { eq } from "drizzle-orm";
import { createSale } from "./ledger";
import { eraseClient, exportClient } from "./privacy";
import { charges, clients, contacts, sales } from "./schema";
import { addClient, addOrganization, saleInput, testDatabase } from "./test-support";

test("cliente sem histórico some de vez, com os contatos", async () => {
  const db = await testDatabase();
  const org = await addOrganization(db, randomUUID());
  const clientId = await addClient(db, org, "Ana Lima");
  await db.insert(contacts).values({ id: randomUUID(), organizationId: org, clientId, channel: "whatsapp", summary: "pediu prazo", createdAt: new Date().toISOString() });
  assert.equal(await eraseClient(db, org, clientId), "apagado");
  assert.equal((await db.select().from(clients).where(eq(clients.id, clientId))).length, 0);
  assert.equal((await db.select().from(contacts).where(eq(contacts.clientId, clientId))).length, 0);
});

test("cliente com venda perde os dados pessoais e a venda e as cobranças ficam", async () => {
  const db = await testDatabase();
  const org = await addOrganization(db, randomUUID());
  const clientId = await addClient(db, org, "Bruno Costa");
  await createSale(db, org, saleInput(clientId));
  const before = await exportClient(db, org, clientId);
  assert.equal(before.client.name, "Bruno Costa");
  assert.equal(before.sales.length, 1);
  assert.equal(before.charges.length, 4);

  assert.equal(await eraseClient(db, org, clientId), "anonimizado");
  const [row] = await db.select().from(clients).where(eq(clients.id, clientId));
  assert.equal(row.name, "Cliente removido");
  assert.equal(row.phone, "");
  assert.equal(row.whatsapp, "");
  assert.equal(row.active, false);
  assert.equal((await db.select().from(sales).where(eq(sales.clientId, clientId))).length, 1);
  assert.equal((await db.select().from(charges).where(eq(charges.clientId, clientId))).length, 4);
});

test("cliente de outra empresa não é exportado nem apagado", async () => {
  const db = await testDatabase();
  const org = await addOrganization(db, randomUUID());
  const other = await addOrganization(db, randomUUID());
  const clientId = await addClient(db, org, "Carla Dias");
  await assert.rejects(exportClient(db, other, clientId), /não encontrado/);
  await assert.rejects(eraseClient(db, other, clientId), /não encontrado/);
  assert.equal((await db.select().from(clients).where(eq(clients.id, clientId))).length, 1);
});
