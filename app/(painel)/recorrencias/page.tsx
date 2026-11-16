import { recurrenceAction } from "@/app/actions";
import { money, Status, Table, Title } from "@/components/ui";
import { formatDateBR } from "@/lib/dates";
import { clientName, loadBook } from "@/lib/read";
import { requireSession } from "@/lib/session";

export default async function RecorrenciasPage() {
  const session = await requireSession();
  const book = await loadBook(session.db, session.org.id, session.org.timezone);
  return (
    <div>
      <Title hint="Recorrência continua enquanto o serviço está ativo. Parcelamento tem quantidade fechada.">Recorrências</Title>
      <Table>
        <thead className="bg-slate-50 text-xs text-[#64748B]"><tr><th className="p-3">Serviço</th><th>Cliente</th><th>Valor</th><th>Próxima</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {book.recurrences.map((row) => (
            <tr key={row.id} className="border-t border-[#E2E8F0]">
              <td className="p-3">{row.description}<p className="text-xs text-[#64748B]">{row.periodicity}</p></td>
              <td>{clientName(book, row.clientId)}</td>
              <td>{money(row.amountCents)}</td>
              <td>{formatDateBR(row.nextOn)}</td>
              <td><Status value={row.status} /></td>
              <td className="space-x-2 p-3 text-sm">
                <form className="inline" action={async () => { "use server"; await recurrenceAction(row.id, "suspensa"); }}><button className="text-[#F59E0B]">Suspender</button></form>
                <form className="inline" action={async () => { "use server"; await recurrenceAction(row.id, "ativa"); }}><button className="text-[#10B981]">Retomar</button></form>
                <form className="inline" action={async () => { "use server"; await recurrenceAction(row.id, "cancelada"); }}><button className="text-[#EF4444]">Cancelar</button></form>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
