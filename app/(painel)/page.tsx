import Link from "next/link";
import { MoneyChart } from "@/components/charts";
import { Card, money, Title } from "@/components/ui";
import { formatDateBR } from "@/lib/dates";
import { clientName, dashboard, loadBook, periodRange } from "@/lib/read";
import { requireSession } from "@/lib/session";

const filters = [
  ["hoje", "Hoje"],
  ["7", "7 dias"],
  ["30", "30 dias"],
  ["mes", "Este mês"],
  ["anterior", "Mês anterior"],
  ["ano", "Este ano"],
];

export default async function VisaoGeralPage({ searchParams }: { searchParams: Promise<{ periodo?: string; de?: string; ate?: string }> }) {
  const params = await searchParams;
  const session = await requireSession();
  const book = await loadBook(session.db, session.org.id, session.org.timezone);
  const range = periodRange(params.periodo ?? "mes", book.today, params.de, params.ate);
  const data = dashboard(book, range.from, range.to);
  const cards = [
    ["Vendido", data.sold],
    ["Recebido", data.received],
    ["A receber", data.open],
    ["Em atraso", data.late],
  ];
  return (
    <div>
      <Title hint="Os números usam o mesmo período e a mesma soma das parcelas.">Visão geral</Title>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        {filters.map(([id, label]) => (
          <Link key={id} href={`/?periodo=${id}`} className="rounded-full border border-[#E2E8F0] bg-white px-3 py-1">{label}</Link>
        ))}
        <form action="/" className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="periodo" value="personalizado" />
          <input name="de" type="date" defaultValue={params.de} aria-label="De" className="rounded-lg border border-[#E2E8F0] px-2 py-1" />
          <input name="ate" type="date" defaultValue={params.ate} aria-label="Até" className="rounded-lg border border-[#E2E8F0] px-2 py-1" />
          <button className="rounded-full border border-[#E2E8F0] bg-white px-3 py-1">Personalizado</button>
        </form>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value]) => (
          <Card key={String(label)}>
            <p className="text-xs text-[#64748B]">{label}</p>
            <p className="mt-2 text-xl font-semibold">{money(Number(value))}</p>
          </Card>
        ))}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Card><p className="text-xs text-[#64748B]">Vendas no período</p><p className="text-xl font-semibold">{data.salesCount}</p></Card>
        <Card><p className="text-xs text-[#64748B]">Contratos ativos</p><p className="text-xl font-semibold">{data.activeContracts}</p></Card>
        <Card><p className="text-xs text-[#64748B]">Recorrências ativas</p><p className="text-xl font-semibold">{data.activeRecurrences}</p></Card>
      </div>
      <Card className="mt-4">
        <p className="mb-3 text-sm font-medium">Vendas e recebimentos</p>
        <MoneyChart rows={data.months} />
      </Card>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <p className="mb-2 font-medium">Próximos vencimentos</p>
          {data.nextDues.map((row) => <p key={row.id} className="text-sm text-[#64748B]">{formatDateBR(row.dueOn)} · {money(row.amountCents - row.paidCents)}</p>)}
        </Card>
        <Card>
          <p className="mb-2 font-medium">Últimas vendas</p>
          {data.recentSales.map((sale) => <p key={sale.id} className="text-sm text-[#64748B]">{sale.code} · {clientName(book, sale.clientId)} · {money(sale.totalCents)}</p>)}
        </Card>
        <Card>
          <p className="mb-2 font-medium">Atalhos</p>
          <div className="flex flex-col gap-2 text-sm">
            <Link className="text-[#2563EB]" href="/clientes">Cadastrar cliente</Link>
            <Link className="text-[#2563EB]" href="/vendas/nova">Registrar venda</Link>
            <Link className="text-[#2563EB]" href="/cobrancas">Ver cobranças</Link>
          </div>
          <p className="mt-3 text-xs text-[#64748B]">Cobranças por status: {data.statusCount.filter((row) => row.total > 0).map((row) => `${row.status} ${row.total}`).join(", ")}</p>
        </Card>
      </div>
    </div>
  );
}
