import Link from "next/link";
import { contractAction } from "@/app/actions";
import { ConfirmAction } from "@/components/confirm-action";
import { NewButton } from "@/components/new-button";
import { ContractForm } from "@/components/forms";
import { money, Status, Table, Title } from "@/components/ui";
import { formatDateBR } from "@/lib/dates";
import { clientName, loadBook } from "@/lib/read";
import { requireSession } from "@/lib/session";

export default async function ContratosPage() {
  const session = await requireSession();
  const book = await loadBook(session.db, session.org.id, session.org.timezone);
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <Title hint="Crie um contrato avulso ou acompanhe os que nasceram de venda.">Contratos</Title>
        <NewButton title="Novo contrato"><ContractForm clients={book.clients.filter((client) => client.active).map((client) => ({ id: client.id, name: client.name }))} today={book.today} /></NewButton>
      </div>
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
              <td className="p-3 text-sm">
                <div className="flex items-center gap-3">
                  <Link href={`/contratos/${contract.id}/editar`} className="text-teal-700">Editar</Link>
                  <ConfirmAction label="Ativar" confirmLabel="Ativar contrato" message="O contrato voltará a ficar ativo." action={contractAction.bind(null, contract.id, "ativo")} className="text-teal-700" />
                  <ConfirmAction label="Suspender" confirmLabel="Suspender contrato" message="O contrato ficará suspenso." action={contractAction.bind(null, contract.id, "suspenso")} className="text-[#F59E0B]" />
                  <ConfirmAction label="Encerrar" confirmLabel="Encerrar contrato" message="O contrato será encerrado." action={contractAction.bind(null, contract.id, "encerrado")} className="text-[#EF4444]" danger />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
