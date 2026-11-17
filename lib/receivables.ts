import { and, asc, count, countDistinct, desc, eq, gte, ilike, inArray, isNull, lt, lte, sql, type SQL } from "drizzle-orm";
import { daysLate, monthName, monthStart, nextMonthStart, shiftDays } from "./dates";
import type { DB } from "./db";
import { chargeBadge, chargeTitle, type Badge } from "./labels";
import { lateCharges, type LateSettings } from "./late";
import { catalogImages, charges, clients, contracts, payments, recurrences, saleItems } from "./schema";
import { CHARGE_STATES } from "./status";

// "Atrasadas", "Este mês" e "Próximos meses" olham o saldo em aberto. "Recebidas" olha o que já quitou.
export const BUCKETS = ["atrasadas", "mes", "proximas", "recebidas"] as const;
export type Bucket = (typeof BUCKETS)[number];

export const BUCKET_LABELS: Record<Bucket, string> = {
  atrasadas: "Atrasadas",
  mes: "Este mês",
  proximas: "Próximos meses",
  recebidas: "Recebidas",
};

export function isBucket(value: string | undefined): value is Bucket {
  return (BUCKETS as readonly string[]).includes(value ?? "");
}

const OPEN_STATUSES = CHARGE_STATES.filter((state) => state.open).map((state) => state.status);
const isOpenCharge = inArray(charges.status, [...OPEN_STATUSES]);
const openStatusSql = sql.join(OPEN_STATUSES.map((status) => sql`${status}`), sql`, `);
const openCentsSql = sql<number>`coalesce(sum(${charges.amountCents} - ${charges.paidCents}), 0)`.mapWith(Number);

type Window = "semana";

function chargeFilter(bucket: Bucket | Window, today: string): SQL {
  const next = nextMonthStart(today);
  const open = (extra: SQL) => and(isOpenCharge, extra) as SQL;
  if (bucket === "atrasadas") return open(lt(charges.dueOn, today));
  if (bucket === "mes") return open(and(gte(charges.dueOn, today), lt(charges.dueOn, next)) as SQL);
  if (bucket === "proximas") return open(gte(charges.dueOn, next));
  if (bucket === "semana") return open(and(gte(charges.dueOn, today), lte(charges.dueOn, shiftDays(today, 7))) as SQL);
  return eq(charges.status, "paga");
}

function byClientName(q: string | undefined): SQL | undefined {
  const text = (q ?? "").trim();
  return text ? ilike(clients.name, `%${text.replace(/[%_\\]/g, "\\$&")}%`) : undefined;
}

export async function bucketCounts(db: DB, organizationId: string, today: string, q?: string): Promise<Record<Bucket, number>> {
  const counts = await Promise.all(
    BUCKETS.map(async (bucket) => {
      const [row] = await db
        .select({ total: count() })
        .from(charges)
        .innerJoin(clients, eq(clients.id, charges.clientId))
        .where(and(eq(charges.organizationId, organizationId), chargeFilter(bucket, today), byClientName(q)));
      return [bucket, Number(row?.total ?? 0)] as const;
    }),
  );
  return Object.fromEntries(counts) as Record<Bucket, number>;
}

export type ReceivableRow = {
  id: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  saleId: string | null;
  title: string;
  what: string;
  dueOn: string;
  amountCents: number;
  paidCents: number;
  openCents: number;
  paidOn: string | null;
  badge: Badge;
  closed: boolean;
  late: number;
  feeCents: number;
  paymentId: string | null;
};

type ChargeWithClient = { charge: typeof charges.$inferSelect; clientName: string; clientPhone: string };

export function itemsSummary(items: { description: string; quantity: number }[]): string {
  return items.map((item) => `${item.quantity > 1 ? `${item.quantity}× ` : ""}${item.description}`).join(", ");
}

