import { eq } from "drizzle-orm";
import { Pager } from "@/components/pager";
import { issueAsaasChargeAction, reverseAction } from "@/app/actions";
import { money, Status, Table, Title } from "@/components/ui";
import { formatDateBR, todayIn } from "@/lib/dates";
import { displayStatus, pagedCharges } from "@/lib/read";
import { clients } from "@/lib/schema";
import { requireSession } from "@/lib/session";

export default async function CobrancasPage({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  const params = await searchParams;
  const session = await requireSession();
  const today = todayIn(session.org.timezone);
  const listed = await pagedCharges(session.db, session.org.id, Number(params.pagina || 1));
  const people = await session.db.select().from(clients).where(eq(clients.organizationId, session.org.id));
  const names = new Map(people.map((client) => [client.id, client.name]));
  return (
    <div>
      <Title hint="O link de Pix, boleto ou cartão aparece depois que a cobrança é criada no Asaas.">Cobranças e recebimentos</Title>
      <Table>
        <thead className="bg-slate-50 text-xs text-[#64748B]"><tr><th className="p-3">Código</th><th>Cliente</th><th>Vencimento</th><th>Valor</th><th>Forma</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {listed.rows.map((charge) => {
            const status = displayStatus(charge.status, charge.dueOn, today, charge.paidCents, charge.amountCents);
            return (
              <tr key={charge.id} className="border-t border-[#E2E8F0]">
                <td className="p-3">{charge.code}</td>
                <td>{names.get(charge.clientId) || "Cliente"}</td>
                <td>{formatDateBR(charge.dueOn)}</td>
                <td>{money(charge.amountCents)}</td>
                <td>{charge.method}</td>
                <td><Status value={status} /></td>
                <td className="p-3 text-sm">
                  {charge.invoiceUrl ? <a className="block text-teal-700" href={charge.invoiceUrl}>Fatura Asaas</a> : null}
                  {charge.bankSlipUrl ? <a className="block text-teal-700" href={charge.bankSlipUrl}>Boleto</a> : null}
                  {charge.pixPayload ? <p className="max-w-xs break-all text-xs text-[#64748B]">Pix {charge.pixPayload}</p> : null}
                  {!charge.invoiceUrl ? (
                    <form action={async () => { "use server"; await issueAsaasChargeAction(charge.id); }}>
                      <button className="text-teal-700">Emitir no Asaas</button>
                    </form>
                  ) : null}
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
      <Pager page={listed.page} pages={listed.pages} path="/cobrancas" />
    </div>
  );
}
