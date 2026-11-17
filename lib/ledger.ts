import { and, eq, inArray, isNotNull, isNull, ne, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { Periodicity } from "./dates";
import { addPeriod, periodIndexOnOrAfter } from "./dates";
import type { DB } from "./db";
import { cents, MAX_INSTALLMENTS, type Cents } from "./money";
import { buildSchedule, MAX_ADJUST_BP, MAX_FINANCE_INTEREST_BP, scheduleTotal, type ScheduleRow } from "./schedule";
import { catalogItems, charges, clients, contracts, dueChanges, fiscalDocuments, payments, recurrences, saleItems, sales, stockMoves } from "./schema";
import { isOpen, settleStatus } from "./status";

export class DomainError extends Error {}

type ItemInput = {
  catalogItemId: string | null;
  description: string;
  kind: "produto" | "servico";
  quantity: number;
  unitCents: Cents;
};

export type SaleInput = {
  clientId: string;
  soldOn: string;
  discountCents: Cents;
  notes: string;
  mode: "avista" | "parcelado" | "recorrente";
  entryCents: Cents;
  installmentCount: number;
  firstDue: string;
  periodicity: Periodicity;
  interestMonthlyBp?: number;
  adjustYearlyBp?: number;
  method: string;
  makeContract: boolean;
  items: ItemInput[];
};

function id() {
  return randomUUID();
}

function nowIso() {
  return new Date().toISOString();
}

const CODE_COLUMN = { sales: "code", charges: "code", contracts: "number" } as const;

// Só funciona dentro de transação: o lock vale até o commit e serializa quem aloca código na mesma empresa.
async function nextCodes(db: DB, organizationId: string, prefix: string, table: keyof typeof CODE_COLUMN, count = 1) {
  await db.execute(sql`select pg_advisory_xact_lock(hashtext(${`codigo:${organizationId}:${prefix}`}))`);
  const result = await db.execute(
    sql`select coalesce(max(substring(${sql.identifier(CODE_COLUMN[table])} from '^[A-Z]+-([0-9]+)$')::int), 0) as max from ${sql.identifier(table)} where organization_id = ${organizationId}`,
  );
  const max = Number((result.rows[0] as { max?: number | string } | undefined)?.max ?? 0);
  return Array.from({ length: count }, (_, index) => `${prefix}-${String(max + index + 1).padStart(4, "0")}`);
}

function saleStatus(total: number, paid: number, cancelled: boolean) {
  if (cancelled) return "cancelada";
  if (paid <= 0) return "aguardando";
  if (paid < total) return "parcial";
  return "paga";
}

const RECURRENCE_LABELS: Partial<Record<Periodicity, string>> = { mensal: "Mensalidade" };

function recurrenceLabel(periodicity: Periodicity) {
  return RECURRENCE_LABELS[periodicity] ?? "Cobrança recorrente";
}

async function validateSaleReferences(db: DB, organizationId: string, input: SaleInput) {
  const [client] = await db.select().from(clients).where(and(eq(clients.organizationId, organizationId), eq(clients.id, input.clientId)));
  if (!client) throw new DomainError("Cliente não encontrado.");
  for (const item of input.items) {
    if (!item.catalogItemId) continue;
    const [catalog] = await db
      .select()
      .from(catalogItems)
      .where(and(eq(catalogItems.organizationId, organizationId), eq(catalogItems.id, item.catalogItemId)));
    if (!catalog) throw new DomainError("Item do catálogo não encontrado.");
  }
}

type SalePlan = {
  total: Cents;
  entry: Cents;
  count: number;
  interestBp: number;
  adjustBp: number;
  periodicity: Periodicity | null;
  rows: ScheduleRow[];
};

function planSale(input: SaleInput): SalePlan {
  const itemsTotal = input.items.reduce((sum, item) => sum + item.quantity * item.unitCents, 0);
  if (itemsTotal <= input.discountCents) throw new DomainError("O desconto zera a venda.");
  const total = cents(itemsTotal - input.discountCents);
  if (input.mode === "avista") {
    const rows = [{ number: 1, label: "À vista", dueOn: input.soldOn, amountCents: total }];
    return { total, entry: cents(0), count: 1, interestBp: 0, adjustBp: 0, periodicity: null, rows };
  }
  if (input.mode === "recorrente") {
    return { total, entry: cents(0), count: 1, interestBp: 0, adjustBp: 0, periodicity: input.periodicity, rows: [] };
  }
  const entry = input.entryCents;
  if (entry > total) throw new DomainError("A entrada passa do total.");
  if (entry === total) throw new DomainError("A entrada quita a venda. Use à vista.");
  const count = input.installmentCount;
  if (!Number.isInteger(count) || count < 1 || count > MAX_INSTALLMENTS) {
    throw new DomainError(`A quantidade de parcelas deve ficar entre 1 e ${MAX_INSTALLMENTS}.`);
  }
  const interestBp = input.interestMonthlyBp ?? 0;
  const adjustBp = input.adjustYearlyBp ?? 0;
  if (!Number.isInteger(interestBp) || interestBp < 0 || interestBp > MAX_FINANCE_INTEREST_BP) {
    throw new DomainError("Os juros do financiamento vão de 0% a 10% ao mês.");
  }
  if (!Number.isInteger(adjustBp) || adjustBp < 0 || adjustBp > MAX_ADJUST_BP) {
    throw new DomainError("O reajuste anual vai de 0% a 20%.");
  }
  const financed = cents(total - entry);
  if (financed < count) throw new DomainError("O saldo não cobre um centavo por parcela.");
  const rows = buildSchedule({
    financedCents: financed,
    entryCents: entry,
    count,
    firstDue: input.firstDue,
    soldOn: input.soldOn,
    periodicity: input.periodicity,
    interestMonthlyBp: interestBp,
    adjustYearlyBp: adjustBp,
  });
  if (rows.some((row) => row.amountCents <= 0)) throw new DomainError("O saldo é pequeno demais para essa quantidade de parcelas.");
  return { total, entry, count, interestBp, adjustBp, periodicity: input.periodicity, rows };
}

type ChargeOrigin = { saleId: string | null; contractId: string | null; recurrenceId: string | null };

function chargeRow(organizationId: string, clientId: string, code: string, origin: ChargeOrigin, method: string, row: { dueOn: string; amountCents: number; number: number | null; count: number | null; label: string | null }) {
  return {
    id: id(),
    organizationId,
    code,
    clientId,
    ...origin,
    number: row.number,
    count: row.count,
    label: row.label,
    amountCents: row.amountCents,
    paidCents: 0,
    dueOn: row.dueOn,
    method,
    status: "pendente",
    paidOn: null,
  };
}

async function insertScheduleCharges(tx: DB, organizationId: string, clientId: string, origin: ChargeOrigin, method: string, rows: ScheduleRow[]) {
  const codes = await nextCodes(tx, organizationId, "COB", "charges", rows.length);
  await tx.insert(charges).values(rows.map((row, index) => chargeRow(organizationId, clientId, codes[index], origin, method, { ...row, count: rows.length })));
}

async function consumeStock(tx: DB, organizationId: string, saleId: string, item: ItemInput) {
  if (!item.catalogItemId) return;
  const [updated] = await tx
    .update(catalogItems)
    .set({ stockQuantity: sql`${catalogItems.stockQuantity} - ${item.quantity}` })
    .where(and(eq(catalogItems.organizationId, organizationId), eq(catalogItems.id, item.catalogItemId), isNotNull(catalogItems.stockQuantity), sql`${catalogItems.stockQuantity} >= ${item.quantity}`))
    .returning({ id: catalogItems.id });
  if (!updated) {
    const [catalog] = await tx.select().from(catalogItems).where(and(eq(catalogItems.organizationId, organizationId), eq(catalogItems.id, item.catalogItemId)));
    if (catalog && catalog.stockQuantity !== null) throw new DomainError(`Estoque insuficiente para ${item.description}.`);
    return;
  }
  await tx.insert(stockMoves).values({ id: id(), organizationId, catalogItemId: updated.id, saleId, quantity: -item.quantity, reason: "venda", createdAt: nowIso() });
}

async function restoreStock(tx: DB, organizationId: string, saleId: string, reason: string) {
  const items = await tx.select().from(saleItems).where(and(eq(saleItems.organizationId, organizationId), eq(saleItems.saleId, saleId)));
  for (const item of items) {
    if (!item.catalogItemId) continue;
    const [updated] = await tx
      .update(catalogItems)
      .set({ stockQuantity: sql`${catalogItems.stockQuantity} + ${item.quantity}` })
      .where(and(eq(catalogItems.organizationId, organizationId), eq(catalogItems.id, item.catalogItemId), isNotNull(catalogItems.stockQuantity)))
      .returning({ id: catalogItems.id });
    if (updated) {
      await tx.insert(stockMoves).values({ id: id(), organizationId, catalogItemId: updated.id, saleId, quantity: item.quantity, reason, createdAt: nowIso() });
    }
  }
}

async function writeSaleChildren(tx: DB, organizationId: string, saleId: string, input: SaleInput, plan: SalePlan) {
  for (const item of input.items) {
    await tx.insert(saleItems).values({
      id: id(),
      organizationId,
      saleId,
      catalogItemId: item.catalogItemId,
      description: item.description,
      kind: item.kind,
      quantity: item.quantity,
      unitCents: item.unitCents,
      totalCents: item.quantity * item.unitCents,
    });
    await consumeStock(tx, organizationId, saleId, item);
  }

  let contractId: string | null = null;
  if (input.makeContract) {
    contractId = id();
    const [number] = await nextCodes(tx, organizationId, "CTR", "contracts");
    await tx.insert(contracts).values({
      id: contractId,
      organizationId,
      number,
      clientId: input.clientId,
      saleId,
      description: input.items.map((item) => item.description).join(", "),
      totalCents: plan.total,
      startsOn: input.soldOn,
      endsOn: input.mode === "parcelado" ? addPeriod(input.firstDue, input.periodicity, plan.count - 1) : null,
      status: "ativo",
      terms: input.mode === "recorrente" ? `Recorrência ${input.periodicity}` : input.mode === "parcelado" ? `Entrada e ${plan.count} parcelas` : "Pagamento à vista",
    });
  }

  const origin = { saleId, contractId, recurrenceId: null };
  if (input.mode === "recorrente") {
    const recurrenceId = id();
    await tx.insert(recurrences).values({
      id: recurrenceId,
      organizationId,
      clientId: input.clientId,
      catalogItemId: input.items[0]?.catalogItemId ?? null,
      description: input.items.map((item) => item.description).join(", "),
      amountCents: plan.total,
      periodicity: input.periodicity,
      startsOn: input.firstDue,
      nextOn: addPeriod(input.firstDue, input.periodicity, 1),
      endsOn: null,
      status: "ativa",
    });
    const [code] = await nextCodes(tx, organizationId, "COB", "charges");
    await tx.insert(charges).values(
      chargeRow(organizationId, input.clientId, code, { ...origin, recurrenceId }, input.method, {
        dueOn: input.firstDue,
        amountCents: plan.total,
        number: null,
        count: null,
        label: recurrenceLabel(input.periodicity),
      }),
    );
    return;
  }

  await insertScheduleCharges(tx, organizationId, input.clientId, origin, input.method, plan.rows);
  const [saved] = await tx
    .select({ sum: sql<number>`coalesce(sum(${charges.amountCents}), 0)::int` })
    .from(charges)
    .where(and(eq(charges.organizationId, organizationId), eq(charges.saleId, saleId)));
  const expected = scheduleTotal(plan.rows);
  if (Number(saved?.sum ?? 0) !== expected) throw new DomainError("A soma das cobranças não fecha o total do cronograma.");
  if (plan.interestBp === 0 && plan.adjustBp === 0 && expected !== plan.total) throw new DomainError("A soma das parcelas não fecha o total.");
}

function salePlanColumns(plan: SalePlan) {
  return {
    installmentCount: plan.count,
    periodicity: plan.periodicity,
    interestMonthlyBp: plan.interestBp,
    adjustYearlyBp: plan.adjustBp,
    entryCents: plan.entry,
  };
}

export async function createSale(db: DB, organizationId: string, input: SaleInput) {
  await validateSaleReferences(db, organizationId, input);
  const plan = planSale(input);
  return db.transaction(async (tx) => {
    const database = tx as DB;
    const saleId = id();
    const [code] = await nextCodes(database, organizationId, "VND", "sales");
    await database.insert(sales).values({
      id: saleId,
      organizationId,
      code,
      clientId: input.clientId,
      soldOn: input.soldOn,
      discountCents: input.discountCents,
      totalCents: plan.total,
      notes: input.notes,
      mode: input.mode,
      status: "aguardando",
      ...salePlanColumns(plan),
      createdAt: nowIso(),
    });
    await writeSaleChildren(database, organizationId, saleId, input, plan);
    return saleId;
  });
}

async function lockSaleCharges(tx: DB, organizationId: string, saleId: string) {
  const [sale] = await tx
    .select()
    .from(sales)
    .where(and(eq(sales.organizationId, organizationId), eq(sales.id, saleId)))
    .for("update");
  if (!sale) throw new DomainError("Venda não encontrada.");
  const rows = await tx
    .select()
    .from(charges)
    .where(and(eq(charges.organizationId, organizationId), eq(charges.saleId, saleId)))
    .for("update");
  return { sale, rows };
}

async function deleteChargesOf(tx: DB, organizationId: string, chargeIds: string[]) {
  if (chargeIds.length === 0) return;
  await tx.delete(dueChanges).where(and(eq(dueChanges.organizationId, organizationId), inArray(dueChanges.chargeId, chargeIds)));
  await tx.delete(payments).where(and(eq(payments.organizationId, organizationId), inArray(payments.chargeId, chargeIds)));
  await tx.delete(charges).where(and(eq(charges.organizationId, organizationId), inArray(charges.id, chargeIds)));
}

async function deleteRecurrencesOf(tx: DB, organizationId: string, chargeRows: { recurrenceId: string | null }[]) {
  const recurrenceIds = [...new Set(chargeRows.map((charge) => charge.recurrenceId).filter((value): value is string => Boolean(value)))];
  if (recurrenceIds.length === 0) return;
  await tx.delete(recurrences).where(and(eq(recurrences.organizationId, organizationId), inArray(recurrences.id, recurrenceIds)));
}

export async function updateSale(db: DB, organizationId: string, saleId: string, input: SaleInput) {
  await validateSaleReferences(db, organizationId, input);
  const plan = planSale(input);
  return db.transaction(async (tx) => {
    const database = tx as DB;
    const { sale, rows } = await lockSaleCharges(database, organizationId, saleId);
    if (sale.status === "cancelada") throw new DomainError("Venda cancelada não pode ser editada.");
    if (rows.some((charge) => charge.paidCents > 0)) throw new DomainError("Estorne os recebimentos antes de editar a venda.");
    await restoreStock(database, organizationId, saleId, "edicao");
    await database.delete(saleItems).where(and(eq(saleItems.organizationId, organizationId), eq(saleItems.saleId, saleId)));
    await deleteChargesOf(database, organizationId, rows.map((charge) => charge.id));
    await database.delete(contracts).where(and(eq(contracts.organizationId, organizationId), eq(contracts.saleId, saleId)));
    await deleteRecurrencesOf(database, organizationId, rows);
    await database
      .update(sales)
      .set({
        clientId: input.clientId,
        soldOn: input.soldOn,
        discountCents: input.discountCents,
        totalCents: plan.total,
        notes: input.notes,
        mode: input.mode,
        status: "aguardando",
        ...salePlanColumns(plan),
      })
      .where(eq(sales.id, saleId));
    await writeSaleChildren(database, organizationId, saleId, input, plan);
    return saleId;
  });
}

export type ContractInput = {
  clientId: string;
  description: string;
  totalCents: Cents;
  startsOn: string;
  endsOn: string | null;
  terms: string;
  installmentCount: number;
  firstDue: string;
  periodicity: Periodicity;
  method: string;
};

const MAX_CONTRACT_INSTALLMENTS = 60;

export async function createContract(db: DB, organizationId: string, input: ContractInput) {
  if (!Number.isInteger(input.installmentCount) || input.installmentCount < 1 || input.installmentCount > MAX_CONTRACT_INSTALLMENTS) {
    throw new DomainError(`A quantidade de parcelas deve ficar entre 1 e ${MAX_CONTRACT_INSTALLMENTS}.`);
  }
  if (input.totalCents < input.installmentCount) throw new DomainError("O valor não cobre um centavo por parcela.");
  const [client] = await db.select().from(clients).where(and(eq(clients.organizationId, organizationId), eq(clients.id, input.clientId)));
  if (!client) throw new DomainError("Cliente não encontrado.");
  const rows = buildSchedule({
    financedCents: input.totalCents,
    entryCents: cents(0),
    count: input.installmentCount,
    firstDue: input.firstDue,
    soldOn: input.startsOn,
    periodicity: input.periodicity,
    interestMonthlyBp: 0,
    adjustYearlyBp: 0,
  });
  return db.transaction(async (tx) => {
    const database = tx as DB;
    const contractId = id();
    const [number] = await nextCodes(database, organizationId, "CTR", "contracts");
    await database.insert(contracts).values({
      id: contractId,
      organizationId,
      number,
      clientId: input.clientId,
      saleId: null,
      description: input.description,
      totalCents: input.totalCents,
      startsOn: input.startsOn,
      endsOn: input.endsOn,
      status: "ativo",
      terms: input.terms,
    });
    await insertScheduleCharges(database, organizationId, input.clientId, { saleId: null, contractId, recurrenceId: null }, input.method, rows);
    return contractId;
  });
}

export type RecurrenceInput = {
  clientId: string;
  description: string;
  amountCents: Cents;
  periodicity: Periodicity;
  startsOn: string;
  endsOn: string | null;
  method: string;
};

export async function createRecurrence(db: DB, organizationId: string, input: RecurrenceInput) {
  const [client] = await db.select().from(clients).where(and(eq(clients.organizationId, organizationId), eq(clients.id, input.clientId)));
  if (!client) throw new DomainError("Cliente não encontrado.");
  return db.transaction(async (tx) => {
    const database = tx as DB;
    const recurrenceId = id();
    await database.insert(recurrences).values({
      id: recurrenceId,
      organizationId,
      clientId: input.clientId,
      catalogItemId: null,
      description: input.description,
      amountCents: input.amountCents,
      periodicity: input.periodicity,
      startsOn: input.startsOn,
      nextOn: addPeriod(input.startsOn, input.periodicity, 1),
      endsOn: input.endsOn,
      status: "ativa",
    });
    const [code] = await nextCodes(database, organizationId, "COB", "charges");
    await database.insert(charges).values(
      chargeRow(organizationId, input.clientId, code, { saleId: null, contractId: null, recurrenceId }, input.method, {
        dueOn: input.startsOn,
        amountCents: input.amountCents,
        number: null,
        count: null,
        label: recurrenceLabel(input.periodicity),
      }),
    );
    return recurrenceId;
  });
}

export type ChargeInput = {
  clientId: string;
  amountCents: Cents;
  dueOn: string;
  method: string;
};

export async function createCharge(db: DB, organizationId: string, input: ChargeInput) {
  const [client] = await db.select().from(clients).where(and(eq(clients.organizationId, organizationId), eq(clients.id, input.clientId)));
  if (!client) throw new DomainError("Cliente não encontrado.");
  return db.transaction(async (tx) => {
    const database = tx as DB;
    const [code] = await nextCodes(database, organizationId, "COB", "charges");
    const row = chargeRow(organizationId, input.clientId, code, { saleId: null, contractId: null, recurrenceId: null }, input.method, {
      dueOn: input.dueOn,
      amountCents: input.amountCents,
      number: null,
      count: null,
      label: null,
    });
    await database.insert(charges).values(row);
    return row.id;
  });
}

export async function updateContract(
  db: DB,
  organizationId: string,
  contractId: string,
  input: { description: string; startsOn: string; endsOn: string | null; terms: string },
) {
  const [contract] = await db.select().from(contracts).where(and(eq(contracts.organizationId, organizationId), eq(contracts.id, contractId)));
  if (!contract) throw new DomainError("Contrato não encontrado.");
  await db
    .update(contracts)
    .set({ description: input.description, startsOn: input.startsOn, endsOn: input.endsOn, terms: input.terms })
    .where(eq(contracts.id, contractId));
}

export async function updateRecurrence(
  db: DB,
  organizationId: string,
  recurrenceId: string,
  input: { description: string; amountCents: Cents; endsOn: string | null },
) {
  if (input.amountCents <= 0) throw new DomainError("O valor precisa ser maior que zero.");
  const [recurrence] = await db.select().from(recurrences).where(and(eq(recurrences.organizationId, organizationId), eq(recurrences.id, recurrenceId)));
  if (!recurrence) throw new DomainError("Recorrência não encontrada.");
  await db
    .update(recurrences)
    .set({ description: input.description, amountCents: input.amountCents, endsOn: input.endsOn })
    .where(eq(recurrences.id, recurrenceId));
}

async function refreshSale(tx: DB, organizationId: string, saleId: string) {
  const [sale] = await tx.select().from(sales).where(and(eq(sales.organizationId, organizationId), eq(sales.id, saleId)));
  if (!sale || sale.status === "cancelada") return;
  const rows = await tx
    .select()
    .from(charges)
    .where(and(eq(charges.organizationId, organizationId), eq(charges.saleId, saleId), ne(charges.status, "cancelada")));
  const paid = rows.reduce((sum, row) => sum + row.paidCents, 0);
  // Venda recorrente ganha cobranças a cada ciclo, então o esperado é um ciclo. As demais esperam o cronograma inteiro.
  const expected = sale.mode === "recorrente" ? sale.totalCents : rows.reduce((sum, row) => sum + row.amountCents, 0);
  await tx.update(sales).set({ status: saleStatus(expected, paid, false) }).where(eq(sales.id, saleId));
}

export async function registerPayment(
  db: DB,
  organizationId: string,
  input: { chargeId: string; amountCents: Cents; feeCents?: Cents; paidOn: string; method: string; note: string; idempotencyKey?: string },
) {
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) throw new DomainError("O valor precisa ser maior que zero.");
  const feeCents = input.feeCents ?? 0;
  if (!Number.isInteger(feeCents) || feeCents < 0) throw new DomainError("Multa e juros não podem ser negativos.");
  return db.transaction(async (tx) => {
    const database = tx as DB;
    const [charge] = await database
      .select()
      .from(charges)
      .where(and(eq(charges.organizationId, organizationId), eq(charges.id, input.chargeId)));
    if (!charge) throw new DomainError("Cobrança não encontrada.");
    const [inserted] = await database
      .insert(payments)
      .values({
        id: id(),
        organizationId,
        chargeId: charge.id,
        amountCents: input.amountCents,
        feeCents,
        paidOn: input.paidOn,
        method: input.method,
        note: input.note,
        idempotencyKey: input.idempotencyKey ?? null,
        reversedAt: null,
      })
      .onConflictDoNothing({ target: [payments.organizationId, payments.idempotencyKey] })
      .returning({ id: payments.id });
    if (!inserted) {
      const [existing] = await database
        .select()
        .from(payments)
        .where(and(eq(payments.organizationId, organizationId), eq(payments.idempotencyKey, input.idempotencyKey ?? "")));
      if (!existing || existing.chargeId !== charge.id || existing.amountCents !== input.amountCents) {
        throw new DomainError("A mesma chave veio com outro valor.");
      }
      return existing.id;
    }
    // Uma instrução só decide saldo e bloqueio, então dois pagamentos simultâneos nunca passam do valor.
    const [updated] = await database
      .update(charges)
      .set({ paidCents: sql`${charges.paidCents} + ${input.amountCents}`, paidOn: input.paidOn })
      .where(
        and(
          eq(charges.organizationId, organizationId),
          eq(charges.id, charge.id),
          ne(charges.status, "cancelada"),
          sql`${charges.paidCents} + ${input.amountCents} <= ${charges.amountCents}`,
        ),
      )
      .returning();
    if (!updated) {
      const [fresh] = await database.select().from(charges).where(eq(charges.id, charge.id));
      throw new DomainError(fresh?.status === "cancelada" ? "Esta cobrança não aceita pagamento." : "O pagamento passa do saldo.");
    }
    await database.update(charges).set({ status: settleStatus(updated) }).where(eq(charges.id, updated.id));
    if (updated.saleId) await refreshSale(database, organizationId, updated.saleId);
    return inserted.id;
  });
}

