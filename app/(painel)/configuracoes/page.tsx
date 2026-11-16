import { companyAction } from "@/app/actions";
import { buttonClass, Card, inputClass, Title } from "@/components/ui";
import { loadBook } from "@/lib/read";
import { requireSession } from "@/lib/session";

export default async function ConfiguracoesPage() {
  const session = await requireSession();
  const book = await loadBook(session.db, session.org.id, session.org.timezone);
  const org = session.org;
  return (
    <div className="space-y-4">
      <Title hint="A senha de acesso é a da conta autenticada. Esta tela não guarda senha.">Configurações</Title>
      <Card>
        <form action={companyAction} className="grid gap-3 md:grid-cols-2">
          <input name="tradeName" defaultValue={org.tradeName} className={inputClass} aria-label="Nome fantasia" />
          <input name="legalName" defaultValue={org.legalName} className={inputClass} aria-label="Razão social" />
          <input name="document" defaultValue={org.document} className={inputClass} aria-label="Documento" />
          <input name="email" defaultValue={org.email} className={inputClass} aria-label="E-mail" />
          <input name="phone" defaultValue={org.phone} className={inputClass} aria-label="Telefone" />
          <input name="timezone" defaultValue={org.timezone} className={inputClass} aria-label="Fuso" />
          <input name="address" defaultValue={org.address} className={`${inputClass} md:col-span-2`} aria-label="Endereço" />
          <button className={buttonClass}>Salvar empresa</button>
        </form>
      </Card>
      <Card>
        <p className="mb-2 font-medium">Equipe demonstrativa</p>
        {book.members.map((member) => <p key={member.id} className="text-sm">{member.name} · {member.role}</p>)}
        <p className="mt-3 text-sm text-[#64748B]">Papéis previstos: administrador, financeiro, vendedor e operador. O isolamento é por organização.</p>
      </Card>
    </div>
  );
}
