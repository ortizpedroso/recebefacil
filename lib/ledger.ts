import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { Periodicity } from "./dates";
import { addPeriod } from "./dates";
import type { DB } from "./db";
import { cents, splitBalance, type Cents } from "./money";
import { catalogItems, charges, clients, contracts, dueChanges, installments, payments, recurrences, saleItems, sales, stockMoves } from "./schema";

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

async function nextCode(db: DB, organizationId: string, prefix: string, table: "sales" | "charges" | "contracts") {
  const rows =
    table === "sales"
      ? await db.select({ id: sales.id }).from(sales).where(eq(sales.organizationId, organizationId))
      : table === "charges"
        ? await db.select({ id: charges.id }).from(charges).where(eq(charges.organizationId, organizationId))
        : await db.select({ id: contracts.id }).from(contracts).where(eq(contracts.organizationId, organizationId));
  return `${prefix}-${String(rows.length + 1).padStart(4, "0")}`;
}

function saleStatus(total: number, paid: number, cancelled: boolean) {
  if (cancelled) return "cancelada";
  if (paid <= 0) return "aguardando";
  if (paid < total) return "parcial";
  return "paga";
}

function openStatus(amount: number, paid: number, closed: string | null) {
  if (closed) return closed;
  if (paid <= 0) return "pendente";
  if (paid < amount) return "parcial";
  return "paga";
}

export async function createSale(db: DB, organizationId: string, input: SaleInput) {
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
  const itemsTotal = input.items.reduce((sum, item) => sum + item.quantity * item.unitCents, 0);
  if (itemsTotal <= input.discountCents) throw new DomainError("O desconto zera a venda.");
  const total = cents(itemsTotal - input.discountCents);
  const entry = input.mode === "parcelado" ? input.entryCents : cents(0);
  if (entry > total) throw new DomainError("A entrada passa do total.");
  if (entry === total && input.mode === "parcelado") throw new DomainError("A entrada quita a venda. Use à vista.");

  return db.transaction(async (tx) => {
    const saleId = id();
    const code = await nextCode(tx as DB, organizationId, "VND", "sales");
    await tx.insert(sales).values({
      id: saleId,
      organizationId,
      code,
      clientId: input.clientId,
      soldOn: input.soldOn,
      discountCents: input.discountCents,
      totalCents: total,
      notes: input.notes,
      mode: input.mode,
      status: "aguardando",
      createdAt: nowIso(),
    });
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
      if (!item.catalogItemId) continue;
      const [catalog] = await tx
        .select()
        .from(catalogItems)
        .where(and(eq(catalogItems.organizationId, organizationId), eq(catalogItems.id, item.catalogItemId)));
      if (!catalog || catalog.stockQuantity === null) continue;
      if (catalog.stockQuantity < item.quantity) throw new DomainError(`Estoque insuficiente para ${item.description}.`);
      await tx.update(catalogItems).set({ stockQuantity: catalog.stockQuantity - item.quantity }).where(eq(catalogItems.id, catalog.id));
      await tx.insert(stockMoves).values({
        id: id(),
        organizationId,
        catalogItemId: catalog.id,
        saleId,
        quantity: -item.quantity,
        reason: "venda",
        createdAt: nowIso(),
      });
    }

    const contractId = input.makeContract || input.mode !== "avista" ? id() : null;
    if (contractId) {
      const number = await nextCode(tx as DB, organizationId, "CTR", "contracts");
      await tx.insert(contracts).values({
        id: contractId,
        organizationId,
        number,
        clientId: input.clientId,
        saleId,
        description: input.items.map((item) => item.description).join(", "),
        totalCents: total,
        startsOn: input.soldOn,
        endsOn: input.mode === "parcelado" ? addPeriod(input.firstDue, input.periodicity, input.installmentCount - 1) : null,
        status: "ativo",
        terms: input.mode === "recorrente" ? `Recorrência ${input.periodicity}` : `Entrada e ${input.installmentCount} parcelas`,
      });
    }

    const schedule: { label: string; dueOn: string; amount: Cents; number: number; count: number }[] = [];
    if (input.mode === "avista") {
      schedule.push({ label: "À vista", dueOn: input.soldOn, amount: total, number: 1, count: 1 });
    } else if (input.mode === "parcelado") {
      const parts = splitBalance(cents(total - entry), input.installmentCount);
      const count = parts.length + (entry > 0 ? 1 : 0);
      if (entry > 0) schedule.push({ label: "Entrada", dueOn: input.soldOn, amount: entry, number: 1, count });
      parts.forEach((amount, index) => {
        schedule.push({
          label: `Parcela ${index + 1}/${parts.length}`,
          dueOn: addPeriod(input.firstDue, input.periodicity, index),
          amount,
          number: schedule.length + 1,
          count,
        });
      });
    }

    for (const part of schedule) {
      const installmentId = id();
      const chargeId = id();
      const chargeCode = await nextCode(tx as DB, organizationId, "COB", "charges");
      await tx.insert(installments).values({
        id: installmentId,
        organizationId,
        saleId,
        contractId,
        clientId: input.clientId,
        number: part.number,
        count: part.count,
        label: part.label,
        dueOn: part.dueOn,
        amountCents: part.amount,
        paidCents: 0,
        status: "pendente",
      });
      await tx.insert(charges).values({
        id: chargeId,
        organizationId,
        code: chargeCode,
        clientId: input.clientId,
        saleId,
        contractId,
        installmentId,
        recurrenceId: null,
        amountCents: part.amount,
        paidCents: 0,
        dueOn: part.dueOn,
        method: input.method,
        status: "pendente",
        paidOn: null,
      });
    }

    if (input.mode === "recorrente") {
      const recurrenceId = id();
      const chargeId = id();
      const chargeCode = await nextCode(tx as DB, organizationId, "COB", "charges");
      await tx.insert(recurrences).values({
        id: recurrenceId,
        organizationId,
        clientId: input.clientId,
        catalogItemId: input.items[0]?.catalogItemId ?? null,
        description: input.items.map((item) => item.description).join(", "),
        amountCents: total,
        periodicity: input.periodicity,
        startsOn: input.firstDue,
        nextOn: addPeriod(input.firstDue, input.periodicity, 1),
        endsOn: null,
        status: "ativa",
      });
      await tx.insert(charges).values({
        id: chargeId,
        organizationId,
        code: chargeCode,
        clientId: input.clientId,
        saleId,
        contractId,
        installmentId: null,
        recurrenceId,
        amountCents: total,
        paidCents: 0,
        dueOn: input.firstDue,
        method: input.method,
        status: "pendente",
        paidOn: null,
      });
    }

    const saved = await tx.select().from(installments).where(and(eq(installments.organizationId, organizationId), eq(installments.saleId, saleId)));
    const sum = saved.reduce((totalPaid, row) => totalPaid + row.amountCents, 0);
    if (input.mode !== "recorrente" && sum !== total) throw new DomainError("A soma das parcelas não fecha o total.");
    return saleId;
  });
}

