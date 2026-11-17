import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { and, eq } from "drizzle-orm";
import { CopyButton } from "@/components/copy-button";
import { ReceivableLine } from "@/components/receivable-row";
import { SaleCreatedDialog } from "@/components/sale-created-dialog";
import { SaleMenu } from "@/components/sale-menu";
import { Avatar, Card, money, Pill, ProductPhoto, secondaryButtonClass, smallButtonClass } from "@/components/ui";
import { can } from "@/lib/access";
import { formatDateBR, todayIn } from "@/lib/dates";
import { periodLabel, planLabel, saleBadge } from "@/lib/labels";
import { formatPercentBp } from "@/lib/money";
import { rowActionData, rowContext } from "@/lib/pay-link";
import { listReceivables, photoIds, saleSummaries, type ReceivableRow } from "@/lib/receivables";
import { clients, contracts, saleItems, sales } from "@/lib/schema";
import { requireSession } from "@/lib/session";

const SHORT_PLAN = 12;
const NEXT_OPEN = 8;
const LAST_PAID = 2;

type Stretch = { rows: ReceivableRow[]; hiddenBefore: number; hiddenAfter: number };

// Plano longo: as últimas recebidas e as próximas em aberto. O resto some atrás de "Ver todas".
function trimTimeline(rows: ReceivableRow[], all: boolean): Stretch {
  if (all || rows.length <= SHORT_PLAN) return { rows, hiddenBefore: 0, hiddenAfter: 0 };
  const open = rows.filter((row) => !row.closed);
  const closed = rows.filter((row) => row.closed);
  const keepClosed = closed.slice(-LAST_PAID);
  const keepOpen = open.slice(0, NEXT_OPEN);
  const keep = new Set([...keepClosed, ...keepOpen].map((row) => row.id));
  return { rows: rows.filter((row) => keep.has(row.id)), hiddenBefore: closed.length - keepClosed.length, hiddenAfter: open.length - keepOpen.length };
}

