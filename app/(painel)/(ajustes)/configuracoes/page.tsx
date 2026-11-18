import { CompanyForm } from "@/components/settings-forms";
import { Card, Title } from "@/components/ui";
import { roleLabel } from "@/lib/access";
import { requireSession } from "@/lib/session";

export default async function ConfiguracoesPage() {
  const session = await requireSession();
  const { org } = session;
  return (
    <div className="space-y-4">
      <Title hint="Estes dados aparecem no recibo, no contrato e no link de pagamento.">Minha empresa</Title>
      <Card>
        <CompanyForm
          company={{ tradeName: org.tradeName, legalName: org.legalName, document: org.document, email: org.email, phone: org.phone, address: org.address, timezone: org.timezone, lateFineBp: org.lateFineBp, lateInterestMonthlyBp: org.lateInterestMonthlyBp }}
        />
      </Card>
      <Card className="space-y-1 text-sm">
        <h2 className="font-bold text-slate-900">Sua conta</h2>
        <p className="text-slate-600">
          {session.profileName}
          {session.profileEmail ? ` · ${session.profileEmail}` : ""} · {roleLabel(session.role)}
        </p>
      </Card>
    </div>
  );
}