export async function reverseCharge(db: DB, organizationId: string, chargeId: string) {
  return db.transaction(async (tx) => {
    const database = tx as DB;
    const [charge] = await database
      .select()
      .from(charges)
      .where(and(eq(charges.organizationId, organizationId), eq(charges.id, chargeId)))
      .for("update");
    if (!charge) throw new DomainError("Cobrança não encontrada.");
    await database
      .update(payments)
      .set({ reversedAt: nowIso() })
      .where(and(eq(payments.organizationId, organizationId), eq(payments.chargeId, chargeId), isNull(payments.reversedAt)));
    const [standing] = await database
      .select({ paid: sql<number>`coalesce(sum(${payments.amountCents}), 0)::int`, lastPaidOn: sql<string | null>`max(${payments.paidOn})` })
      .from(payments)
      .where(and(eq(payments.organizationId, organizationId), eq(payments.chargeId, chargeId), isNull(payments.reversedAt)));
    const paidCents = Number(standing?.paid ?? 0);
    await database
      .update(charges)
      .set({ paidCents, paidOn: standing?.lastPaidOn ?? null, status: settleStatus({ ...charge, paidCents }) })
      .where(eq(charges.id, chargeId));
    if (charge.saleId) await refreshSale(database, organizationId, charge.saleId);
  });
}

