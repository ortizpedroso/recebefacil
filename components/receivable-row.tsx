import Link from "next/link";
import { formatDateBR } from "@/lib/dates";
import { rowActionData, type RowContext } from "@/lib/pay-link";
import type { ReceivableRow } from "@/lib/receivables";
import { RowActions } from "./row-actions";
import { Avatar, money, Pill } from "./ui";

// Uma linha serve ao Início, a A receber, ao cliente e a venda: o que muda é o assunto da linha.
export function ReceivableLine({ row, context, subject = "client", showWhat = false }: { row: ReceivableRow; context: RowContext; subject?: "client" | "payment"; showWhat?: boolean }) {
  const data = rowActionData(row, context.origin, context.company);
  const target = row.saleId ? `/vendas/${row.saleId}` : `/clientes/${row.clientId}`;
  const cancelled = row.badge.tone === "muted";
  const when = row.badge.tone === "paid" ? `Recebida em ${formatDateBR(row.paidOn ?? row.dueOn)}` : `Vence em ${formatDateBR(row.dueOn)}`;
  const amount = row.closed ? row.amountCents : row.openCents;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:flex-nowrap">
      {subject === "client" ? <Avatar name={row.clientName} className="h-9 w-9 text-xs sm:h-10 sm:w-10 sm:text-sm" /> : null}
      <div className="min-w-0 flex-1 basis-[calc(100%-3.5rem)] sm:basis-auto">
        {subject === "client" ? (
          <>
            <Link href={target} className="block truncate font-semibold text-slate-900 hover:text-teal-700">
              {row.clientName}
            </Link>
            <span className="block truncate text-[13px] text-slate-500">
              {row.title}
              {row.what ? ` · ${row.what}` : ""}
            </span>
          </>
        ) : (
          <>
            <span className="block truncate font-semibold text-slate-900">{row.title}</span>
            <span className="block truncate text-[13px] text-slate-500">
              {when}
              {showWhat && row.what ? ` · ${row.what}` : ""}
            </span>
          </>
        )}
      </div>
      <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto sm:flex-nowrap sm:justify-end">
        <Pill badge={row.badge} />
        <span className={`min-w-24 text-right text-sm font-semibold tabular-nums ${cancelled ? "text-slate-400 line-through" : "text-slate-900"}`}>{money(amount)}</span>
        {cancelled ? null : <RowActions data={data} today={context.today} perms={{ canPay: context.canPay, canUndo: context.canUndo }} />}
      </div>
    </div>
  );
}

export function ReceivableList({ rows, context, subject, showWhat, empty }: { rows: ReceivableRow[]; context: RowContext; subject?: "client" | "payment"; showWhat?: boolean; empty: React.ReactNode }) {
  if (rows.length === 0) return <>{empty}</>;
  return (
    <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-sm">
      {rows.map((row) => (
        <ReceivableLine key={row.id} row={row} context={context} subject={subject} showWhat={showWhat} />
      ))}
    </div>
  );
}
