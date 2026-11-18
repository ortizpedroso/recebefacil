import { MoneyChart } from "@/components/charts";
import { Card, Empty, inputClass, money, Title } from "@/components/ui";
import { SALE_STATUS_FILTERS, saleStatusLabel } from "@/lib/labels";
import { clientFinance, loadBook, monthlySeries, receiptsByMethod, salesByItem } from "@/lib/read";
import { requireSession } from "@/lib/session";

const buttonLink = "rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50";

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
    .filter((row) => row.finance.bought > 0)
    .sort((a, b) => b.finance.bought - a.finance.bought)
    .slice(0, 5);
  const byMethod = receiptsByMethod(book);
  const byItem = salesByItem(book);
  const empty = book.sales.length === 0;
  return (
    <div className="space-y-4">
      <Title hint="Vendas e recebimentos da sua empresa. Dá para baixar em Excel, CSV ou PDF.">Relatórios</Title>
      {empty ? (
        <Empty title="Ainda não há o que mostrar" action={{ href: "/vendas/nova", label: "Fazer a primeira venda" }}>
          O gráfico, o ranking de clientes e os totais aparecem depois da sua primeira venda.
        </Empty>
      ) : (
        <>
          <Card>
            <h2 className="mb-3 font-bold text-slate-900">Vendido e recebido nos últimos 6 meses</h2>
            <MoneyChart rows={monthlySeries(book, book.today)} />
          </Card>
          <form className="flex flex-wrap items-end gap-2">
            <label className="text-sm font-medium text-slate-700">
              <span className="mb-1 block">De</span>
              <input name="de" type="date" defaultValue={params.de} className={inputClass} />
            </label>
            <label className="text-sm font-medium text-slate-700">
              <span className="mb-1 block">Até</span>
              <input name="ate" type="date" defaultValue={params.ate} className={inputClass} />
            </label>
            <label className="text-sm font-medium text-slate-700">
              <span className="mb-1 block">Cliente</span>
              <select name="cliente" defaultValue={params.cliente ?? ""} className={inputClass}>
                <option value="">Todos os clientes</option>
                {book.clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              <span className="mb-1 block">Situação</span>
              <select name="status" defaultValue={params.status ?? ""} className={inputClass}>
                <option value="">Todas</option>
                {SALE_STATUS_FILTERS.map((status) => (
                  <option key={status} value={status}>
                    {saleStatusLabel(status)}
                  </option>
                ))}
              </select>
            </label>
            <button className={buttonLink}>Filtrar</button>
          </form>
          <div className="flex flex-wrap gap-2">
            <a className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800" href={`/api/relatorios${suffix ? `?${suffix}` : ""}`}>
              Baixar CSV
            </a>
            <a className={buttonLink} href={`/api/relatorios?formato=pdf${suffix ? `&${suffix}` : ""}`}>
              Baixar PDF
            </a>
            <a className={buttonLink} href={`/api/relatorios?formato=xls${suffix ? `&${suffix}` : ""}`}>
              Baixar Excel
            </a>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="flex flex-col gap-1">
              <span className="text-sm font-medium text-slate-500">Vendas no filtro</span>
              <strong className="text-2xl font-bold tabular-nums">{sales.length}</strong>
            </Card>
            <Card className="flex flex-col gap-1">
              <span className="text-sm font-medium text-slate-500">Valor vendido</span>
              <strong className="text-2xl font-bold tabular-nums">{money(sold)}</strong>
            </Card>
            <Card className="flex flex-col gap-1">
              <span className="text-sm font-medium text-slate-500">Mensalidades ativas</span>
              <strong className="text-2xl font-bold tabular-nums">{book.recurrences.filter((row) => row.status === "ativa").length}</strong>
            </Card>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="space-y-2">
              <h2 className="font-bold text-slate-900">Clientes que mais compraram</h2>
              {ranking.map((row) => (
                <p key={row.client.id} className="flex justify-between gap-3 text-sm">
                  <span className="truncate">{row.client.name}</span>
                  <span className="font-semibold tabular-nums">{money(row.finance.bought)}</span>
                </p>
              ))}
            </Card>
            <Card className="space-y-2">
              <h2 className="font-bold text-slate-900">Recebido por forma</h2>
              {byMethod.length === 0 ? <p className="text-sm text-slate-500">Nenhum recebimento ainda.</p> : null}
              {byMethod.map((row) => (
                <p key={row.method} className="flex justify-between gap-3 text-sm">
                  <span>{row.method}</span>
                  <span className="font-semibold tabular-nums">{money(row.total)}</span>
                </p>
              ))}
            </Card>
            <Card className="space-y-2">
              <h2 className="font-bold text-slate-900">Mais vendidos</h2>
              {byItem.slice(0, 8).map((row) => (
                <p key={row.description} className="flex justify-between gap-3 text-sm">
                  <span className="truncate">
                    {row.description} <span className="text-slate-500">· {row.quantity}</span>
                  </span>
                  <span className="font-semibold tabular-nums">{money(row.total)}</span>
                </p>
              ))}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
