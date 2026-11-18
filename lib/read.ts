import { eq } from "drizzle-orm";
import { todayIn } from "./dates";
import type { DB } from "./db";
import {
  catalogItems,
  charges,
  clients,
  contacts,
  contracts,
  dueChanges,
  members,
  organizations,
  payments,
  recurrences,
  saleItems,
  sales,
} from "./schema";

export async function loadBook(db: DB, organizationId: string, timeZone: string) {
  const today = todayIn(timeZone);
  const [clientRows, catalog, saleRows, items, contractRows, recurrenceRows, chargeRows, paymentRows, contactRows, memberRows, dueRows] =
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
    members: memberRows,
    dueChanges: dueRows,
  };
}

export type Book = Awaited<ReturnType<typeof loadBook>>;

// Seis meses terminando no mês de hoje: o que foi vendido e o que entrou no caixa.
export function monthlySeries(book: Book, today: string) {
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1 - (5 - index), 1));
    const key = date.toISOString().slice(0, 7);
    return {
      month: key,
      vendido: book.sales.filter((sale) => sale.status !== "cancelada" && sale.soldOn.startsWith(key)).reduce((sum, sale) => sum + sale.totalCents, 0),
      recebido: book.payments.filter((payment) => !payment.reversedAt && payment.paidOn.startsWith(key)).reduce((sum, payment) => sum + payment.amountCents + payment.feeCents, 0),
    };
  });
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
