import { PayForm } from "@/components/forms";
import { dueAction } from "@/app/actions";
import { money, Status, Table, Title } from "@/components/ui";
import { formatDateBR } from "@/lib/dates";
import { clientName, displayStatus, loadBook } from "@/lib/read";
import { requireSession } from "@/lib/session";

export default async function ParcelasPage() {
  const session = await requireSession();
  const book = await loadBook(session.db, session.org.id, session.org.timezone);
  return (
    <div>
      <Title hint="A soma da entrada com as parcelas é o total da venda. O centavo extra fica na primeira.">Parcelas</Title>
      <Table>
        <thead className="bg-slate-50 text-xs text-[#64748B]"><tr><th className="p-3">Parcela</th><th>Cliente</th><th>Vencimento</th><th>Valor</th><th>Status</th><th>Pagamento</th></tr></thead>
        <tbody>
          {book.installments.map((row) => {
            const charge = book.charges.find((item) => item.installmentId === row.id);
            const status = displayStatus(row.status, row.dueOn, book.today, row.paidCents, row.amountCents);
            return (
              <tr key={row.id} className="border-t border-[#E2E8F0] align-top">
                <td className="p-3">{row.label}</td>
                <td>{clientName(book, row.clientId)}</td>
                <td>{formatDateBR(row.dueOn)}</td>
                <td>{money(row.amountCents)}<p className="text-xs text-[#64748B]">pago {money(row.paidCents)}</p></td>
                <td><Status value={status} /></td>
                <td className="p-3">
                  {charge && status !== "paga" ? <PayForm chargeId={charge.id} today={book.today} /> : null}
                  {status !== "paga" ? (
                    <form className="mt-2 flex gap-2" action={async (formData) => { "use server"; await dueAction({ installmentId: row.id, dueOn: String(formData.get("dueOn") || "") }); }}>
                      <input name="dueOn" type="date" className="rounded border border-[#E2E8F0] px-2 py-1 text-xs" />
                      <button className="text-xs text-[#2563EB]">Alterar vencimento</button>
                    </form>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </div>
  );
}
