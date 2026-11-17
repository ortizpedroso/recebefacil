import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { and, asc, eq } from "drizzle-orm";
import { openIsolatedDatabase, type DB } from "./db";
import { DomainError, advanceRecurrences, cancelSale, changeDueDate, createCharge, createRecurrence, createSale, registerPayment, reverseCharge, updateSale, type SaleInput } from "./ledger";
import { cents } from "./money";
import { catalogItems, charges, contracts, dueChanges, organizations, payments, recurrences, sales } from "./schema";
import { insertCatalog, insertClient } from "./tenant";

let shared: Promise<DB> | undefined;
let counter = 0;

function database() {
  shared ??= mkdtemp(join(tmpdir(), "recebefacil-engine-")).then(openIsolatedDatabase);
  return shared;
}

async function setup() {
  const db = await database();
  counter += 1;
  const organizationId = `org-engine-${counter}`;
  await db.insert(organizations).values({
    id: organizationId,
    viewerKey: `test:${organizationId}`,
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
  const sale = (overrides: Partial<SaleInput> = {}): SaleInput => ({
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
    items: [{ catalogItemId: null, description: "Consulta", kind: "servico", quantity: 1, unitCents: cents(10_000) }],
    ...overrides,
  });
  const pay = (chargeId: string, amountCents: number, extra: { feeCents?: number; idempotencyKey?: string } = {}) =>
    registerPayment(db, organizationId, {
      chargeId,
      amountCents: cents(amountCents),
      feeCents: cents(extra.feeCents ?? 0),
      paidOn: "2026-06-02",
      method: "Pix",
      note: "",
      idempotencyKey: extra.idempotencyKey,
    });
  const chargesOf = (saleId: string) =>
    db.select().from(charges).where(and(eq(charges.organizationId, organizationId), eq(charges.saleId, saleId))).orderBy(asc(charges.number));
  const chargeById = async (chargeId: string) => (await db.select().from(charges).where(eq(charges.id, chargeId)))[0];
  const paymentsOf = (chargeId: string) => db.select().from(payments).where(eq(payments.chargeId, chargeId));
  const saleStatus = async (saleId: string) => (await db.select().from(sales).where(eq(sales.id, saleId)))[0].status;
  return { db, organizationId, clientId, sale, pay, chargesOf, chargeById, paymentsOf, saleStatus };
}

test("venda no dia 31 gera vencimentos 28, 31 e 30 sem escorregar para o dia 28", async () => {
  const { db, organizationId, sale, chargesOf } = await setup();
  const saleId = await createSale(
    db,
    organizationId,
    sale({ mode: "parcelado", installmentCount: 4, firstDue: "2026-01-31", soldOn: "2026-01-31", items: [{ catalogItemId: null, description: "Obra", kind: "servico", quantity: 1, unitCents: cents(40_000) }] }),
  );
  const rows = await chargesOf(saleId);
  assert.deepEqual(rows.map((row) => row.dueOn), ["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
  const leapId = await createSale(
    db,
    organizationId,
    sale({ mode: "parcelado", installmentCount: 2, firstDue: "2028-01-31", soldOn: "2028-01-31", items: [{ catalogItemId: null, description: "Obra", kind: "servico", quantity: 1, unitCents: cents(20_000) }] }),
  );
  assert.deepEqual((await chargesOf(leapId)).map((row) => row.dueOn), ["2028-01-31", "2028-02-29"]);
});

test("terreno em 120 parcelas com Price e reajuste de 5%: parcela 13 sobe 5% e a soma fecha o cronograma", async () => {
  const { db, organizationId, sale, chargesOf } = await setup();
  const saleId = await createSale(
    db,
    organizationId,
    sale({
      mode: "parcelado",
      soldOn: "2026-01-10",
      firstDue: "2026-02-10",
      installmentCount: 120,
      interestMonthlyBp: 100,
      adjustYearlyBp: 500,
      items: [{ catalogItemId: null, description: "Terreno", kind: "produto", quantity: 1, unitCents: cents(10_000_000) }],
    }),
  );
  const rows = await chargesOf(saleId);
  assert.equal(rows.length, 120);
  assert.equal(rows[0].label, "Parcela 1 de 120");
  assert.equal(rows[119].dueOn, "2036-01-10");
  assert.ok(Math.abs(rows[12].amountCents - rows[11].amountCents * 1.05) <= 1, `${rows[11].amountCents} -> ${rows[12].amountCents}`);
  const sum = rows.reduce((total, row) => total + row.amountCents, 0);
  assert.ok(Math.abs(sum - 21_654_746) <= 1, `soma ${sum}`);
  const [row] = await db.select().from(sales).where(eq(sales.id, saleId));
  assert.equal(row.totalCents, 10_000_000);
  assert.deepEqual([row.installmentCount, row.periodicity, row.interestMonthlyBp, row.adjustYearlyBp, row.entryCents], [120, "mensal", 100, 500, 0]);
});

test("a venda aceita 240 parcelas e recusa 241", async () => {
  const { db, organizationId, sale, chargesOf } = await setup();
  const items = [{ catalogItemId: null, description: "Lote", kind: "produto" as const, quantity: 1, unitCents: cents(24_000_100) }];
  const saleId = await createSale(db, organizationId, sale({ mode: "parcelado", installmentCount: 240, firstDue: "2026-07-01", items }));
  const rows = await chargesOf(saleId);
  assert.equal(rows.length, 240);
  assert.equal(rows.reduce((total, row) => total + row.amountCents, 0), 24_000_100);
  await assert.rejects(() => createSale(db, organizationId, sale({ mode: "parcelado", installmentCount: 241, firstDue: "2026-07-01", items })), DomainError);
});

test("desfazer o recebimento devolve a cobrança a pendente e ela pode ser paga de novo", async () => {
  const { db, organizationId, sale, chargesOf, chargeById, pay, paymentsOf, saleStatus } = await setup();
  const saleId = await createSale(db, organizationId, sale());
  const [charge] = await chargesOf(saleId);
  await pay(charge.id, 10_000);
  assert.equal((await chargeById(charge.id)).status, "paga");
  assert.equal(await saleStatus(saleId), "paga");

  await reverseCharge(db, organizationId, charge.id);
  const reopened = await chargeById(charge.id);
  assert.deepEqual([reopened.status, reopened.paidCents, reopened.paidOn], ["pendente", 0, null]);
  assert.equal(await saleStatus(saleId), "aguardando");
  assert.ok((await paymentsOf(charge.id)).every((payment) => payment.reversedAt));

  await pay(charge.id, 10_000);
  assert.equal((await chargeById(charge.id)).status, "paga");
  assert.equal((await paymentsOf(charge.id)).filter((payment) => !payment.reversedAt).length, 1);
});

test("desfazer um recebimento parcial volta a cobrança a pendente, e desfazer de novo não muda nada", async () => {
  const { db, organizationId, sale, chargesOf, chargeById, pay } = await setup();
  const saleId = await createSale(db, organizationId, sale());
  const [charge] = await chargesOf(saleId);
  await pay(charge.id, 4_000);
  assert.equal((await chargeById(charge.id)).status, "parcial");
  await reverseCharge(db, organizationId, charge.id);
  await reverseCharge(db, organizationId, charge.id);
  const reopened = await chargeById(charge.id);
  assert.deepEqual([reopened.status, reopened.paidCents], ["pendente", 0]);
  await pay(charge.id, 10_000);
  assert.equal((await chargeById(charge.id)).status, "paga");
});

test("o mesmo pedido de pagamento enviado duas vezes ao mesmo tempo cria um pagamento só", async () => {
  const { db, organizationId, sale, chargesOf, chargeById, pay, paymentsOf } = await setup();
  const saleId = await createSale(db, organizationId, sale());
  const [charge] = await chargesOf(saleId);
  const [first, second] = await Promise.all([pay(charge.id, 4_000, { idempotencyKey: "chave-dupla" }), pay(charge.id, 4_000, { idempotencyKey: "chave-dupla" })]);
  assert.equal(first, second);
  assert.equal((await paymentsOf(charge.id)).length, 1);
  assert.equal((await chargeById(charge.id)).paidCents, 4_000);
  await assert.rejects(() => pay(charge.id, 5_000, { idempotencyKey: "chave-dupla" }), DomainError);
  assert.equal((await chargeById(charge.id)).paidCents, 4_000);
});

test("dois pagamentos que juntos passam do valor: o segundo é recusado e nada é gravado", async () => {
  const { db, organizationId, sale, chargesOf, chargeById, pay, paymentsOf } = await setup();
  const saleId = await createSale(db, organizationId, sale());
  const [charge] = await chargesOf(saleId);
  await pay(charge.id, 6_000, { idempotencyKey: "a" });
  await assert.rejects(() => pay(charge.id, 5_000, { idempotencyKey: "b" }), DomainError);
  assert.equal((await chargeById(charge.id)).paidCents, 6_000);
  assert.equal((await paymentsOf(charge.id)).length, 1);

  const secondSale = await createSale(db, organizationId, sale());
  const [other] = await chargesOf(secondSale);
  const results = await Promise.allSettled([pay(other.id, 6_000, { idempotencyKey: "c" }), pay(other.id, 6_000, { idempotencyKey: "d" })]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal((await chargeById(other.id)).paidCents, 6_000);
  assert.equal((await paymentsOf(other.id)).length, 1);
});

test("multa e juros entram no pagamento sem contar como principal", async () => {
  const { db, organizationId, sale, chargesOf, chargeById, pay, paymentsOf } = await setup();
  const saleId = await createSale(db, organizationId, sale());
  const [charge] = await chargesOf(saleId);
  await pay(charge.id, 10_000, { feeCents: 233 });
  const [payment] = await paymentsOf(charge.id);
  assert.equal(payment.feeCents, 233);
  assert.equal(payment.amountCents, 10_000);
  const settled = await chargeById(charge.id);
  assert.deepEqual([settled.paidCents, settled.status], [10_000, "paga"]);
  await assert.rejects(() => registerPayment(db, organizationId, { chargeId: charge.id, amountCents: cents(1), feeCents: cents(-1), paidOn: "2026-06-02", method: "Pix", note: "" }), DomainError);
});

test("cobrança cancelada não aceita pagamento", async () => {
  const { db, organizationId, sale, chargesOf, pay } = await setup();
  const saleId = await createSale(db, organizationId, sale());
  await cancelSale(db, organizationId, saleId);
  const [charge] = await chargesOf(saleId);
  assert.equal(charge.status, "cancelada");
  await assert.rejects(() => pay(charge.id, 100), /não aceita pagamento/);
});

test("editar a venda depois de mudar um vencimento funciona e leva o histórico junto", async () => {
  const { db, organizationId, sale, chargesOf } = await setup();
  const saleId = await createSale(db, organizationId, sale({ mode: "parcelado", installmentCount: 3, firstDue: "2026-07-01" }));
  const [first] = await chargesOf(saleId);
  await changeDueDate(db, organizationId, first.id, "2026-07-15");
  assert.equal((await db.select().from(dueChanges).where(eq(dueChanges.organizationId, organizationId))).length, 1);

  await updateSale(db, organizationId, saleId, sale({ mode: "parcelado", installmentCount: 2, firstDue: "2026-08-01", notes: "editada" }));
  const rows = await chargesOf(saleId);
  assert.deepEqual(rows.map((row) => row.dueOn), ["2026-08-01", "2026-09-01"]);
  assert.equal((await db.select().from(dueChanges).where(eq(dueChanges.organizationId, organizationId))).length, 0);
});

test("editar a venda depois de desfazer um recebimento também funciona", async () => {
  const { db, organizationId, sale, chargesOf, pay } = await setup();
  const saleId = await createSale(db, organizationId, sale());
  const [charge] = await chargesOf(saleId);
  await pay(charge.id, 10_000);
  await reverseCharge(db, organizationId, charge.id);
  await updateSale(db, organizationId, saleId, sale({ notes: "depois do estorno" }));
  assert.equal((await chargesOf(saleId)).length, 1);
});

test("vencimento de cobrança paga não muda", async () => {
  const { db, organizationId, sale, chargesOf, pay } = await setup();
  const saleId = await createSale(db, organizationId, sale());
  const [charge] = await chargesOf(saleId);
  await pay(charge.id, 10_000);
  await assert.rejects(() => changeDueDate(db, organizationId, charge.id, "2026-12-01"), DomainError);
});

test("cancelar a venda devolve o estoque uma vez só", async () => {
  const { db, organizationId, sale } = await setup();
  const itemId = await insertCatalog(db, organizationId, { kind: "produto", name: "Peça", description: "", category: "Peças", sku: "P1", priceCents: cents(1_000), billing: "pontual", stockQuantity: 5 });
  const saleId = await createSale(db, organizationId, sale({ items: [{ catalogItemId: itemId, description: "Peça", kind: "produto", quantity: 2, unitCents: cents(1_000) }] }));
  const stock = async () => (await db.select().from(catalogItems).where(eq(catalogItems.id, itemId)))[0].stockQuantity;
  assert.equal(await stock(), 3);
  await cancelSale(db, organizationId, saleId);
  assert.equal(await stock(), 5);
  await cancelSale(db, organizationId, saleId);
  assert.equal(await stock(), 5);
});

test("só vira contrato quando a venda pede", async () => {
  const { db, organizationId, sale } = await setup();
  await createSale(db, organizationId, sale({ mode: "parcelado", installmentCount: 3, firstDue: "2026-07-01" }));
  assert.equal((await db.select().from(contracts).where(eq(contracts.organizationId, organizationId))).length, 0);
  await createSale(db, organizationId, sale({ mode: "parcelado", installmentCount: 3, firstDue: "2026-07-01", makeContract: true }));
  assert.equal((await db.select().from(contracts).where(eq(contracts.organizationId, organizationId))).length, 1);
});

test("a recorrência avança sem duplicar, mesmo duas vezes e ao mesmo tempo, e ancora no dia 31", async () => {
  const { db, organizationId, clientId } = await setup();
  const recurrenceId = await createRecurrence(db, organizationId, { clientId, description: "Mensalidade", amountCents: cents(20_000), periodicity: "mensal", startsOn: "2026-01-31", endsOn: null, method: "Pix" });
  await advanceRecurrences(db, organizationId, "2026-04-30");
  await advanceRecurrences(db, organizationId, "2026-04-30");
  await Promise.all([advanceRecurrences(db, organizationId, "2026-04-30"), advanceRecurrences(db, organizationId, "2026-04-30")]);
  const rows = await db.select().from(charges).where(eq(charges.recurrenceId, recurrenceId)).orderBy(asc(charges.dueOn));
  assert.deepEqual(rows.map((row) => row.dueOn), ["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
  assert.equal(new Set(rows.map((row) => row.code)).size, 4);
  const [recurrence] = await db.select().from(recurrences).where(eq(recurrences.id, recurrenceId));
  assert.equal(recurrence.nextOn, "2026-05-31");
});

test("cobrança avulsa e cobrança de recorrência são pagas pelo mesmo caminho", async () => {
  const { db, organizationId, clientId, pay, chargeById } = await setup();
  const oneOff = await createCharge(db, organizationId, { clientId, amountCents: cents(5_000), dueOn: "2026-06-10", method: "Pix" });
  await pay(oneOff, 5_000);
  assert.equal((await chargeById(oneOff)).status, "paga");

  const recurrenceId = await createRecurrence(db, organizationId, { clientId, description: "Plano", amountCents: cents(8_000), periodicity: "mensal", startsOn: "2026-06-01", endsOn: null, method: "Pix" });
  await advanceRecurrences(db, organizationId, "2026-07-02");
  const [, cycle] = await db.select().from(charges).where(eq(charges.recurrenceId, recurrenceId)).orderBy(asc(charges.dueOn));
  await pay(cycle.id, 3_000);
  assert.equal((await chargeById(cycle.id)).status, "parcial");
  await reverseCharge(db, organizationId, cycle.id);
  assert.equal((await chargeById(cycle.id)).status, "pendente");
});

test("vendas criadas ao mesmo tempo recebem códigos diferentes", async () => {
  const { db, organizationId, sale } = await setup();
  await Promise.all([1, 2, 3].map(() => createSale(db, organizationId, sale())));
  const rows = await db.select().from(sales).where(eq(sales.organizationId, organizationId));
  assert.equal(rows.length, 3);
  assert.equal(new Set(rows.map((row) => row.code)).size, 3);
});

test("o banco recusa código de venda repetido na mesma empresa", async () => {
  const { db, organizationId, sale } = await setup();
  const saleId = await createSale(db, organizationId, sale());
  const [row] = await db.select().from(sales).where(eq(sales.id, saleId));
  await assert.rejects(() => db.insert(sales).values({ ...row, id: "outra-venda" }));
});
