import Link from "next/link";
import { cancelSaleAction } from "@/app/actions";
import { buttonClass, money, Status, Table, Title } from "@/components/ui";
import { formatDateBR } from "@/lib/dates";
import { clientName, loadBook } from "@/lib/read";
import { requireSession } from "@/lib/session";

export default async function VendasPage() {
  const session = await requireSession();
  const book = await loadBook(session.db, session.org.id, session.org.timezone);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Title hint="À vista, parcelado ou recorrente.">Vendas</Title>
        <Link href="/vendas/nova" className={buttonClass}>Nova venda</Link>
      </div>
      <Table>
        <thead className="bg-slate-50 text-xs text-[#64748B]"><tr><th className="p-3">Código</th><th>Cliente</th><th>Data</th><th>Total</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {book.sales.map((sale) => (
            <tr key={sale.id} className="border-t border-[#E2E8F0]">
              <td className="p-3">{sale.code}</td>
              <td>{clientName(book, sale.clientId)}</td>
              <td>{formatDateBR(sale.soldOn)}</td>
              <td>{money(sale.totalCents)}</td>
              <td><Status value={sale.status} /></td>
              <td className="p-3">
                {sale.status !== "cancelada" && sale.status !== "paga" ? (
                  <form action={async () => { "use server"; await cancelSaleAction(sale.id); }}>
                    <button className="text-sm text-[#EF4444]">Cancelar</button>
                  </form>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
