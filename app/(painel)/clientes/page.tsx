import Link from "next/link";
import { ClientForm } from "@/components/forms";
import { NewButton } from "@/components/new-button";
import { money, Status, Table, Title } from "@/components/ui";
import { clientFinance, loadBook } from "@/lib/read";
import { requireSession } from "@/lib/session";

export default async function ClientesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const params = await searchParams;
  const session = await requireSession();
  const book = await loadBook(session.db, session.org.id, session.org.timezone);
  const query = (params.q ?? "").toLowerCase();
  const rows = book.clients.filter((client) => !query || client.name.toLowerCase().includes(query) || client.document.includes(query));
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Title hint="Pessoa física e jurídica no mesmo cadastro.">Clientes</Title>
        <NewButton title="Novo cliente"><ClientForm /></NewButton>
      </div>
      <form>
        <input name="q" defaultValue={params.q} placeholder="Pesquisar nome ou documento" className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm md:w-80" />
      </form>
      <Table>
        <thead className="bg-slate-50 text-xs text-[#64748B]"><tr><th className="p-3">Nome</th><th>Documento</th><th>Telefone</th><th>Compras</th><th>Pago</th><th>Aberto</th></tr></thead>
        <tbody>
          {rows.map((client) => {
            const finance = clientFinance(book, client.id);
            return (
              <tr key={client.id} className="border-t border-[#E2E8F0]">
                <td className="p-3"><Link className="text-[#2563EB]" href={`/clientes/${client.id}`}>{client.name}</Link></td>
                <td>{client.document}</td>
                <td>{client.phone}</td>
                <td>{money(finance.bought)}</td>
                <td>{money(finance.paid)}</td>
                <td>{money(finance.open)} <Status value={finance.open > 0 ? "pendente" : "paga"} /></td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </div>
  );
}
