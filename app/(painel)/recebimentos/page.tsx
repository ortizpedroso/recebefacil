import { ReceivingForm } from "@/components/settings-forms";
import { Card, Title } from "@/components/ui";
import { requireSession } from "@/lib/session";

export default async function RecebimentosPage() {
  const { org } = await requireSession();
  return (
    <div className="space-y-4">
      <Title hint="O que seu cliente vê quando abre o link de pagamento.">Recebimentos</Title>
      <Card>
        <ReceivingForm pixKey={org.pixKey} instructions={org.paymentInstructions} asaasConnected={false} />
      </Card>
    </div>
  );
}