async function describe(db: DB, organizationId: string, rows: ChargeWithClient[], today: string, settings: LateSettings): Promise<ReceivableRow[]> {
  const unique = (values: (string | null)[]) => [...new Set(values.filter((value): value is string => Boolean(value)))];
  const saleIds = unique(rows.map((row) => row.charge.saleId));
  const contractIds = unique(rows.map((row) => row.charge.contractId));
  const recurrenceIds = unique(rows.map((row) => row.charge.recurrenceId));
  const paidIds = unique(rows.filter((row) => row.charge.paidCents > 0).map((row) => row.charge.id));
  const [items, contractRows, recurrenceRows, paymentRows] = await Promise.all([
    saleIds.length ? db.select().from(saleItems).where(and(eq(saleItems.organizationId, organizationId), inArray(saleItems.saleId, saleIds))) : [],
    contractIds.length ? db.select().from(contracts).where(and(eq(contracts.organizationId, organizationId), inArray(contracts.id, contractIds))) : [],
    recurrenceIds.length ? db.select().from(recurrences).where(and(eq(recurrences.organizationId, organizationId), inArray(recurrences.id, recurrenceIds))) : [],
    paidIds.length
      ? db
          .select()
          .from(payments)
          .where(and(eq(payments.organizationId, organizationId), inArray(payments.chargeId, paidIds), isNull(payments.reversedAt)))
          .orderBy(desc(payments.paidOn), desc(payments.id))
      : [],
  ]);
  const itemsBySale = new Map<string, { description: string; quantity: number }[]>();
  for (const item of items) itemsBySale.set(item.saleId, [...(itemsBySale.get(item.saleId) ?? []), item]);
  const contractText = new Map(contractRows.map((row) => [row.id, row.description]));
  const recurrenceText = new Map(recurrenceRows.map((row) => [row.id, row.description]));
  const lastPayment = new Map<string, string>();
  for (const payment of paymentRows) if (!lastPayment.has(payment.chargeId)) lastPayment.set(payment.chargeId, payment.id);

  return rows.map(({ charge, clientName, clientPhone }) => {
    const openCents = charge.status === "cancelada" ? 0 : charge.amountCents - charge.paidCents;
    const badge = chargeBadge(charge, today);
    const fee = badge.tone === "late" ? lateCharges(openCents, charge.dueOn, today, settings) : { fineCents: 0, interestCents: 0 };
    const what =
      (charge.saleId && itemsSummary(itemsBySale.get(charge.saleId) ?? [])) ||
      (charge.contractId && contractText.get(charge.contractId)) ||
      (charge.recurrenceId && recurrenceText.get(charge.recurrenceId)) ||
      "";
    return {
      id: charge.id,
      clientId: charge.clientId,
      clientName,
      clientPhone,
      saleId: charge.saleId,
      title: chargeTitle(charge),
      what,
      dueOn: charge.dueOn,
      amountCents: charge.amountCents,
      paidCents: charge.paidCents,
      openCents,
      paidOn: charge.paidOn,
      badge,
      closed: badge.tone === "paid" || badge.tone === "muted",
      late: Math.max(daysLate(charge.dueOn, today), 0),
      feeCents: fee.fineCents + fee.interestCents,
      paymentId: lastPayment.get(charge.id) ?? null,
    };
  });
}

export type ChargeQuery = {
  bucket?: Bucket | Window;
  state?: "open" | "closed";
  clientId?: string;
  saleId?: string;
  q?: string;
  limit?: number;
  offset?: number;
};

