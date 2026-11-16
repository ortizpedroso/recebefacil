import Link from "next/link";
import { notFound } from "next/navigation";
import { ClientForm } from "@/components/forms";
import { Card, money, Status, Table, Title } from "@/components/ui";
import { formatDateBR } from "@/lib/dates";
import { clientFinance, displayStatus, loadBook } from "@/lib/read";
import { requireSession } from "@/lib/session";

export default async function ClientePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ aba?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const tab = query.aba || "dados";
  const session = await requireSession();
  const book = await loadBook(session.db, session.org.id, session.org.timezone);
  const client = book.clients.find((row) => row.id === id);
  if (!client) notFound();
  const finance = clientFinance(book, id);
  const ownSales = book.sales.filter((sale) => sale.clientId === id);
  const ownInstallments = book.installments.filter((row) => row.clientId === id);
  const ownCharges = book.charges.filter((row) => row.clientId === id);
  const ownContracts = book.contracts.filter((row) => row.clientId === id);
  const ownContacts = book.contacts.filter((row) => row.clientId === id);
  const tabs = [
    ["dados", "Dados"],
    ["resumo", "Resumo"],
    ["vendas", "Vendas"],
    ["contratos", "Contratos"],
    ["parcelas", "Parcelas"],
    ["cobrancas", "Cobranças"],
    ["historico", "Histórico"],
  ];
  return (
    <div className="space-y-4">
      <Link href="/clientes" className="text-sm text-[#2563EB]">Voltar</Link>
      <Title hint={`${client.kind === "pj" ? "Pessoa jurídica" : "Pessoa física"} · ${client.city} ${client.state}`}>
        {client.name}
      </Title>
      <div className="flex flex-wrap gap-2 text-sm">
        {tabs.map(([idTab, label]) => (
          <Link key={idTab} href={`/clientes/${id}?aba=${idTab}`} className={`rounded-full px-3 py-1 ${tab === idTab ? "bg-[#2563EB] text-white" : "border border-[#E2E8F0] bg-white"}`}>{label}</Link>
        ))}
      </div>
      {tab === "dados" ? (
        <Card>
          <ClientForm
            clientId={client.id}
            initial={{
              kind: client.kind === "pj" ? "pj" : "pf",
              name: client.name,
              document: client.document,
              email: client.email,
              phone: client.phone,
              whatsapp: client.whatsapp,
              zip: client.zip,
              state: client.state,
              city: client.city,
              district: client.district,
              street: client.street,
              number: client.number,
              complement: client.complement,
              notes: client.notes,
            }}
          />
        </Card>
      ) : null}
      {tab === "resumo" ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <p className="rounded-xl border border-[#E2E8F0] bg-white p-4">Comprado {money(finance.bought)}</p>
          <p className="rounded-xl border border-[#E2E8F0] bg-white p-4">Pago {money(finance.paid)}</p>
          <p className="rounded-xl border border-[#E2E8F0] bg-white p-4">Aberto {money(finance.open)}</p>
        </div>
      ) : null}
      {tab === "vendas" ? ownSales.map((sale) => <p key={sale.id} className="text-sm">{sale.code} · {money(sale.totalCents)} · <Status value={sale.status} /></p>) : null}
      {tab === "contratos" ? ownContracts.map((contract) => <p key={contract.id} className="text-sm">{contract.number} · {money(contract.totalCents)} · <Status value={contract.status} /></p>) : null}
      {tab === "parcelas" ? (
        <Table>
          <tbody>
            {ownInstallments.map((row) => (
              <tr key={row.id} className="border-t border-[#E2E8F0]">
                <td className="p-2">{row.label}</td>
                <td>{formatDateBR(row.dueOn)}</td>
                <td>{money(row.amountCents)}</td>
                <td><Status value={displayStatus(row.status, row.dueOn, book.today, row.paidCents, row.amountCents)} /></td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : null}
      {tab === "cobrancas" ? ownCharges.map((charge) => <p key={charge.id} className="text-sm">{charge.code} · {money(charge.amountCents - charge.paidCents)} em aberto</p>) : null}
      {tab === "historico" ? ownContacts.map((contact) => <p key={contact.id} className="text-sm">{contact.summary}</p>) : null}
      {tab === "historico" && ownContacts.length === 0 ? <p className="text-sm text-[#64748B]">Nenhum contato registrado.</p> : null}
    </div>
  );
}
