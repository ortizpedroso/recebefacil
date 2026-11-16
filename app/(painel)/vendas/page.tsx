import Link from "next/link";
import { money, Status, Table, Title } from "@/components/ui";
import { clientName, loadBook } from "@/lib/read";
import { requireSession } from "@/lib/session";

export default async function VendasPage() {
  const session = await requireSession();
  const book = await loadBook(session.db, session.org.id, session.org.timezone);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Title hint="À vista, parcelado ou recorrente.">Vendas</Title>
        <Link href="/vendas/nova" className="rounded-lg bg-[#2563EB] px-4 py-2 text-sm text-white">Nova venda</Link>
      </div>
      <Table>
        <thead className="bg-slate-50 text-xs text-[#64748B]"><tr><th className="p-3">Código</th><th>Cliente</th><th>Data</th><th>Total</th><th>Status</th></tr></thead>
        <tbody>
          {book.sales.map((sale) => (
            <tr key={sale.id} className="border-t border-[#E2E8F0]">
              <td className="p-3">{sale.code}</td>
              <td>{clientName(book, sale.clientId)}</td>
              <td>{sale.soldOn}</td>
              <td>{money(sale.totalCents)}</td>
              <td><Status value={sale.status} /></td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