export async function listReceivables(db: DB, organizationId: string, today: string, settings: LateSettings, query: ChargeQuery): Promise<ReceivableRow[]> {
  const newestFirst = query.bucket === "recebidas" || query.state === "closed";
  const order = newestFirst ? [desc(charges.paidOn), desc(charges.id)] : [asc(charges.dueOn), asc(charges.id)];
  let statement = db
    .select({ charge: charges, clientName: clients.name, whatsapp: clients.whatsapp, phone: clients.phone })
    .from(charges)
    .innerJoin(clients, eq(clients.id, charges.clientId))
    .where(
      and(
        eq(charges.organizationId, organizationId),
        query.bucket ? chargeFilter(query.bucket, today) : undefined,
        query.state === "open" ? isOpenCharge : query.state === "closed" ? eq(charges.status, "paga") : undefined,
        query.clientId ? eq(charges.clientId, query.clientId) : undefined,
        query.saleId ? eq(charges.saleId, query.saleId) : undefined,
        byClientName(query.q),
      ),
    )
    .orderBy(...order)
    .$dynamic();
  if (query.limit !== undefined) statement = statement.limit(query.limit).offset(query.offset ?? 0);
  const found = await statement;
  return describe(
    db,
    organizationId,
    found.map((row) => ({ charge: row.charge, clientName: row.clientName, clientPhone: row.whatsapp || row.phone })),
    today,
    settings,
  );
}

export type MoneyAndCount = { cents: number; count: number };

export type HomeKpis = {
  monthLabel: string;
  toReceive: MoneyAndCount;
  received: MoneyAndCount;
  late: MoneyAndCount & { clients: number };
};

// Os três cartões do Início usam a mesma base: o mês de hoje. Atrasado é o único que atravessa meses, de propósito.
export async function homeKpis(db: DB, organizationId: string, today: string): Promise<HomeKpis> {
  const sumOpen = async (bucket: Bucket) => {
    const [row] = await db
      .select({ cents: openCentsSql, total: count(), clients: countDistinct(charges.clientId) })
      .from(charges)
      .where(and(eq(charges.organizationId, organizationId), chargeFilter(bucket, today)));
    return { cents: row?.cents ?? 0, count: Number(row?.total ?? 0), clients: Number(row?.clients ?? 0) };
  };
  const [month, late, [received]] = await Promise.all([
    sumOpen("mes"),
    sumOpen("atrasadas"),
    db
      .select({ cents: sql<number>`coalesce(sum(${payments.amountCents} + ${payments.feeCents}), 0)`.mapWith(Number), total: count() })
      .from(payments)
      .where(and(eq(payments.organizationId, organizationId), isNull(payments.reversedAt), gte(payments.paidOn, monthStart(today)), lt(payments.paidOn, nextMonthStart(today)))),
  ]);
  return {
    monthLabel: monthName(today),
    toReceive: { cents: month.cents, count: month.count },
    received: { cents: received?.cents ?? 0, count: Number(received?.total ?? 0) },
    late: { cents: late.cents, count: late.count, clients: late.clients },
  };
}

export type SaleSummary = { receivedCents: number; openCents: number; openCount: number; lateCount: number; recurringActive: boolean };

export async function saleSummaries(db: DB, organizationId: string, today: string, saleId?: string): Promise<Map<string, SaleSummary>> {
  const rows = await db
    .select({
      saleId: charges.saleId,
      received: sql<number>`coalesce(sum(${charges.paidCents}) filter (where ${charges.status} <> 'cancelada'), 0)`.mapWith(Number),
      open: sql<number>`coalesce(sum(${charges.amountCents} - ${charges.paidCents}) filter (where ${charges.status} in (${openStatusSql})), 0)`.mapWith(Number),
      openCount: sql<number>`count(*) filter (where ${charges.status} in (${openStatusSql}))`.mapWith(Number),
      lateCount: sql<number>`count(*) filter (where ${charges.status} in (${openStatusSql}) and ${charges.dueOn} < ${today})`.mapWith(Number),
      recurring: sql<boolean>`coalesce(bool_or(${recurrences.status} = 'ativa'), false)`,
    })
    .from(charges)
    .leftJoin(recurrences, eq(recurrences.id, charges.recurrenceId))
    .where(and(eq(charges.organizationId, organizationId), saleId ? eq(charges.saleId, saleId) : sql`${charges.saleId} is not null`))
    .groupBy(charges.saleId);
  return new Map(
    rows.map((row) => [
      row.saleId as string,
      { receivedCents: row.received, openCents: row.open, openCount: row.openCount, lateCount: row.lateCount, recurringActive: row.recurring },
    ]),
  );
}