export async function changeDueDate(db: DB, organizationId: string, chargeId: string, dueOn: string) {
  return db.transaction(async (tx) => {
    const database = tx as DB;
    const [charge] = await database
      .select()
      .from(charges)
      .where(and(eq(charges.organizationId, organizationId), eq(charges.id, chargeId)))
      .for("update");
    if (!charge) throw new DomainError("Cobrança não encontrada.");
    if (!isOpen(charge)) throw new DomainError("Esta cobrança não muda de vencimento.");
    await database.insert(dueChanges).values({
      id: id(),
      organizationId,
      chargeId,
      previousDue: charge.dueOn,
      nextDue: dueOn,
      createdAt: nowIso(),
    });
    await database.update(charges).set({ dueOn }).where(eq(charges.id, chargeId));
  });
}

export async function setRecurrenceStatus(db: DB, organizationId: string, recurrenceId: string, status: "ativa" | "suspensa" | "cancelada") {
  await db.update(recurrences).set({ status }).where(and(eq(recurrences.organizationId, organizationId), eq(recurrences.id, recurrenceId)));
}

export async function setContractStatus(db: DB, organizationId: string, contractId: string, status: "ativo" | "suspenso" | "encerrado") {
  const [contract] = await db.select().from(contracts).where(and(eq(contracts.organizationId, organizationId), eq(contracts.id, contractId)));
  if (!contract) throw new DomainError("Contrato não encontrado.");
  await db.update(contracts).set({ status }).where(eq(contracts.id, contractId));
}

