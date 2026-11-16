import { contactAction } from "@/app/actions";
import { buttonClass, money, Title } from "@/components/ui";
import { formatDateBR, whatsAppHref } from "@/lib/dates";
import { clientName, delinquency, loadBook } from "@/lib/read";
import { requireSession } from "@/lib/session";

export default async function InadimplenciaPage() {
  const session = await requireSession();
  const book = await loadBook(session.db, session.org.id, session.org.timezone);
  const rows = delinquency(book);
  const bands = ["1 a 7 dias", "8 a 15 dias", "16 a 30 dias", "31 a 60 dias", "Acima de 60 dias"];
  return (
    <div className="space-y-4">
      <Title hint="O WhatsApp abre com a mensagem pronta. Nada é disparado em massa.">Inadimplência</Title>
      <div className="grid gap-3 sm:grid-cols-5">
        {bands.map((band) => (
          <div key={band} className="rounded-xl border border-[#E2E8F0] bg-white p-3 text-sm">
            <p className="text-[#64748B]">{band}</p>
            <p className="text-xl font-semibold">{rows.filter((row) => row.band === band).length}</p>
          </div>
        ))}
      </div>
      {rows.map((row) => {
        const client = book.clients.find((item) => item.id === row.charge.clientId);
        const message = `Olá, ${clientName(book, row.charge.clientId)}. Tudo bem? Identificamos uma cobrança referente a ${row.charge.code}, com vencimento em ${formatDateBR(row.charge.dueOn)}. Gostaríamos de verificar se podemos ajudar na regularização. Estamos à disposição.`;
        return (
          <article key={row.charge.id} className="rounded-xl border border-[#E2E8F0] bg-white p-4">
            <p className="font-medium">{clientName(book, row.charge.clientId)} · {money(row.charge.amountCents - row.charge.paidCents)}</p>
            <p className="text-sm text-[#64748B]">{formatDateBR(row.charge.dueOn)} · {row.days} dias · {row.band}</p>
            <p className="text-sm text-[#64748B]">{client?.phone}</p>
            {row.last ? <p className="text-sm">Último contato: {row.last.summary}</p> : null}
            <div className="mt-3 flex flex-wrap gap-3">
              <a className="text-sm text-[#2563EB]" href={whatsAppHref(client?.whatsapp || client?.phone || "", message)} target="_blank" rel="noreferrer">Abrir WhatsApp</a>
            </div>
            <form className="mt-3 grid gap-2 md:grid-cols-4" action={async (formData) => { "use server"; await contactAction({ clientId: row.charge.clientId, chargeId: row.charge.id, channel: "WhatsApp", summary: String(formData.get("summary") || ""), promiseOn: String(formData.get("promiseOn") || "") }); }}>
              <input name="summary" required placeholder="O que foi combinado" className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm md:col-span-2" />
              <input name="promiseOn" type="date" className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm" />
              <button className={buttonClass}>Registrar contato</button>
            </form>
          </article>
        );
      })}
    </div>
  );
}