export type ClientSummary = { openCents: number; lateCount: number; paidCents: number };

export async function clientSummaries(db: DB, organizationId: string, today: string): Promise<Map<string, ClientSummary>> {
  const rows = await db
    .select({
      clientId: charges.clientId,
      open: sql<number>`coalesce(sum(${charges.amountCents} - ${charges.paidCents}) filter (where ${charges.status} in (${openStatusSql})), 0)`.mapWith(Number),
      lateCount: sql<number>`count(*) filter (where ${charges.status} in (${openStatusSql}) and ${charges.dueOn} < ${today})`.mapWith(Number),
      paid: sql<number>`coalesce(sum(${charges.paidCents}) filter (where ${charges.status} <> 'cancelada'), 0)`.mapWith(Number),
    })
    .from(charges)
    .where(eq(charges.organizationId, organizationId))
    .groupBy(charges.clientId);
  return new Map(rows.map((row) => [row.clientId, { openCents: row.open, lateCount: row.lateCount, paidCents: row.paid }]));
}

export async function photoIds(db: DB, organizationId: string): Promise<Map<string, string>> {
  const rows = await db.select({ id: catalogImages.id, itemId: catalogImages.catalogItemId }).from(catalogImages).where(eq(catalogImages.organizationId, organizationId));
  return new Map(rows.map((row) => [row.itemId, row.id]));
}

export type AlertRow = { id: string; clientName: string; dueOn: string; openCents: number; late: number };

// Só o que o sino mostra: quem está atrasado e o que vence logo. Consulta leve, roda em toda tela.
export async function alertRows(db: DB, organizationId: string, today: string) {
  const pick = (bucket: Bucket | Window, limit: number) =>
    db
      .select({ id: charges.id, clientName: clients.name, dueOn: charges.dueOn, amount: charges.amountCents, paid: charges.paidCents })
      .from(charges)
      .innerJoin(clients, eq(clients.id, charges.clientId))
      .where(and(eq(charges.organizationId, organizationId), chargeFilter(bucket, today)))
      .orderBy(asc(charges.dueOn), asc(charges.id))
      .limit(limit);
  const toAlert = (row: { id: string; clientName: string; dueOn: string; amount: number; paid: number }): AlertRow => ({
    id: row.id,
    clientName: row.clientName,
    dueOn: row.dueOn,
    openCents: row.amount - row.paid,
    late: Math.max(daysLate(row.dueOn, today), 0),
  });
  const [lateRows, soonRows, [total]] = await Promise.all([
    pick("atrasadas", 5),
    pick("semana", 3),
    db.select({ total: count() }).from(charges).where(and(eq(charges.organizationId, organizationId), chargeFilter("atrasadas", today))),
  ]);
  return { late: lateRows.map(toAlert), soon: soonRows.map(toAlert), lateCount: Number(total?.total ?? 0) };
}

export async function bucketTotal(db: DB, organizationId: string, today: string, bucket: Bucket, q?: string): Promise<number> {
  const value = bucket === "recebidas" ? sql<number>`coalesce(sum(${charges.paidCents}), 0)`.mapWith(Number) : openCentsSql;
  const [row] = await db
    .select({ cents: value })
    .from(charges)
    .innerJoin(clients, eq(clients.id, charges.clientId))
    .where(and(eq(charges.organizationId, organizationId), chargeFilter(bucket, today), byClientName(q)));
  return row?.cents ?? 0;
}

export async function chargeCount(db: DB, organizationId: string, scope: { clientId: string; state: "open" | "closed" }): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(charges)
    .where(and(eq(charges.organizationId, organizationId), eq(charges.clientId, scope.clientId), scope.state === "open" ? isOpenCharge : eq(charges.status, "paga")));
  return Number(row?.total ?? 0);
}
