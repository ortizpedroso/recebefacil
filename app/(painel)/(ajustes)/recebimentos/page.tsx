import { ReceivingForm } from "@/components/settings-forms";
import { Card } from "@/components/ui";
import { canReceiveOnlineNow } from "@/lib/billing";
import { loadPlatformSettings, platformSettingsView } from "@/lib/platform-settings";
import { requireSession } from "@/lib/session";
import { refreshSubaccountStatus, SUBACCOUNT_LABEL } from "@/lib/subaccount";

export const dynamic = "force-dynamic";

export default async function RecebimentosPage() {
  const { db, org } = await requireSession();
  const settings = await loadPlatformSettings(db);
  const platform = platformSettingsView(settings);
  const subaccountStatus = org.asaasAccountId ? await refreshSubaccountStatus(db, org, settings).catch(() => org.asaasAccountStatus) : "";
  const planAllowed = await canReceiveOnlineNow(db, org);
  return (
    <div className="space-y-4">
      <Card>
        <ReceivingForm
          pixKey={org.pixKey}
          instructions={org.paymentInstructions}
          initialMode={org.receivingMode}
          link={org.asaasWalletId ? { accountName: org.asaasAccountName, walletTail: org.asaasWalletId.slice(-6), ...(org.asaasAccountId ? { subaccountLabel: SUBACCOUNT_LABEL[subaccountStatus] } : {}) } : null}
          subaccountDefaults={{ document: org.document, name: org.legalName || org.tradeName, email: org.email, phone: org.phone }}
          offer={{ available: platform.ready, planAllowed, feeBp: platform.feeBp, environment: platform.environment }}
        />
      </Card>
    </div>
  );
}