export async function cancelSale(db: DB, organizationId: string, saleId: string) {
  await db.transaction(async (tx) => {
    const database = tx as DB;
    const { sale, rows } = await lockSaleCharges(database, organizationId, saleId);
    if (sale.status === "cancelada") return;
    if (rows.some((row) => row.paidCents > 0)) throw new DomainError("Estorne os recebimentos antes de cancelar a venda.");
    await restoreStock(database, organizationId, saleId, "cancelamento");
    await database.update(sales).set({ status: "cancelada" }).where(eq(sales.id, saleId));
    await database.update(charges).set({ status: "cancelada" }).where(and(eq(charges.organizationId, organizationId), eq(charges.saleId, saleId)));
    await database.update(contracts).set({ status: "encerrado" }).where(and(eq(contracts.organizationId, organizationId), eq(contracts.saleId, saleId)));
    const recurrenceIds = [...new Set(rows.map((row) => row.recurrenceId).filter((value): value is string => Boolean(value)))];
    if (recurrenceIds.length > 0) {
      await database.update(recurrences).set({ status: "cancelada" }).where(and(eq(recurrences.organizationId, organizationId), inArray(recurrences.id, recurrenceIds)));
    }
  });
}

export async function deleteSale(db: DB, organizationId: string, saleId: string) {
  return db.transaction(async (tx) => {
    const database = tx as DB;
    const { sale, rows } = await lockSaleCharges(database, organizationId, saleId);
    if (sale.status === "cancelada") throw new DomainError("Venda cancelada não pode ser excluída.");
    if (rows.some((charge) => charge.paidCents > 0)) throw new DomainError("Estorne os recebimentos antes de excluir a venda.");
    await restoreStock(database, organizationId, saleId, "exclusao");
    await deleteChargesOf(database, organizationId, rows.map((charge) => charge.id));
    await database.delete(stockMoves).where(and(eq(stockMoves.organizationId, organizationId), eq(stockMoves.saleId, saleId)));
    await database.delete(saleItems).where(and(eq(saleItems.organizationId, organizationId), eq(saleItems.saleId, saleId)));
    await database.delete(contracts).where(and(eq(contracts.organizationId, organizationId), eq(contracts.saleId, saleId)));
    await database.delete(fiscalDocuments).where(and(eq(fiscalDocuments.organizationId, organizationId), eq(fiscalDocuments.saleId, saleId)));
    await deleteRecurrencesOf(database, organizationId, rows);
    await database.delete(sales).where(eq(sales.id, saleId));
  });
}

