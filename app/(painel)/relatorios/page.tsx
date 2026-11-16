import { money, Title } from "@/components/ui";
import { clientFinance, loadBook } from "@/lib/read";
import { requireSession } from "@/lib/session";

export default async function RelatoriosPage({ searchParams }: { searchParams: Promise<{ de?: string; ate?: string; cliente?: string; status?: string }> }) {
  const params = await searchParams;
  const session = await requireSession();
  const book = await loadBook(session.db, session.org.id, session.org.timezone);
  const query = new URLSearchParams();
  if (params.de) query.set("de", params.de);
  if (params.ate) query.set("ate", params.ate);
  if (params.cliente) query.set("cliente", params.cliente);
  if (params.status) query.set("status", params.status);
  const suffix = query.toString();
  const sales = book.sales.filter((sale) => {
    if (params.de && sale.soldOn < params.de) return false;
    if (params.ate && sale.soldOn > params.ate) return false;
    if (params.cliente && sale.clientId !== params.cliente) return false;
    if (params.status && sale.status !== params.status) return false;
    return sale.status !== "cancelada";
  });
  const sold = sales.reduce((sum, sale) => sum + sale.totalCents, 0);
  const ranking = book.clients
    .map((client) => ({ client, finance: clientFinance(book, client.id) }))
    .sort((a, b) => b.finance.bought - a.finance.bought)
    .slice(0, 5);
  return (
    <div className="space-y-4">
      <Title hint="O CSV e o PDF baixam as vendas filtradas desta empresa.">Relatórios</Title>
      <form className="flex flex-wrap gap-2">
        <input name="de" type="date" defaultValue={params.de} aria-label="De" className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm" />
        <input name="ate" type="date" defaultValue={params.ate} aria-label="Até" className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm" />
        <select name="cliente" defaultValue={params.cliente ?? ""} aria-label="Cliente" className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm">
          <option value="">Todos os clientes</option>
          {book.clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
        </select>
        <select name="status" defaultValue={params.status ?? ""} aria-label="Status" className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm">
          <option value="">Todos os status</option>
          <option value="aguardando">Aguardando</option>
          <option value="parcial">Parcial</option>
          <option value="paga">Paga</option>
        </select>
        <button className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-sm">Filtrar</button>
      </form>
      <div className="flex gap-3 text-sm">
        <a className="rounded-lg bg-teal-700 px-4 py-2 text-white" href={`/api/relatorios${suffix ? `?${suffix}` : ""}`}>Baixar CSV</a>
        <a className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-2" href={`/api/relatorios?formato=pdf${suffix ? `&${suffix}` : ""}`}>Baixar PDF</a>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <p className="rounded-xl border border-[#E2E8F0] bg-white p-4">Vendas filtradas {sales.length}</p>
        <p className="rounded-xl border border-[#E2E8F0] bg-white p-4">Volume {money(sold)}</p>
        <p className="rounded-xl border border-[#E2E8F0] bg-white p-4">Contratos ativos {book.contracts.filter((contract) => contract.status === "ativo").length}</p>
      </div>
      <h2 className="font-medium">Clientes com maior volume</h2>
      {ranking.map((row) => <p key={row.client.id} className="text-sm">{row.client.name} · {money(row.finance.bought)}</p>)}
    </div>
  );
}