export default async function VendaPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ nova?: string; todas?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const session = await requireSession();
  const { db, org } = session;
  const today = todayIn(org.timezone);
  const [sale] = await db.select().from(sales).where(and(eq(sales.organizationId, org.id), eq(sales.id, id)));
  if (!sale) notFound();
  const [context, [client], items, [contract], photos, summaries, rows] = await Promise.all([
    rowContext(session),
    db.select().from(clients).where(eq(clients.id, sale.clientId)),
    db.select().from(saleItems).where(and(eq(saleItems.organizationId, org.id), eq(saleItems.saleId, id))),
    db.select().from(contracts).where(and(eq(contracts.organizationId, org.id), eq(contracts.saleId, id))),
    photoIds(db, org.id),
    saleSummaries(db, org.id, today, id),
    listReceivables(db, org.id, today, { lateFineBp: org.lateFineBp, lateInterestMonthlyBp: org.lateInterestMonthlyBp }, { saleId: id }),
  ]);
  const summary = summaries.get(id) ?? { receivedCents: 0, openCents: 0, openCount: 0, lateCount: 0, recurringActive: false };
  const badge = saleBadge({ status: sale.status, mode: sale.mode, openCount: summary.openCount, lateCount: summary.lateCount, recurringActive: summary.recurringActive });
  const cancelled = sale.status === "cancelada";
  const nextOpen = rows.find((row) => !row.closed);
  const share = nextOpen ? rowActionData(nextOpen, context.origin, context.company) : null;
  const lastReceipt = [...rows].reverse().find((row) => row.paymentId);
  const phone = client?.whatsapp || client?.phone || "";
  const timeline = trimTimeline(rows, query.todas === "1");
  const live = rows.filter((row) => row.badge.tone !== "muted");
  const payTotal = live.reduce((sum, row) => sum + row.amountCents, 0);
  const regular = live.filter((row) => row.title !== "Entrada");
  const monthly = sale.mode === "recorrente";
  const evenPlan = sale.interestMonthlyBp === 0 && sale.adjustYearlyBp === 0;
  const permissions = {
    edit: can(session.role, "vendas.editar"),
    delete: can(session.role, "vendas.excluir"),
    cancel: can(session.role, "vendas.cancelar"),
    contract: can(session.role, "contratos.alterar"),
    end: can(session.role, "recorrencias.alterar"),
  };
  return (
    <div className="space-y-5">
      {query.nova === "1" ? (
        <SaleCreatedDialog saleId={id} clientName={client?.name ?? "Cliente"} total={money(sale.totalCents)} link={share?.link ?? null} whatsapp={share?.whatsapp ?? null} receiptHref={lastReceipt?.paymentId ? `/recibo/${lastReceipt.paymentId}` : null} />
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href="/vendas" className="text-sm text-slate-500 hover:text-slate-800">
            ← Vendas
          </Link>
          <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
            <Avatar name={client?.name ?? "?"} className="h-10 w-10 text-sm" />
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{client?.name ?? "Cliente"}</h1>
            <Pill badge={badge} />
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Venda {sale.code} · {formatDateBR(sale.soldOn)} · {planLabel(sale)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {share ? (
            <>
              <CopyButton text={share.link} className={secondaryButtonClass} doneMessage="Link copiado">
                Copiar link de pagamento
              </CopyButton>
              {share.whatsapp ? (
                <a href={share.whatsapp} target="_blank" rel="noopener noreferrer" className={secondaryButtonClass}>
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </a>
              ) : null}
            </>
          ) : null}
          <SaleMenu saleId={id} contractId={contract?.id ?? null} cancelled={cancelled} hasReceived={summary.receivedCents > 0} subscriptionActive={monthly && summary.recurringActive} can={permissions} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-start">
        <section className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-sm">
          <h2 className="px-4 pb-1 pt-4 font-bold text-slate-900">Pagamentos</h2>
          {rows.length === 0 ? <p className="px-4 pb-4 text-sm text-slate-500">Esta venda não tem pagamentos.</p> : null}
          <div className="divide-y divide-slate-100">
            {timeline.hiddenBefore > 0 ? (
              <Link href={`/vendas/${id}?todas=1`} className="block px-4 py-2.5 text-center text-sm font-semibold text-teal-700 hover:bg-slate-50">
                {timeline.hiddenBefore} {timeline.hiddenBefore === 1 ? "pagamento recebido antes" : "pagamentos recebidos antes"}. Ver todos
              </Link>
            ) : null}
            {timeline.rows.map((row) => (
              <ReceivableLine key={row.id} row={row} context={context} subject="payment" />
            ))}
            {timeline.hiddenAfter > 0 ? (
              <Link href={`/vendas/${id}?todas=1`} className="block px-4 py-2.5 text-center text-sm font-semibold text-teal-700 hover:bg-slate-50">
                Mais {timeline.hiddenAfter} {timeline.hiddenAfter === 1 ? "pagamento depois" : "pagamentos depois"}. Ver todos
              </Link>
            ) : null}
            {query.todas === "1" && rows.length > SHORT_PLAN ? (
              <Link href={`/vendas/${id}`} className="block px-4 py-2.5 text-center text-sm font-semibold text-teal-700 hover:bg-slate-50">
                Mostrar só os próximos
              </Link>
            ) : null}
          </div>
        </section>

        <aside className="space-y-4">
          <Card className="space-y-3">
            <h2 className="font-bold text-slate-900">O que foi vendido</h2>
            <ul className="space-y-2.5">
              {items.map((item) => (
                <li key={item.id} className="flex items-center gap-3">
                  <span className="h-12 w-12 shrink-0 overflow-hidden rounded-lg">
                    <ProductPhoto name={item.description} photoId={item.catalogItemId ? photos.get(item.catalogItemId) : null} className="h-12 w-12 text-base" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-slate-900">{item.description}</span>
                    <span className="block text-[13px] tabular-nums text-slate-500">
                      {item.quantity} × {money(item.unitCents)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <dl className="space-y-1 border-t border-slate-100 pt-3 text-sm tabular-nums">
              {sale.discountCents > 0 ? (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Desconto</dt>
                  <dd className="font-semibold">{money(sale.discountCents)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between">
                <dt className="text-slate-500">{monthly ? "Valor da mensalidade" : "Total"}</dt>
                <dd className="font-semibold">{money(sale.totalCents)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Recebido</dt>
                <dd className="font-semibold text-emerald-700">{money(summary.receivedCents)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Falta</dt>
                <dd className="font-semibold">{money(summary.openCents)}</dd>
              </div>
            </dl>
          </Card>

          <Card className="space-y-1.5 text-sm">
            <h2 className="font-bold text-slate-900">Como foi combinado</h2>
            {sale.mode === "avista" ? <p>Pagamento à vista.</p> : null}
            {sale.mode === "parcelado" ? (
              <>
                {sale.entryCents > 0 ? <p>Entrada de {money(sale.entryCents)}.</p> : null}
                <p>
                  {sale.installmentCount ?? regular.length} parcelas, {evenPlan ? "de " : "a primeira de "}
                  {money((evenPlan ? regular.at(-1) : regular[0])?.amountCents ?? 0)}.
                </p>
                <p className="text-slate-500">1º vencimento em {formatDateBR(regular[0]?.dueOn ?? sale.soldOn)}.</p>
                {sale.interestMonthlyBp > 0 ? <p>Juros de {formatPercentBp(sale.interestMonthlyBp)}% ao mês (Tabela Price).</p> : null}
                {sale.adjustYearlyBp > 0 ? <p>Reajuste de {formatPercentBp(sale.adjustYearlyBp)}% ao ano.</p> : null}
                {payTotal !== sale.totalCents ? <p className="font-semibold">Total a pagar: {money(payTotal)}.</p> : null}
              </>
            ) : null}
            {monthly ? (
              <>
                <p>{periodLabel(sale.periodicity ?? "mensal")}, {money(sale.totalCents)}.</p>
                <p className="text-slate-500">{summary.recurringActive ? "Mensalidade ativa." : "Mensalidade encerrada."}</p>
              </>
            ) : null}
            {contract ? (
              <p>
                <Link href={`/contratos/${contract.id}/imprimir`} className="font-semibold text-teal-700 hover:underline">
                  Ver contrato {contract.number}
                </Link>
              </p>
            ) : null}
          </Card>

          <Card className="space-y-1 text-sm">
            <h2 className="font-bold text-slate-900">Cliente</h2>
            <p className="font-semibold">{client?.name}</p>
            <p className="text-slate-500">{phone || "Sem telefone cadastrado"}</p>
            {client ? (
              <Link href={`/clientes/${client.id}`} className={`${smallButtonClass} mt-1`}>
                Abrir o cliente
              </Link>
            ) : null}
          </Card>
        </aside>
      </div>
    </div>
  );
}
