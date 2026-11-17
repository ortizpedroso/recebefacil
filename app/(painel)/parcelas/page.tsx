import { and, eq, inArray } from "drizzle-orm";
import { PayForm } from "@/components/forms";
import { Pager } from "@/components/pager";
import { dueAction } from "@/app/actions";
import { money, Status, Table, Title } from "@/components/ui";
import { formatDateBR, todayIn } from "@/lib/dates";
import { lateCharges } from "@/lib/late";
import { displayStatus, pagedCharges } from "@/lib/read";
import { clients, contracts, saleItems } from "@/lib/schema";
import { requireSession } from "@/lib/session";

export default async function ParcelasPage({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  const params = await searchParams;
  const session = await requireSession();
  const today = todayIn(session.org.timezone);
  const listed = await pagedCharges(session.db, session.org.id, Number(params.pagina || 1), "parcelas");
  const people = await session.db.select().from(clients).where(eq(clients.organizationId, session.org.id));
  const names = new Map(people.map((client) => [client.id, client.name]));
  const contractIds = [...new Set(listed.rows.map((row) => row.contractId).filter((value): value is string => Boolean(value)))];
  const saleIds = [...new Set(listed.rows.map((row) => row.saleId).filter((value): value is string => value !== null))];
  const contractRows = contractIds.length ? await session.db.select().from(contracts).where(and(eq(contracts.organizationId, session.org.id), inArray(contracts.id, contractIds))) : [];
  const itemRows = saleIds.length ? await session.db.select().from(saleItems).where(and(eq(saleItems.organizationId, session.org.id), inArray(saleItems.saleId, saleIds))) : [];
  const contractDesc = new Map(contractRows.map((contract) => [contract.id, contract.description]));
  const itemsBySale = new Map<string, string[]>();
  for (const item of itemRows) {
    const list = itemsBySale.get(item.saleId) ?? [];
    list.push(item.description);
    itemsBySale.set(item.saleId, list);
  }
  const subject = (row: (typeof listed.rows)[number]) => {
    if (row.contractId && contractDesc.has(row.contractId)) return contractDesc.get(row.contractId) ?? "";
    const items = row.saleId ? itemsBySale.get(row.saleId) : undefined;
    return items?.length ? items.join(", ") : "";
  };
  return (
    <div>
      <Title hint="Com juros ou reajuste, a soma das parcelas passa do preço da venda. A multa e os juros de mora entram na hora de receber.">Parcelas</Title>
      <Table>
        <thead className="bg-slate-50 text-xs text-[#64748B]"><tr><th className="p-3">Parcela</th><th>Cliente</th><th>Vencimento</th><th>Valor</th><th>Status</th><th>Pagamento</th></tr></thead>
        <tbody>
          {listed.rows.map((row) => {
            const status = displayStatus(row.status, row.dueOn, today, row.paidCents, row.amountCents);
            const payable = status !== "paga" && status !== "cancelada";
            const late = lateCharges(row.amountCents - row.paidCents, row.dueOn, today, session.org);
            return (
              <tr key={row.id} className="border-t border-[#E2E8F0] align-top">
                <td className="p-3">{row.label ?? row.code}<p className="text-xs text-[#64748B]">{subject(row)}</p></td>
                <td>{names.get(row.clientId) || "Cliente"}</td>
                <td>{formatDateBR(row.dueOn)}</td>
                <td>{money(row.amountCents)}<p className="text-xs text-[#64748B]">pago {money(row.paidCents)}</p></td>
                <td><Status value={status} /></td>
                <td className="p-3">
                  {payable ? <PayForm chargeId={row.id} today={today} suggestedFeeCents={late.fineCents + late.interestCents} /> : null}
                  {payable ? (
                    <form className="mt-2 flex gap-2" action={async (formData) => { "use server"; await dueAction({ chargeId: row.id, dueOn: String(formData.get("dueOn") || "") }); }}>
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
