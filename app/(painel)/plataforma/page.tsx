import { notFound } from "next/navigation";
import { PlatformForm } from "@/components/platform-form";
import { Title } from "@/components/ui";
import { WEBHOOK_EVENTS_TO_ENABLE } from "@/lib/asaas-webhook";
import { requestOrigin } from "@/lib/pay-link";
import { isPlatformOwner } from "@/lib/platform-owner";
import { loadPlatformSettings, platformSettingsView } from "@/lib/platform-settings";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function PlataformaPage() {
  const session = await requireSession();
  if (!isPlatformOwner(session)) notFound();
  const view = platformSettingsView(await loadPlatformSettings(session.db));
  const origin = await requestOrigin();
  return (
    <div className="space-y-4">
      <Title hint="Credenciais do Asaas, taxa e planos. Só o dono da plataforma vê esta página.">Plataforma</Title>
      <PlatformForm view={view} webhookUrl={`${origin}/api/webhooks/asaas`} events={WEBHOOK_EVENTS_TO_ENABLE} />
    </div>
  );
}
