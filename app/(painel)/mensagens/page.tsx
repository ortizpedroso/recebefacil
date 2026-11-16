import { desc, eq } from "drizzle-orm";
import { campaignAction } from "@/app/actions";
import { buttonClass, Card, Title } from "@/components/ui";
import { campaignRecipients, clients } from "@/lib/schema";
import { requireSession } from "@/lib/session";

export default async function MensagensPage() {
  const session = await requireSession();
  const people = await session.db.select().from(clients).where(eq(clients.organizationId, session.org.id));
  const queue = await session.db.select().from(campaignRecipients).where(eq(campaignRecipients.organizationId, session.org.id)).orderBy(desc(campaignRecipients.id)).limit(30);
  return (
    <div className="space-y-4">
      <Title hint="A mensagem entra na fila com o telefone e o texto. Sem provedor, ela não é enviada.">Mensagens</Title>
      <Card>
        <form action={async (formData) => { "use server"; await campaignAction(formData); }} className="space-y-3">
          <textarea name="body" required minLength={3} defaultValue="Olá, {nome}. Segue o lembrete da sua cobrança." className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm" aria-label="Mensagem" />
          <div className="grid gap-2 md:grid-cols-2">
            {people.map((client) => (
              <label key={client.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="clientId" value={client.id} />
                <span>{client.name}</span>
                <span className="text-[#64748B]">{client.whatsapp}</span>
              </label>
            ))}
          </div>
          <button className={buttonClass}>Gravar fila</button>
        </form>
      </Card>
      <Card>
        <p className="mb-2 font-medium">Fila</p>
        {queue.length === 0 ? <p className="text-sm text-[#64748B]">Nenhuma mensagem na fila.</p> : null}
        {queue.map((item) => (
          <p key={item.id} className="border-t border-[#E2E8F0] py-2 text-sm">{item.phone} · {item.status} · {item.body}</p>
        ))}
      </Card>
    </div>
  );
}
