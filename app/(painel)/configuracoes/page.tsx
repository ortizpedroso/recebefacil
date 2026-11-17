import { roleAction } from "@/app/actions";
import { InviteForm, CompanyForm } from "@/components/forms";
import { buttonClass, Card, inputClass, Title } from "@/components/ui";
import { roleLabel, roles } from "@/lib/access";
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
        <CompanyForm tradeName={org.tradeName} legalName={org.legalName} document={org.document} email={org.email} phone={org.phone} timezone={org.timezone} address={org.address} lateFineBp={org.lateFineBp} lateInterestMonthlyBp={org.lateInterestMonthlyBp} />
      </Card>
      <Card>
        <p className="mb-1 font-medium">Usuário e conta</p>
        <p className="text-sm text-[#64748B]">{session.profileName} · {session.profileEmail} · {roleLabel(session.role)}</p>
        <p className="mt-2 text-xs text-[#64748B]">A senha é a da conta autenticada (Cursor). Este app não guarda senha. Moeda BRL e datas no padrão brasileiro são fixos.</p>
      </Card>
      <Card>
        <p className="mb-1 font-medium">Equipe</p>
        <p className="mb-3 text-sm text-[#64748B]">Seu papel nesta sessão é {roleLabel(session.role)}. Na demonstração, esse papel segue o cadastro de camila@exemplo.com. Um convite grava a pessoa na empresa.</p>
        <InviteForm />
        <div className="mt-4 space-y-2">
          {book.members.map((member) => (
            <form key={member.id} className="flex flex-wrap items-center gap-2 text-sm" action={async (formData) => { "use server"; await roleAction(member.id, String(formData.get("role") || "")); }}>
              <span className="min-w-40">{member.name}</span>
              <span className="text-[#64748B]">{member.email}</span>
              <select name="role" defaultValue={member.role} className={inputClass} aria-label={`Papel de ${member.name}`}>
                {roles.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}
              </select>
              <button className={buttonClass}>Salvar papel</button>
            </form>
          ))}
        </div>
      </Card>
    </div>
  );
}
