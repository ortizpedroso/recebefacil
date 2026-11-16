import { and, eq, inArray } from "drizzle-orm";
import { PayForm } from "@/components/forms";
import { Pager } from "@/components/pager";
import { dueAction } from "@/app/actions";
import { money, Status, Table, Title } from "@/components/ui";
import { formatDateBR, todayIn } from "@/lib/dates";
import { displayStatus, pagedInstallments } from "@/lib/read";
import { charges, clients } from "@/lib/schema";
import { requireSession } from "@/lib/session";

export default async function ParcelasPage({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  const params = await searchParams;
  const session = await requireSession();
  const today = todayIn(session.org.timezone);
  const listed = await pagedInstallments(session.db, session.org.id, Number(params.pagina || 1));
  const people = await session.db.select().from(clients).where(eq(clients.organizationId, session.org.id));
  const names = new Map(people.map((client) => [client.id, client.name]));
  const ids = listed.rows.map((row) => row.id);
  const chargeRows = ids.length
    ? await session.db.select().from(charges).where(and(eq(charges.organizationId, session.org.id), inArray(charges.installmentId, ids)))
    : [];
  return (
    <div>
      <Title hint="A soma da entrada com as parcelas é o total da venda. O centavo extra fica na primeira.">Parcelas</Title>
      <Table>
        <thead className="bg-slate-50 text-xs text-[#64748B]"><tr><th className="p-3">Parcela</th><th>Cliente</th><th>Vencimento</th><th>Valor</th><th>Status</th><th>Pagamento</th></tr></thead>
        <tbody>
          {listed.rows.map((row) => {
            const charge = chargeRows.find((item) => item.installmentId === row.id);
            const status = displayStatus(row.status, row.dueOn, today, row.paidCents, row.amountCents);
            return (
              <tr key={row.id} className="border-t border-[#E2E8F0] align-top">
                <td className="p-3">{row.label}</td>
                <td>{names.get(row.clientId) || "Cliente"}</td>
                <td>{formatDateBR(row.dueOn)}</td>
                <td>{money(row.amountCents)}<p className="text-xs text-[#64748B]">pago {money(row.paidCents)}</p></td>
                <td><Status value={status} /></td>
                <td className="p-3">
                  {charge && status !== "paga" ? <PayForm chargeId={charge.id} today={today} /> : null}
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
      <Pager page={listed.page} pages={listed.pages} path="/parcelas" />
    </div>
  );
}
