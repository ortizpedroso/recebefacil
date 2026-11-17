import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { and, eq } from "drizzle-orm";
import { migrate, type DB } from "./db";
import { deleteSale, registerPayment } from "./ledger";
import { cents } from "./money";
import * as schema from "./schema";

// Banco como a versão anterior o deixou: parcelas à parte, cobrança com installment_id e status "estornada".
const LEGACY = `
create table organizations (id text primary key, viewer_key text not null unique, trade_name text not null, legal_name text not null, document text not null, email text not null, phone text not null, address text not null, timezone text not null, asaas_environment text not null, asaas_connected boolean not null, asaas_synced_at text, created_at text not null);
create table clients (id text primary key, organization_id text not null references organizations(id), kind text not null, name text not null, document text not null, email text not null, phone text not null, whatsapp text not null, zip text not null, state text not null, city text not null, district text not null, street text not null, number text not null, complement text not null, notes text not null, active boolean not null, created_at text not null);
create table sales (id text primary key, organization_id text not null references organizations(id), code text not null, client_id text not null references clients(id), sold_on text not null, discount_cents integer not null, total_cents integer not null, notes text not null, mode text not null, status text not null, created_at text not null);
create table installments (id text primary key, organization_id text not null references organizations(id), sale_id text references sales(id), contract_id text, client_id text not null references clients(id), number integer not null, count integer not null, label text not null, due_on text not null, amount_cents integer not null, paid_cents integer not null, status text not null);
create table charges (id text primary key, organization_id text not null references organizations(id), code text not null, client_id text not null references clients(id), sale_id text, contract_id text, installment_id text, recurrence_id text, amount_cents integer not null, paid_cents integer not null, due_on text not null, method text not null, status text not null, paid_on text, check (paid_cents <= amount_cents));
create table payments (id text primary key, organization_id text not null references organizations(id), charge_id text not null references charges(id), installment_id text, amount_cents integer not null, paid_on text not null, method text not null, note text not null, idempotency_key text, reversed_at text);
create unique index payments_idempotency on payments (organization_id, idempotency_key);
create table due_changes (id text primary key, organization_id text not null references organizations(id), installment_id text not null references installments(id), previous_due text not null, next_due text not null, created_at text not null);
insert into organizations values ('org', 'v', 'T', 'T', '0', 'e', 'p', 'a', 'America/Manaus', 'demonstracao', false, null, '2026-01-01');
insert into clients values ('cli', 'org', 'pf', 'Ana', '1', '', '1', '1', '', '', '', '', '', '', '', '', true, '2026-01-01');
insert into sales values ('sale', 'org', 'VND-0001', 'cli', '2026-01-10', 0, 3000, '', 'parcelado', 'aguardando', '2026-01-10');
insert into installments values ('i1', 'org', 'sale', null, 'cli', 1, 3, 'Entrada', '2026-01-10', 1000, 0, 'pendente');
insert into installments values ('i2', 'org', 'sale', null, 'cli', 2, 3, 'Parcela 1/2', '2026-02-10', 1000, 0, 'pendente');
insert into installments values ('i3', 'org', 'sale', null, 'cli', 3, 3, 'Parcela 2/2', '2026-03-10', 1000, 0, 'pendente');
insert into charges values ('c1', 'org', 'COB-0001', 'cli', 'sale', null, 'i1', null, 1000, 0, '2026-01-10', 'Pix', 'estornada', null);
insert into charges values ('c2', 'org', 'COB-0002', 'cli', 'sale', null, 'i2', null, 1000, 0, '2026-02-10', 'Pix', 'pendente', null);
insert into charges values ('c3', 'org', 'COB-0002', 'cli', 'sale', null, 'i3', null, 1000, 0, '2026-03-10', 'Pix', 'pendente', null);
insert into due_changes values ('d1', 'org', 'i2', '2026-02-05', '2026-02-10', '2026-02-01');
`;

async function legacyDatabase() {
  const client = new PGlite(await mkdtemp(join(tmpdir(), "recebefacil-legacy-")));
  await client.waitReady;
  await client.exec(LEGACY);
  const exec = (statement: string) => client.exec(statement).then(() => undefined);
  return { client, exec, db: drizzle(client, { schema }) as unknown as DB };
}

test("um banco antigo migra: cobrança herda número e rótulo da parcela, estorno vira pendente e o histórico aponta para a cobrança", async () => {
  const { exec, db } = await legacyDatabase();
  await migrate(exec);
  await migrate(exec);

  const rows = await db.select().from(schema.charges).where(eq(schema.charges.organizationId, "org"));
  const byId = new Map(rows.map((row) => [row.id, row]));
  assert.deepEqual([byId.get("c1")?.number, byId.get("c1")?.count, byId.get("c1")?.label], [1, 3, "Entrada"]);
  assert.equal(byId.get("c2")?.label, "Parcela 1/2");
  assert.equal(byId.get("c1")?.status, "pendente");
  const [change] = await db.select().from(schema.dueChanges).where(eq(schema.dueChanges.id, "d1"));
  assert.equal(change.chargeId, "c2");
  const [sale] = await db.select().from(schema.sales).where(eq(schema.sales.id, "sale"));
  assert.deepEqual([sale.installmentCount, sale.entryCents, sale.interestMonthlyBp, sale.adjustYearlyBp], [2, 1000, 0, 0]);
  const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, "org"));
  assert.deepEqual([org.lateFineBp, org.lateInterestMonthlyBp], [200, 100]);
});

test("código repetido de cobrança no banco antigo é renomeado em vez de derrubar a inicialização", async () => {
  const { exec, db } = await legacyDatabase();
  await migrate(exec);
  const rows = await db.select().from(schema.charges).where(eq(schema.charges.organizationId, "org"));
  assert.equal(new Set(rows.map((row) => row.code)).size, 3);
});

test("no banco migrado a cobrança antiga recebe pagamento e a venda antiga pode ser excluída", async () => {
  const { exec, db } = await legacyDatabase();
  await migrate(exec);
  await registerPayment(db, "org", { chargeId: "c1", amountCents: cents(1000), paidOn: "2026-01-10", method: "Pix", note: "" });
  const [paid] = await db.select().from(schema.charges).where(eq(schema.charges.id, "c1"));
  assert.equal(paid.status, "paga");
  await assert.rejects(() => deleteSale(db, "org", "sale"), /Estorne/);

  const { reverseCharge } = await import("./ledger");
  await reverseCharge(db, "org", "c1");
  await deleteSale(db, "org", "sale");
  const left = await db.select().from(schema.charges).where(and(eq(schema.charges.organizationId, "org"), eq(schema.charges.saleId, "sale")));
  assert.equal(left.length, 0);
  assert.equal((await db.select().from(schema.dueChanges)).length, 0);
});
