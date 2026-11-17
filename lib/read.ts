import { and, asc, count, eq, isNotNull } from "drizzle-orm";
import { daysLate, delayBand, shiftDays, todayIn } from "./dates";
import type { DB } from "./db";
import {
  catalogItems,
  charges,
  clients,
  contacts,
  contracts,
  dueChanges,
  integrationEvents,
  members,
  organizations,
  payments,
  recurrences,
  saleItems,
  sales,
} from "./schema";
import { isOpen, settleStatus } from "./status";

export async function loadBook(db: DB, organizationId: string, timeZone: string) {
  const today = todayIn(timeZone);
  const [clientRows, catalog, saleRows, items, contractRows, recurrenceRows, chargeRows, paymentRows, contactRows, events, memberRows, dueRows] =
    await Promise.all([
      db.select().from(clients).where(eq(clients.organizationId, organizationId)),
      db.select().from(catalogItems).where(eq(catalogItems.organizationId, organizationId)),
      db.select().from(sales).where(eq(sales.organizationId, organizationId)),
      db.select().from(saleItems).where(eq(saleItems.organizationId, organizationId)),
      db.select().from(contracts).where(eq(contracts.organizationId, organizationId)),
      db.select().from(recurrences).where(eq(recurrences.organizationId, organizationId)),
      db.select().from(charges).where(eq(charges.organizationId, organizationId)),
      db.select().from(payments).where(eq(payments.organizationId, organizationId)),
      db.select().from(contacts).where(eq(contacts.organizationId, organizationId)),
      db.select().from(integrationEvents).where(eq(integrationEvents.organizationId, organizationId)),
      db.select().from(members).where(eq(members.organizationId, organizationId)),
      db.select().from(dueChanges).where(eq(dueChanges.organizationId, organizationId)),
    ]);
  return {
    today,
    clients: clientRows,
    catalog,
    sales: saleRows,
    items,
    contracts: contractRows,
    recurrences: recurrenceRows,
    charges: chargeRows,
    payments: paymentRows,
    contacts: contactRows,
    events,
    members: memberRows,
    dueChanges: dueRows,
  };
}

export type Book = Awaited<ReturnType<typeof loadBook>>;

export const PAGE_SIZE = 8;

export async function pagedRows<T>(total: number, page: number, load: (offset: number) => Promise<T[]>) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(Math.max(page, 1), pages);
  const rows = await load((current - 1) * PAGE_SIZE);
  return { rows, page: current, pages, total };
}

// "parcelas" são as cobranças que nascem de um cronograma (venda ou contrato). Recorrência e avulsa ficam de fora.
export async function pagedCharges(db: DB, organizationId: string, page: number, scope: "todas" | "parcelas" = "todas") {
  const where = scope === "parcelas" ? and(eq(charges.organizationId, organizationId), isNotNull(charges.number)) : eq(charges.organizationId, organizationId);
  const [totals] = await db.select({ total: count() }).from(charges).where(where);
  return pagedRows(Number(totals?.total ?? 0), page, (offset) =>
    db.select().from(charges).where(where).orderBy(asc(charges.dueOn)).limit(PAGE_SIZE).offset(offset),
  );
}

export function displayStatus(status: string, dueOn: string, today: string, paid: number, amount: number) {
  const row = { status, paidCents: paid, amountCents: amount };
  return isOpen(row) && dueOn < today ? "vencida" : settleStatus(row);
}

export function periodRange(preset: string, today: string, from?: string, to?: string) {
  if (preset === "personalizado" && from && to) return { from, to };
  if (preset === "7") return { from: shiftDays(today, -6), to: today };
  if (preset === "30") return { from: shiftDays(today, -29), to: today };
  if (preset === "mes") return { from: `${today.slice(0, 7)}-01`, to: today };
  if (preset === "anterior") {
    const [year, month] = today.split("-").map(Number);
    const start = new Date(Date.UTC(year, month - 2, 1));
    const end = new Date(Date.UTC(year, month - 1, 0));
    return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
  }
  if (preset === "ano") return { from: `${today.slice(0, 4)}-01-01`, to: today };
  return { from: today, to: today };
}

function inRange(iso: string, from: string, to: string) {
  return iso >= from && iso <= to;
}

