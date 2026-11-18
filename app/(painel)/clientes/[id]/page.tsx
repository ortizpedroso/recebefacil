import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { and, desc, eq, inArray } from "drizzle-orm";
import { EditClientButton } from "@/components/client-dialog";
import { ClientPrivacyActions } from "@/components/client-privacy";
import { ReceivableList } from "@/components/receivable-row";
import { Avatar, buttonClass, Card, Empty, money, Pill, smallButtonClass } from "@/components/ui";
import { formatDateBR, todayIn, whatsAppHref } from "@/lib/dates";
import { planLabel, saleBadge } from "@/lib/labels";
import { firstName } from "@/lib/messages";
import { rowContext } from "@/lib/pay-link";
import { chargeCount, clientSummaries, itemsSummary, listReceivables, saleSummaries } from "@/lib/receivables";
import { clients, saleItems, sales } from "@/lib/schema";
import { requireSession } from "@/lib/session";
import { allowedInDemo, can } from "@/lib/access";

const OPEN_PAGE = 15;
const DONE_PAGE = 5;

export default async function ClientePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ abertas?: string; recebidas?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const session = await requireSession();
  const { db, org } = session;
  const today = todayIn(org.timezone);
  const [client] = await db.select().from(clients).where(and(eq(clients.organizationId, org.id), eq(clients.id, id)));
  if (!client) notFound();
  const openLimit = Math.min(Math.max(Number(query.abertas) || OPEN_PAGE, OPEN_PAGE), 400);
  const doneLimit = Math.min(Math.max(Number(query.recebidas) || DONE_PAGE, DONE_PAGE), 400);
  const settings = { lateFineBp: org.lateFineBp, lateInterestMonthlyBp: org.lateInterestMonthlyBp };
  const [context, saleRows, openRows, doneRows, openTotal, doneTotal, summaries, people] = await Promise.all([
    rowContext(session),
    db.select().from(sales).where(and(eq(sales.organizationId, org.id), eq(sales.clientId, id))).orderBy(desc(sales.soldOn), desc(sales.createdAt)),
    listReceivables(db, org.id, today, settings, { clientId: id, state: "open", limit: openLimit }),
    listReceivables(db, org.id, today, settings, { clientId: id, state: "closed", limit: doneLimit }),
    chargeCount(db, org.id, { clientId: id, state: "open" }),
    chargeCount(db, org.id, { clientId: id, state: "closed" }),
    saleSummaries(db, org.id, today),
    clientSummaries(db, org.id, today),
  ]);
  const items = saleRows.length ? await db.select().from(saleItems).where(and(eq(saleItems.organizationId, org.id), inArray(saleItems.saleId, saleRows.map((sale) => sale.id)))) : [];
  const bySale = new Map<string, { description: string; quantity: number }[]>();
  for (const item of items) bySale.set(item.saleId, [...(bySale.get(item.saleId) ?? []), item]);
  const live = saleRows.filter((sale) => sale.status !== "cancelada");
  const bought = live.reduce((sum, sale) => sum + sale.totalCents, 0);
  const own = people.get(id) ?? { openCents: 0, lateCount: 0, paidCents: 0 };
  const paid = own.paidCents;
  const owed = own.openCents;
  const phone = client.whatsapp || client.phone;
  const whatsapp = phone.replace(/\D/g, "").length >= 10 ? whatsAppHref(phone, `Olá, ${firstName(client.name)}!`) : null;
  const more = (field: "abertas" | "recebidas", value: number) => {
    const next = new URLSearchParams({ ...(query.abertas ? { abertas: query.abertas } : {}), ...(query.recebidas ? { recebidas: query.recebidas } : {}), [field]: String(value) });
    return `/clientes/${id}?${next.toString()}`;
  };
  const place = [client.city, client.state].filter(Boolean).join(" - ");
  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <Link href="/clientes" className="text-sm text-slate-500 hover:text-slate-800">
          ← Clientes
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={client.name} className="h-12 w-12 text-base" />
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{client.name}</h1>
              <p className="truncate text-sm text-slate-500">{[phone || "Sem telefone", client.email, client.document, place].filter(Boolean).join(" · ")}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/vendas/nova?cliente=${client.id}`} className={buttonClass}>
              + Nova venda
            </Link>
            {whatsapp ? (
              <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={smallButtonClass}>
                <MessageCircle className="h-3.5 w-3.5" />
                WhatsApp
              </a>
            ) : null}
            <EditClientButton
              client={{ id: client.id, name: client.name, whatsapp: client.whatsapp || client.phone, document: client.document, email: client.email, zip: client.zip, state: client.state, city: client.city, district: client.district, street: client.street, number: client.number, complement: client.complement, notes: client.notes }}
            />
            {can(session.role, "clientes.dados") && (!session.publicDemo || allowedInDemo("clientes.dados")) ? <ClientPrivacyActions clientId={client.id} clientName={client.name} /> : null}
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Comprou", money(bought), ""],
          ["Pagou", money(paid), "text-emerald-700"],
          ["Deve", money(owed), owed > 0 ? "text-rose-700" : ""],
        ].map(([label, value, tone]) => (
          <Card key={label} className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-500">{label}</span>
            <strong className={`text-2xl font-bold tabular-nums ${tone}`}>{value}</strong>
          </Card>
        ))}
      </div>

      {client.notes ? <p className="rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-700">{client.notes}</p> : null}

      <section className="space-y-2.5">
        <h2 className="text-[17px] font-bold text-slate-900">Compras</h2>
        {saleRows.length === 0 ? (
          <Empty action={{ href: `/vendas/nova?cliente=${client.id}`, label: "Fazer a primeira venda" }}>As compras deste cliente aparecem aqui.</Empty>
        ) : (
          <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-sm">
            {saleRows.map((sale) => {
              const summary = summaries.get(sale.id) ?? { receivedCents: 0, openCents: 0, openCount: 0, lateCount: 0, recurringActive: false };
              const badge = saleBadge({ status: sale.status, mode: sale.mode, openCount: summary.openCount, lateCount: summary.lateCount, recurringActive: summary.recurringActive });
              return (
                <Link key={sale.id} href={`/vendas/${sale.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 hover:bg-slate-50 sm:flex-nowrap">
                  <div className="min-w-0 flex-1 basis-full sm:basis-auto">
                    <span className="block truncate font-semibold text-slate-900">{itemsSummary(bySale.get(sale.id) ?? []) || sale.code}</span>
                    <span className="block truncate text-[13px] text-slate-500">
                      {sale.code} · {formatDateBR(sale.soldOn)} · {planLabel(sale)}
                    </span>
                  </div>
                  <Pill badge={badge} />
                  <span className="min-w-24 text-right text-sm font-semibold tabular-nums text-slate-900">{money(sale.totalCents)}</span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-2.5">
        <h2 className="text-[17px] font-bold text-slate-900">Pagamentos</h2>
        <h3 className="text-sm font-semibold text-slate-500">Em aberto ({openTotal})</h3>
        <ReceivableList rows={openRows} context={context} subject="payment" showWhat empty={<Empty>Nada em aberto para este cliente.</Empty>} />
        {openTotal > openRows.length ? (
          <div className="flex justify-center">
            <Link href={more("abertas", openLimit + OPEN_PAGE)} scroll={false} className={smallButtonClass}>
              Carregar mais ({openTotal - openRows.length} restantes)
            </Link>
          </div>
        ) : null}
        <h3 className="pt-2 text-sm font-semibold text-slate-500">Recebidos ({doneTotal})</h3>
        <ReceivableList rows={doneRows} context={context} subject="payment" showWhat empty={<Empty>Os pagamentos recebidos aparecem aqui.</Empty>} />
        {doneTotal > doneRows.length ? (
          <div className="flex justify-center">
            <Link href={more("recebidas", doneLimit + DONE_PAGE * 4)} scroll={false} className={smallButtonClass}>
              Ver mais recebidos
            </Link>
          </div>
        ) : null}
      </section>
    </div>
  );
}