async function refreshSale(tx: DB, organizationId: string, saleId: string) {
  const [sale] = await tx.select().from(sales).where(and(eq(sales.organizationId, organizationId), eq(sales.id, saleId)));
  if (!sale || sale.status === "cancelada") return;
  const rows = await tx.select().from(charges).where(and(eq(charges.organizationId, organizationId), eq(charges.saleId, saleId)));
  const paid = rows.filter((row) => row.status !== "cancelada" && row.status !== "estornada").reduce((sum, row) => sum + row.paidCents, 0);
  await tx.update(sales).set({ status: saleStatus(sale.totalCents, paid, false) }).where(eq(sales.id, saleId));
}

export async function registerPayment(
  db: DB,
  organizationId: string,
  input: { chargeId: string; amountCents: Cents; paidOn: string; method: string; note: string; idempotencyKey?: string },
) {
  return db.transaction(async (tx) => {
    const database = tx as DB;
    if (input.idempotencyKey) {
      const [existing] = await database
        .select()
        .from(payments)
        .where(and(eq(payments.organizationId, organizationId), eq(payments.idempotencyKey, input.idempotencyKey)));
      if (existing) {
        if (existing.amountCents !== input.amountCents) throw new DomainError("A mesma chave veio com outro valor.");
        return existing.id;
      }
    }
    const [charge] = await database
      .select()
      .from(charges)
      .where(and(eq(charges.organizationId, organizationId), eq(charges.id, input.chargeId)));
    if (!charge) throw new DomainError("Cobrança não encontrada.");
    if (charge.status === "cancelada" || charge.status === "estornada") throw new DomainError("Esta cobrança não aceita pagamento.");
    const open = charge.amountCents - charge.paidCents;
    if (input.amountCents > open) throw new DomainError("O pagamento passa do saldo.");
    const paymentId = id();
    await database.insert(payments).values({
      id: paymentId,
      organizationId,
      chargeId: charge.id,
      installmentId: charge.installmentId,
      amountCents: input.amountCents,
      paidOn: input.paidOn,
      method: input.method,
      note: input.note,
      idempotencyKey: input.idempotencyKey ?? null,
      reversedAt: null,
    });
    const paid = charge.paidCents + input.amountCents;
    await database
      .update(charges)
      .set({ paidCents: paid, status: openStatus(charge.amountCents, paid, null), paidOn: input.paidOn })
      .where(eq(charges.id, charge.id));
    if (charge.installmentId) {
      const [installment] = await database.select().from(installments).where(eq(installments.id, charge.installmentId));
      if (installment) {
        const installmentPaid = installment.paidCents + input.amountCents;
        await database
          .update(installments)
          .set({ paidCents: installmentPaid, status: openStatus(installment.amountCents, installmentPaid, null) })
          .where(eq(installments.id, installment.id));
      }
    }
    if (charge.saleId) await refreshSale(database, organizationId, charge.saleId);
    return paymentId;
  });
}

