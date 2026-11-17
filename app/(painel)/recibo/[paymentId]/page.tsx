import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { PrintButton } from "@/components/print-button";
import { money, secondaryButtonClass } from "@/components/ui";
import { formatDateBR } from "@/lib/dates";
import { chargeTitle } from "@/lib/labels";
import { cents, formatBRL } from "@/lib/money";
import { receiptNumber } from "@/lib/receipt";
import { itemsSummary } from "@/lib/receivables";
import { charges, clients, contracts, payments, recurrences, saleItems } from "@/lib/schema";
import { requireSession } from "@/lib/session";

type Row = [string, string];

export default async function ReciboPage({ params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await params;
  const { db, org } = await requireSession();
  const [payment] = await db.select().from(payments).where(and(eq(payments.organizationId, org.id), eq(payments.id, paymentId)));
  if (!payment) notFound();
  const [charge] = await db.select().from(charges).where(eq(charges.id, payment.chargeId));
  const [client] = charge ? await db.select().from(clients).where(eq(clients.id, charge.clientId)) : [];
  if (!charge || !client) notFound();
  const items = charge.saleId ? await db.select().from(saleItems).where(and(eq(saleItems.organizationId, org.id), eq(saleItems.saleId, charge.saleId))) : [];
  const [contract] = charge.contractId ? await db.select().from(contracts).where(eq(contracts.id, charge.contractId)) : [];
  const [recurrence] = charge.recurrenceId ? await db.select().from(recurrences).where(eq(recurrences.id, charge.recurrenceId)) : [];
  const what = itemsSummary(items) || contract?.description || recurrence?.description || "";
  const undone = Boolean(payment.reversedAt);
  const rows: Row[] = [
    ["Recebemos de", client.name],
    ...(client.document ? ([["CPF ou CNPJ", client.document]] as Row[]) : []),
    ["Referente a", `${chargeTitle(charge)}${what ? ` · ${what}` : ""}`],
    ["Valor pago", money(payment.amountCents)],
    ...(payment.feeCents > 0 ? ([["Multa e juros", money(payment.feeCents)]] as Row[]) : []),
    ["Total recebido", formatBRL(cents(payment.amountCents + payment.feeCents))],
    ["Data do pagamento", formatDateBR(payment.paidOn)],
    ["Forma de pagamento", payment.method],
  ];
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href={charge.saleId ? `/vendas/${charge.saleId}` : "/receber"} className="text-sm text-slate-500 hover:text-slate-800">
          ← Voltar
        </Link>
        <div className="flex gap-2">
          <Link href="/receber?filtro=recebidas" className={secondaryButtonClass}>
            Ver recebidas
          </Link>
          <PrintButton label="Imprimir recibo" />
        </div>
      </div>
      {undone ? <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 print:hidden">Este recebimento foi desfeito. O recibo não vale.</p> : null}
      <article className="space-y-5 rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-lg font-bold text-slate-900">{org.tradeName}</h1>
            {org.legalName && org.legalName !== org.tradeName ? <p className="text-sm text-slate-600">{org.legalName}</p> : null}
            {org.document ? <p className="text-sm text-slate-600">CNPJ {org.document}</p> : null}
            {org.address ? <p className="text-sm text-slate-600">{org.address}</p> : null}
            {org.phone ? <p className="text-sm text-slate-600">{org.phone}</p> : null}
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recibo</p>
            <p className="text-lg font-bold tabular-nums text-slate-900">{receiptNumber(payment.id)}</p>
          </div>
        </header>
        <dl className="space-y-2.5 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 border-b border-dashed border-slate-200 pb-2">
              <dt className="text-slate-500">{label}</dt>
              <dd className={`text-right font-semibold tabular-nums text-slate-900 ${label === "Total recebido" ? "text-base" : ""}`}>{value}</dd>
            </div>
          ))}
        </dl>
        <p className="pt-6 text-center text-sm text-slate-500">
          {org.tradeName}, {formatDateBR(payment.paidOn)}.
        </p>
      </article>
    </div>
  );
}
