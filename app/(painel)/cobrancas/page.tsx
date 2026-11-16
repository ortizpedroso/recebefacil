import { CopyLink } from "@/components/copy-link";
import { reverseAction } from "@/app/actions";
import { money, Status, Table, Title } from "@/components/ui";
import { formatDateBR } from "@/lib/dates";
import { clientName, displayStatus, loadBook } from "@/lib/read";
import { requireSession } from "@/lib/session";

export default async function CobrancasPage() {
  const session = await requireSession();
  const book = await loadBook(session.db, session.org.id, session.org.timezone);
  return (
    <div>
      <Title hint="O link é desta demonstração. Não existe checkout, Pix real nem boleto registrado.">Cobranças e recebimentos</Title>
      <Table>
        <thead className="bg-slate-50 text-xs text-[#64748B]"><tr><th className="p-3">Código</th><th>Cliente</th><th>Vencimento</th><th>Valor</th><th>Forma</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {book.charges.map((charge) => {
            const status = displayStatus(charge.status, charge.dueOn, book.today, charge.paidCents, charge.amountCents);
            return (
              <tr key={charge.id} className="border-t border-[#E2E8F0]">
                <td className="p-3">{charge.code}</td>
                <td>{clientName(book, charge.clientId)}</td>
                <td>{formatDateBR(charge.dueOn)}</td>
                <td>{money(charge.amountCents)}</td>
                <td>{charge.method}</td>
                <td><Status value={status} /></td>
                <td className="p-3 text-sm">
                  <p className="text-xs text-[#64748B]">Link demonstrativo /cobrancas#{charge.code}</p>
                  <CopyLink path={`/cobrancas#${charge.code}`} />
                  {status === "paga" ? (
                    <form action={async () => { "use server"; await reverseAction(charge.id); }}>
                      <button className="text-[#EF4444]">Estornar</button>
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
