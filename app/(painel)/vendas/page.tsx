import Link from "next/link";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { Avatar, buttonClass, Empty, money, Pill, Title } from "@/components/ui";
import { formatDateBR, todayIn } from "@/lib/dates";
import { planLabel, saleBadge } from "@/lib/labels";
import { itemsSummary, saleSummaries } from "@/lib/receivables";
import { clients, saleItems, sales } from "@/lib/schema";
import { requireSession } from "@/lib/session";

const PAGE = 30;

export default async function VendasPage({ searchParams }: { searchParams: Promise<{ mostrar?: string }> }) {
  const params = await searchParams;
  const { db, org } = await requireSession();
  const today = todayIn(org.timezone);
  const limit = Math.min(Math.max(Number(params.mostrar) || PAGE, PAGE), 600);
  const [rows, [totalRow], summaries] = await Promise.all([
    db
      .select({ sale: sales, clientName: clients.name })
      .from(sales)
      .innerJoin(clients, eq(clients.id, sales.clientId))
      .where(eq(sales.organizationId, org.id))
      .orderBy(desc(sales.soldOn), desc(sales.createdAt))
      .limit(limit),
    db.select({ total: count() }).from(sales).where(eq(sales.organizationId, org.id)),
    saleSummaries(db, org.id, today),
  ]);
  const total = Number(totalRow?.total ?? 0);
  const items = rows.length ? await db.select().from(saleItems).where(and(eq(saleItems.organizationId, org.id), inArray(saleItems.saleId, rows.map((row) => row.sale.id)))) : [];
  const bySale = new Map<string, { description: string; quantity: number }[]>();
  for (const item of items) bySale.set(item.saleId, [...(bySale.get(item.saleId) ?? []), item]);
  return (
    <div className="space-y-4">
      <Title hint={total === 0 ? "Nenhuma venda ainda." : `${total} venda${total === 1 ? "" : "s"}`} action={<Link href="/vendas/nova" className={buttonClass}>+ Nova venda</Link>}>
        Vendas
      </Title>
      {rows.length === 0 ? (
        <Empty title="Você ainda não fez nenhuma venda" action={{ href: "/vendas/nova", label: "Fazer a primeira venda" }}>
          Cada venda mostra o cliente, o que foi vendido, quanto já foi pago e quanto falta.
        </Empty>
      ) : (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-sm">
          {rows.map(({ sale, clientName }) => {
            const summary = summaries.get(sale.id) ?? { receivedCents: 0, openCents: 0, openCount: 0, lateCount: 0, recurringActive: false };
            const badge = saleBadge({ status: sale.status, mode: sale.mode, openCount: summary.openCount, lateCount: summary.lateCount, recurringActive: summary.recurringActive });
            return (
              <Link key={sale.id} href={`/vendas/${sale.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 hover:bg-slate-50 sm:flex-nowrap">
                <Avatar name={clientName} className="h-9 w-9 text-xs sm:h-10 sm:w-10 sm:text-sm" />
                <div className="min-w-0 flex-1 basis-[calc(100%-3.5rem)] sm:basis-auto">
                  <span className="block truncate font-semibold text-slate-900">{clientName}</span>
                  <span className="block truncate text-[13px] text-slate-500">
                    {sale.code} · {formatDateBR(sale.soldOn)} · {planLabel(sale)} · {itemsSummary(bySale.get(sale.id) ?? [])}
                  </span>
                </div>
                <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto sm:flex-nowrap sm:justify-end sm:gap-3">
                  <Pill badge={badge} />
                  <span className="min-w-24 text-right text-sm font-semibold tabular-nums text-slate-900">{money(sale.totalCents)}</span>
                  <span className="min-w-28 text-right text-[13px] tabular-nums text-slate-500">recebido {money(summary.receivedCents)}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
      {total > rows.length ? (
        <div className="flex flex-col items-center gap-1 pt-1">
          <p className="text-sm text-slate-500">
            Mostrando {rows.length} de {total}
          </p>
          <Link href={`/vendas?mostrar=${limit + PAGE}`} scroll={false} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">
            Carregar mais
          </Link>
        </div>
      ) : null}
    </div>
  );
}
