import { contractAction } from "@/app/actions";
import { money, Status, Table, Title } from "@/components/ui";
import { formatDateBR } from "@/lib/dates";
import { clientName, loadBook } from "@/lib/read";
import { requireSession } from "@/lib/session";

export default async function ContratosPage() {
  const session = await requireSession();
  const book = await loadBook(session.db, session.org.id, session.org.timezone);
  return (
    <div>
      <Title hint="O contrato nasce com a venda parcelada ou recorrente.">Contratos</Title>
      <Table>
        <thead className="bg-slate-50 text-xs text-[#64748B]"><tr><th className="p-3">Número</th><th>Cliente</th><th>Início</th><th>Total</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {book.contracts.map((contract) => (
            <tr key={contract.id} className="border-t border-[#E2E8F0]">
              <td className="p-3">{contract.number}<p className="text-xs text-[#64748B]">{contract.description}</p></td>
              <td>{clientName(book, contract.clientId)}</td>
              <td>{formatDateBR(contract.startsOn)}</td>
              <td>{money(contract.totalCents)}</td>
              <td><Status value={contract.status} /></td>
              <td className="space-x-2 p-3 text-sm">
                <form className="inline" action={async () => { "use server"; await contractAction(contract.id, "ativo"); }}><button className="text-teal-700">Ativar</button></form>
                <form className="inline" action={async () => { "use server"; await contractAction(contract.id, "suspenso"); }}><button className="text-[#F59E0B]">Suspender</button></form>
                <form className="inline" action={async () => { "use server"; await contractAction(contract.id, "encerrado"); }}><button className="text-[#EF4444]">Encerrar</button></form>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
