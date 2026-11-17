import Link from "next/link";
import { deleteSaleAction } from "@/app/actions";
import { ConfirmAction } from "@/components/confirm-action";
import { buttonClass, money, Status, Table, Title } from "@/components/ui";
import { formatDateBR } from "@/lib/dates";
import { clientName, loadBook, saleBalance } from "@/lib/read";
import { requireSession } from "@/lib/session";

export default async function VendasPage() {
  const session = await requireSession();
  const book = await loadBook(session.db, session.org.id, session.org.timezone);
  const balances = new Map(book.sales.map((sale) => [sale.id, saleBalance(book, sale.id)]));
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Title hint="À vista, parcelado ou recorrente.">Vendas</Title>
        <Link href="/vendas/nova" className={buttonClass}>Nova venda</Link>
      </div>
      <Table>
        <thead className="bg-slate-50 text-xs text-[#64748B]"><tr><th className="p-3">Código</th><th>Cliente</th><th>Data</th><th>Total</th><th>Recebido</th><th>Saldo</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {book.sales.map((sale) => (
            <tr key={sale.id} className="border-t border-[#E2E8F0]">
              <td className="p-3">{sale.code}</td>
              <td>{clientName(book, sale.clientId)}</td>
              <td>{formatDateBR(sale.soldOn)}</td>
              <td>{money(sale.totalCents)}</td>
              <td>{money(balances.get(sale.id)?.received ?? 0)}</td>
              <td>{money(balances.get(sale.id)?.open ?? 0)}</td>
              <td><Status value={sale.status} /></td>
              <td className="p-3">
                <div className="flex items-center gap-3">
                  {sale.status === "aguardando" ? (
                    <Link href={`/vendas/${sale.id}/editar`} className="text-sm text-teal-700">Editar</Link>
                  ) : null}
                  {sale.status === "aguardando" ? (
                    <ConfirmAction
                      label="Excluir"
                      confirmLabel="Excluir venda"
                      message="A venda e todas as parcelas, cobranças e o contrato serão apagados. Esta ação não pode ser desfeita."
                      action={deleteSaleAction.bind(null, sale.id)}
                      className="text-sm text-[#EF4444]"
                      danger
                    />
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
