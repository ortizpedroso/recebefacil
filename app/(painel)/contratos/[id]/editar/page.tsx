import { and, eq } from "drizzle-orm";
import { ContractEditForm } from "@/components/forms";
import { Card, Title } from "@/components/ui";
import { contracts } from "@/lib/schema";
import { requireSession } from "@/lib/session";

export default async function EditarContratoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const [contract] = await session.db.select().from(contracts).where(and(eq(contracts.organizationId, session.org.id), eq(contracts.id, id)));
  if (!contract) {
    return <Card><p className="text-sm text-[#64748B]">Contrato não encontrado.</p></Card>;
  }
  return (
    <div>
      <Title hint="Edite só os dados do contrato. Valor, cliente e parcelas não mudam aqui.">Editar contrato</Title>
      <Card>
        <ContractEditForm
          contractId={contract.id}
          initial={{ description: contract.description, startsOn: contract.startsOn, endsOn: contract.endsOn, terms: contract.terms }}
        />
      </Card>
    </div>
  );
}
