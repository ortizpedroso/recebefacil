import { and, eq } from "drizzle-orm";
import { RecurrenceEditForm } from "@/components/forms";
import { Card, Title } from "@/components/ui";
import { recurrences } from "@/lib/schema";
import { requireSession } from "@/lib/session";

export default async function EditarRecorrenciaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const [recurrence] = await session.db.select().from(recurrences).where(and(eq(recurrences.organizationId, session.org.id), eq(recurrences.id, id)));
  if (!recurrence) {
    return <Card><p className="text-sm text-[#64748B]">Recorrência não encontrada.</p></Card>;
  }
  return (
    <div>
      <Title hint="Valor e encerramento valem para as próximas cobranças. A periodicidade não muda aqui.">Editar recorrência</Title>
      <Card>
        <RecurrenceEditForm
          recurrenceId={recurrence.id}
          initial={{ description: recurrence.description, amountCents: recurrence.amountCents, endsOn: recurrence.endsOn }}
        />
      </Card>
    </div>
  );
}