const MAX_CYCLES_PER_PASS = 24;

export async function advanceRecurrences(db: DB, organizationId: string, today: string) {
  const active = await db.select().from(recurrences).where(and(eq(recurrences.organizationId, organizationId), eq(recurrences.status, "ativa")));
  for (const recurrence of active) {
    const periodicity = recurrence.periodicity as Periodicity;
    // Cada vencimento parte do dia original. Encadear de mês em mês deixaria 31 de janeiro virar dia 28 para sempre.
    let index = periodIndexOnOrAfter(recurrence.startsOn, periodicity, recurrence.nextOn);
    let next = addPeriod(recurrence.startsOn, periodicity, index);
    const due: string[] = [];
    while (next <= today && due.length < MAX_CYCLES_PER_PASS) {
      if (recurrence.endsOn && next > recurrence.endsOn) break;
      due.push(next);
      index += 1;
      next = addPeriod(recurrence.startsOn, periodicity, index);
    }
    if (due.length === 0 && next === recurrence.nextOn) continue;
    await db.transaction(async (tx) => {
      const database = tx as DB;
      if (due.length > 0) {
        const [sample] = await database
          .select()
          .from(charges)
          .where(and(eq(charges.organizationId, organizationId), eq(charges.recurrenceId, recurrence.id)))
          .limit(1);
        const codes = await nextCodes(database, organizationId, "COB", "charges", due.length);
        for (const [position, dueOn] of due.entries()) {
          await database
            .insert(charges)
            .values(
              chargeRow(
                organizationId,
                recurrence.clientId,
                codes[position],
                { saleId: sample?.saleId ?? null, contractId: sample?.contractId ?? null, recurrenceId: recurrence.id },
                sample?.method ?? "Pix",
                { dueOn, amountCents: recurrence.amountCents, number: null, count: null, label: recurrenceLabel(periodicity) },
              ),
            )
            .onConflictDoNothing({ target: [charges.recurrenceId, charges.dueOn], where: sql`recurrence_id is not null` });
        }
      }
      await database.update(recurrences).set({ nextOn: next }).where(eq(recurrences.id, recurrence.id));
    });
  }
}
