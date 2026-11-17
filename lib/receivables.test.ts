import assert from "node:assert/strict";
import test from "node:test";
import { and, eq } from "drizzle-orm";
import { createSale, registerPayment, reverseCharge } from "./ledger";
import { cents } from "./money";
import { bucketCounts, clientSummaries, homeKpis, listReceivables, saleSummaries } from "./receivables";
import { charges } from "./schema";
import { addClient, addOrganization, saleInput, testDatabase } from "./test-support";

const today = "2026-11-17";
const settings = { lateFineBp: 200, lateInterestMonthlyBp: 100 };

async function book() {
  const db = await testDatabase();
  const org = await addOrganization(db, "org-r");
  const ana = await addClient(db, org, "Ana Souza");
  const bruno = await addClient(db, org, "Bruno Lima");
  // Ana: 4 parcelas de R$ 100 (17/10 atrasada, 17/11 vence hoje, 17/12 e 17/01 futuras).
  const anaSale = await createSale(db, org, saleInput(ana));
  // Bruno: 2 parcelas de R$ 100, as duas atrasadas.
  const brunoSale = await createSale(db, org, saleInput(bruno, { installmentCount: 2, firstDue: "2026-09-30", items: [{ catalogItemId: null, description: "Limpeza de pele", kind: "servico", quantity: 2, unitCents: cents(10_000) }] }));
  // Venda à vista já recebida neste mês.
  await createSale(db, org, saleInput(ana, { mode: "avista", soldOn: "2026-11-05", firstDue: "2026-11-05", paidNow: { method: "Pix", paidOn: "2026-11-05" }, items: [{ catalogItemId: null, description: "Sérum", kind: "produto", quantity: 1, unitCents: cents(5_000) }] }));
  const anaCharges = await db.select().from(charges).where(and(eq(charges.organizationId, org), eq(charges.saleId, anaSale)));
  const dueToday = anaCharges.find((row) => row.dueOn === "2026-11-17");
  assert.ok(dueToday);
  await registerPayment(db, org, { chargeId: dueToday.id, amountCents: cents(4_000), feeCents: cents(100), paidOn: today, method: "Dinheiro", note: "" });
  // Recebimento desfeito não conta em lugar nenhum.
  const brunoCharges = await db.select().from(charges).where(and(eq(charges.organizationId, org), eq(charges.saleId, brunoSale)));
  const first = brunoCharges.sort((a, b) => a.dueOn.localeCompare(b.dueOn))[0];
  await registerPayment(db, org, { chargeId: first.id, amountCents: cents(10_000), paidOn: "2026-11-10", method: "Pix", note: "" });
  await reverseCharge(db, org, first.id);
  return { db, org, ana, bruno, anaSale, brunoSale };
}

test("os três números do Início usam o mês de hoje e só o atrasado atravessa meses", async () => {
  const { db, org } = await book();
  const kpis = await homeKpis(db, org, today);
  assert.equal(kpis.monthLabel, "novembro");
  assert.deepEqual(kpis.toReceive, { cents: 6_000, count: 1 });
  assert.deepEqual(kpis.received, { cents: 5_000 + 4_000 + 100, count: 2 });
  assert.deepEqual(kpis.late, { cents: 30_000, count: 3, clients: 2 });
});

test("cada filtro de A receber bate com o cartão do Início e a busca filtra pelo nome", async () => {
  const { db, org } = await book();
  assert.deepEqual(await bucketCounts(db, org, today), { atrasadas: 3, mes: 1, proximas: 2, recebidas: 1 });
  assert.deepEqual(await bucketCounts(db, org, today, "bruno"), { atrasadas: 2, mes: 0, proximas: 0, recebidas: 0 });
  assert.deepEqual(await bucketCounts(db, org, today, "ZZZ"), { atrasadas: 0, mes: 0, proximas: 0, recebidas: 0 });
});

test("a lista de atrasadas vem da mais antiga, com rótulo leigo, o que foi comprado e a multa sugerida", async () => {
  const { db, org, bruno } = await book();
  const rows = await listReceivables(db, org, today, settings, { bucket: "atrasadas" });
  assert.deepEqual(rows.map((row) => row.dueOn), ["2026-09-30", "2026-10-17", "2026-10-30"]);
  const [first] = rows;
  assert.equal(first.clientId, bruno);
  assert.equal(first.title, "Parcela 1 de 2");
  assert.equal(first.what, "2× Limpeza de pele");
  assert.equal(first.badge.label, "Atrasada 48 dias");
  assert.equal(first.openCents, 10_000);
  assert.equal(first.feeCents, 200 + 160);
  assert.equal(first.clientPhone, "(11) 98877-1020");
});

test("o filtro Este mês traz o que vence hoje sem a multa, e Recebidas traz o recibo", async () => {
  const { db, org } = await book();
  const [month] = await listReceivables(db, org, today, settings, { bucket: "mes" });
  assert.equal(month.badge.label, "Recebida em parte");
  assert.equal(month.openCents, 6_000);
  assert.equal(month.feeCents, 0);
  const [received] = await listReceivables(db, org, today, settings, { bucket: "recebidas" });
  assert.equal(received.badge.label, "Recebida");
  assert.ok(received.paymentId);
  assert.equal(received.closed, true);
});

test("paginar devolve só a fatia pedida", async () => {
  const { db, org } = await book();
  const page = await listReceivables(db, org, today, settings, { bucket: "atrasadas", limit: 2, offset: 2 });
  assert.deepEqual(page.map((row) => row.dueOn), ["2026-10-30"]);
});

test("resumos de venda e de cliente separam atraso, aberto e recebido", async () => {
  const { db, org, ana, bruno, anaSale, brunoSale } = await book();
  const sales = await saleSummaries(db, org, today);
  assert.deepEqual(sales.get(anaSale), { receivedCents: 4_000, openCents: 36_000, openCount: 4, lateCount: 1, recurringActive: false });
  assert.equal(sales.get(brunoSale)?.lateCount, 2);
  const people = await clientSummaries(db, org, today);
  assert.deepEqual(people.get(ana), { openCents: 36_000, lateCount: 1, paidCents: 9_000 });
  assert.deepEqual(people.get(bruno), { openCents: 20_000, lateCount: 2, paidCents: 0 });
});

test("uma venda com 240 parcelas só entrega as linhas pedidas", async () => {
  const db = await testDatabase();
  const org = await addOrganization(db, "org-long");
  const client = await addClient(db, org, "Marcos Terreno");
  await createSale(db, org, saleInput(client, { installmentCount: 240, soldOn: "2026-01-10", firstDue: "2026-02-10", entryCents: cents(900_000), interestMonthlyBp: 100, adjustYearlyBp: 500, items: [{ catalogItemId: null, description: "Lote 12", kind: "produto", quantity: 1, unitCents: cents(4_500_000) }] }));
  const counts = await bucketCounts(db, org, today);
  assert.equal(counts.atrasadas + counts.mes + counts.proximas + counts.recebidas, 241);
  const page = await listReceivables(db, org, today, settings, { bucket: "proximas", limit: 20 });
  assert.equal(page.length, 20);
});
