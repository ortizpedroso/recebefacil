import { asc, eq } from "drizzle-orm";
import { InviteForm, MemberRole } from "@/components/settings-forms";
import { Card, Title } from "@/components/ui";
import { roleLabel } from "@/lib/access";
import { members } from "@/lib/schema";
import { requireSession } from "@/lib/session";

export default async function EquipePage() {
  const session = await requireSession();
  const team = await session.db.select().from(members).where(eq(members.organizationId, session.org.id)).orderBy(asc(members.name));
  return (
    <div className="space-y-4">
      <Title hint="Quem usa o RecebeFácil na sua empresa e o que cada pessoa pode fazer.">Equipe</Title>
      <Card className="space-y-3">
        <h2 className="font-bold text-slate-900">Convidar alguém</h2>
        <InviteForm />
      </Card>
      <Card className="space-y-3">
        <h2 className="font-bold text-slate-900">Pessoas</h2>
        <p className="text-sm text-slate-500">Seu acesso agora é de {roleLabel(session.role)}.</p>
        <ul className="divide-y divide-slate-100">
          {team.map((member) => (
            <li key={member.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <span className="min-w-0">
                <span className="block truncate font-semibold text-slate-900">{member.name}</span>
                <span className="block truncate text-[13px] text-slate-500">{member.email}</span>
              </span>
              <MemberRole memberId={member.id} name={member.name} role={member.role} />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
