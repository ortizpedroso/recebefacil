import { CompanyForm } from "@/components/forms";
import { Card, Title } from "@/components/ui";
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
        <CompanyForm tradeName={org.tradeName} legalName={org.legalName} document={org.document} email={org.email} phone={org.phone} timezone={org.timezone} address={org.address} />
      </Card>
      <Card>
        <p className="mb-2 font-medium">Equipe demonstrativa</p>
        {book.members.map((member) => <p key={member.id} className="text-sm">{member.name} · {member.role}</p>)}
        <p className="mt-3 text-sm text-[#64748B]">Papéis previstos: administrador, financeiro, vendedor e operador. O isolamento é por organização.</p>
      </Card>
    </div>
  );
}
