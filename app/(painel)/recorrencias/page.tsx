import Link from "next/link";
import { recurrenceAction } from "@/app/actions";
import { ConfirmAction } from "@/components/confirm-action";
import { NewButton } from "@/components/new-button";
import { RecurrenceForm } from "@/components/forms";
import { money, Status, Table, Title } from "@/components/ui";
import { formatDateBR } from "@/lib/dates";
import { clientName, loadBook } from "@/lib/read";
import { requireSession } from "@/lib/session";

export default async function RecorrenciasPage() {
  const session = await requireSession();
  const book = await loadBook(session.db, session.org.id, session.org.timezone);
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <Title hint="Crie uma recorrência avulsa ou acompanhe as que nasceram de venda.">Recorrências</Title>
        <NewButton title="Nova recorrência"><RecurrenceForm clients={book.clients.filter((client) => client.active).map((client) => ({ id: client.id, name: client.name }))} today={book.today} /></NewButton>
      </div>
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
              <td className="p-3 text-sm">
                <div className="flex items-center gap-3">
                  <Link href={`/recorrencias/${row.id}/editar`} className="text-teal-700">Editar</Link>
                  <ConfirmAction label="Suspender" confirmLabel="Suspender recorrência" message="A recorrência ficará suspensa." action={recurrenceAction.bind(null, row.id, "suspensa")} className="text-[#F59E0B]" />
                  <ConfirmAction label="Retomar" confirmLabel="Retomar recorrência" message="A recorrência voltará a ficar ativa." action={recurrenceAction.bind(null, row.id, "ativa")} className="text-[#10B981]" />
                  <ConfirmAction label="Cancelar" confirmLabel="Cancelar recorrência" message="A recorrência será cancelada." action={recurrenceAction.bind(null, row.id, "cancelada")} className="text-[#EF4444]" danger />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
