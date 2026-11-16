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
        <thead className="bg-slate-50 text-xs text-[#64748B]"><tr><th className="p-3">Número</th><th>Cliente</th><th>Início</th><th>Total</th><th>Status</th></tr></thead>
        <tbody>
          {book.contracts.map((contract) => (
            <tr key={contract.id} className="border-t border-[#E2E8F0]">
              <td className="p-3">{contract.number}<p className="text-xs text-[#64748B]">{contract.description}</p></td>
              <td>{clientName(book, contract.clientId)}</td>
              <td>{formatDateBR(contract.startsOn)}</td>
              <td>{money(contract.totalCents)}</td>
              <td><Status value={contract.status} /></td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