export async function reverseCharge(db: DB, organizationId: string, chargeId: string) {
  return db.transaction(async (tx) => {
    const database = tx as DB;
    const [charge] = await database.select().from(charges).where(and(eq(charges.organizationId, organizationId), eq(charges.id, chargeId)));
    if (!charge) throw new DomainError("Cobrança não encontrada.");
    if (charge.status === "estornada") return;
    const rows = await database.select().from(payments).where(and(eq(payments.organizationId, organizationId), eq(payments.chargeId, chargeId)));
    for (const payment of rows) {
      if (!payment.reversedAt) {
        await database.update(payments).set({ reversedAt: nowIso() }).where(eq(payments.id, payment.id));
      }
    }
    await database.update(charges).set({ paidCents: 0, status: "estornada", paidOn: null }).where(eq(charges.id, chargeId));
    if (charge.installmentId) {
      await database.update(installments).set({ paidCents: 0, status: "pendente" }).where(eq(installments.id, charge.installmentId));
    }
    if (charge.saleId) await refreshSale(database, organizationId, charge.saleId);
  });
}

export async function changeDueDate(db: DB, organizationId: string, installmentId: string, dueOn: string) {
  const [installment] = await db
    .select()
    .from(installments)
    .where(and(eq(installments.organizationId, organizationId), eq(installments.id, installmentId)));
  if (!installment) throw new DomainError("Parcela não encontrada.");
  if (installment.status === "paga" || installment.status === "cancelada") throw new DomainError("Esta parcela não muda de vencimento.");
  await db.insert(dueChanges).values({
    id: id(),
    organizationId,
    installmentId,
    previousDue: installment.dueOn,
    nextDue: dueOn,
    createdAt: nowIso(),
  });
  await db.update(installments).set({ dueOn }).where(eq(installments.id, installmentId));
  await db.update(charges).set({ dueOn }).where(and(eq(charges.organizationId, organizationId), eq(charges.installmentId, installmentId)));
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
  const [sale] = await db.select().from(sales).where(and(eq(sales.organizationId, organizationId), eq(sales.id, saleId)));
  if (!sale) throw new DomainError("Venda não encontrada.");
  if (sale.status === "cancelada") return;
  const rows = await db.select().from(charges).where(and(eq(charges.organizationId, organizationId), eq(charges.saleId, saleId)));
  if (rows.some((row) => row.paidCents > 0 && row.status !== "estornada")) {
    throw new DomainError("Estorne os recebimentos antes de cancelar a venda.");
  }
  await db.transaction(async (tx) => {
    await tx.update(sales).set({ status: "cancelada" }).where(eq(sales.id, saleId));
    await tx.update(installments).set({ status: "cancelada" }).where(and(eq(installments.organizationId, organizationId), eq(installments.saleId, saleId)));
    await tx.update(charges).set({ status: "cancelada" }).where(and(eq(charges.organizationId, organizationId), eq(charges.saleId, saleId)));
    await tx.update(contracts).set({ status: "encerrado" }).where(and(eq(contracts.organizationId, organizationId), eq(contracts.saleId, saleId)));
  });
}

export async function advanceRecurrences(db: DB, organizationId: string, today: string) {
  const rows = await db.select().from(recurrences).where(and(eq(recurrences.organizationId, organizationId), eq(recurrences.status, "ativa")));
  for (const recurrence of rows) {
    let next = recurrence.nextOn;
    let guard = 0;
    while (next <= today && guard < 24) {
      if (recurrence.endsOn && next > recurrence.endsOn) break;
      const [existing] = await db
        .select()
        .from(charges)
        .where(and(eq(charges.organizationId, organizationId), eq(charges.recurrenceId, recurrence.id), eq(charges.dueOn, next)));
      if (!existing) {
        const [sample] = await db
          .select()
          .from(charges)
          .where(and(eq(charges.organizationId, organizationId), eq(charges.recurrenceId, recurrence.id)));
        await db.insert(charges).values({
          id: id(),
          organizationId,
          code: await nextCode(db, organizationId, "COB", "charges"),
          clientId: recurrence.clientId,
          saleId: sample?.saleId ?? null,
          contractId: sample?.contractId ?? null,
          installmentId: null,
          recurrenceId: recurrence.id,
          amountCents: recurrence.amountCents,
          paidCents: 0,
          dueOn: next,
          method: sample?.method ?? "Pix",
          status: "pendente",
          paidOn: null,
        });
      }
      next = addPeriod(next, recurrence.periodicity as Periodicity, 1);
      guard += 1;
    }
    if (next !== recurrence.nextOn) {
      await db.update(recurrences).set({ nextOn: next }).where(eq(recurrences.id, recurrence.id));
    }
  }
}
