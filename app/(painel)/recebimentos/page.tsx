import { ReceivingForm } from "@/components/settings-forms";
import { Card, Title } from "@/components/ui";
import { loadPlatformSettings, platformSettingsView } from "@/lib/platform-settings";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function RecebimentosPage() {
  const { db, org } = await requireSession();
  const platform = platformSettingsView(await loadPlatformSettings(db));
  return (
    <div className="space-y-4">
      <Title hint="Como você recebe e o que seu cliente vê quando abre o link de pagamento.">Recebimentos</Title>
      <Card>
        <ReceivingForm
          pixKey={org.pixKey}
          instructions={org.paymentInstructions}
          initialMode={org.receivingMode}
          link={org.asaasWalletId ? { accountName: org.asaasAccountName, walletTail: org.asaasWalletId.slice(-6) } : null}
          offer={{ available: platform.ready, feeBp: platform.feeBp, environment: platform.environment }}
        />
      </Card>
    </div>
  );
}