export function dashboard(book: Book, from: string, to: string) {
  const rangedSales = book.sales.filter((sale) => sale.status !== "cancelada" && inRange(sale.soldOn, from, to));
  const saleIds = new Set(rangedSales.map((sale) => sale.id));
  const sold = rangedSales.reduce((sum, sale) => sum + sale.totalCents, 0);
  const received = book.payments
    .filter((payment) => !payment.reversedAt && inRange(payment.paidOn, from, to))
    .reduce((sum, payment) => sum + payment.amountCents, 0);
  const open = book.charges
    .filter((row) => row.number !== null && row.saleId !== null && saleIds.has(row.saleId) && row.status !== "cancelada")
    .reduce((sum, row) => sum + (row.amountCents - row.paidCents), 0);
  const lateRows = book.charges.filter((row) => isOpen(row) && row.dueOn < book.today && inRange(row.dueOn, from, to));
  const late = lateRows.reduce((sum, row) => sum + (row.amountCents - row.paidCents), 0);
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(Date.UTC(Number(to.slice(0, 4)), Number(to.slice(5, 7)) - 1 - (5 - index), 1));
    const key = date.toISOString().slice(0, 7);
    return {
      month: key,
      vendido: book.sales.filter((sale) => sale.status !== "cancelada" && sale.soldOn.startsWith(key)).reduce((sum, sale) => sum + sale.totalCents, 0),
      recebido: book.payments.filter((payment) => !payment.reversedAt && payment.paidOn.startsWith(key)).reduce((sum, payment) => sum + payment.amountCents, 0),
    };
  });
  const statusCount = ["pendente", "paga", "vencida", "parcial", "cancelada"].map((status) => ({
    status,
    total: book.charges.filter((charge) => displayStatus(charge.status, charge.dueOn, book.today, charge.paidCents, charge.amountCents) === status).length,
  }));
  return {
    sold,
    received,
    open,
    late,
    salesCount: rangedSales.length,
    activeContracts: book.contracts.filter((contract) => contract.status === "ativo").length,
    activeRecurrences: book.recurrences.filter((recurrence) => recurrence.status === "ativa").length,
    months,
    statusCount,
    nextDues: book.charges
      .filter((row) => isOpen(row) && row.dueOn >= book.today)
      .sort((a, b) => a.dueOn.localeCompare(b.dueOn))
      .slice(0, 5),
    recentSales: [...rangedSales].sort((a, b) => b.soldOn.localeCompare(a.soldOn)).slice(0, 5),
    lateCharges: lateRows.slice(0, 5),
  };
}

export function clientName(book: Book, clientId: string) {
  return book.clients.find((client) => client.id === clientId)?.name ?? "Cliente";
}

export function clientFinance(book: Book, clientId: string) {
  const ownSales = book.sales.filter((sale) => sale.clientId === clientId && sale.status !== "cancelada");
  const bought = ownSales.reduce((sum, sale) => sum + sale.totalCents, 0);
  const ownCharges = book.charges.filter((charge) => charge.clientId === clientId);
  const ownIds = new Set(ownCharges.map((charge) => charge.id));
  const paid = book.payments
    .filter((payment) => !payment.reversedAt && ownIds.has(payment.chargeId))
    .reduce((sum, payment) => sum + payment.amountCents, 0);
  const open = ownCharges.filter((charge) => charge.status !== "cancelada").reduce((sum, charge) => sum + (charge.amountCents - charge.paidCents), 0);
  return { sales: ownSales.length, bought, paid, open };
}

export function delinquency(book: Book) {
  return book.charges
    .map((charge) => {
      const status = displayStatus(charge.status, charge.dueOn, book.today, charge.paidCents, charge.amountCents);
      const days = daysLate(charge.dueOn, book.today);
      const last = book.contacts.filter((contact) => contact.chargeId === charge.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      return { charge, status, days, band: delayBand(Math.max(days, 1)), last };
    })
    .filter((row) => row.status === "vencida");
}

export function receiptsByMethod(book: Book) {
  const byMethod = new Map<string, number>();
  for (const payment of book.payments) {
    if (payment.reversedAt) continue;
    byMethod.set(payment.method, (byMethod.get(payment.method) ?? 0) + payment.amountCents);
  }
  return [...byMethod.entries()]
    .map(([method, total]) => ({ method, total }))
    .sort((a, b) => b.total - a.total);
}

export function salesByItem(book: Book) {
  const cancelled = new Set(book.sales.filter((sale) => sale.status === "cancelada").map((sale) => sale.id));
  const byItem = new Map<string, { total: number; quantity: number }>();
  for (const item of book.items) {
    if (cancelled.has(item.saleId)) continue;
    const current = byItem.get(item.description) ?? { total: 0, quantity: 0 };
    byItem.set(item.description, { total: current.total + item.totalCents, quantity: current.quantity + item.quantity });
  }
  return [...byItem.entries()]
    .map(([description, value]) => ({ description, ...value }))
    .sort((a, b) => b.total - a.total);
}

export function saleBalance(book: Book, saleId: string) {
  const own = book.charges.filter((charge) => charge.saleId === saleId);
  const chargeIds = new Set(own.map((charge) => charge.id));
  const received = book.payments
    .filter((payment) => !payment.reversedAt && chargeIds.has(payment.chargeId))
    .reduce((sum, payment) => sum + payment.amountCents, 0);
  const sale = book.sales.find((row) => row.id === saleId);
  // O saldo vem das cobranças, porque juros de financiamento fazem a soma delas passar do preço da venda.
  const open = !sale
    ? 0
    : sale.mode === "recorrente"
      ? Math.max(sale.totalCents - received, 0)
      : own.filter((charge) => charge.status !== "cancelada").reduce((sum, charge) => sum + (charge.amountCents - charge.paidCents), 0);
  return { received, open };
}

export type OrgRow = typeof organizations.$inferSelect;
