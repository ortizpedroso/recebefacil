import { notFound } from "next/navigation";
import { PlatformForm } from "@/components/platform-form";
import { Card, Table, Title } from "@/components/ui";
import { WEBHOOK_EVENTS_TO_ENABLE } from "@/lib/asaas-webhook";
import { listSubscribers, PLAN_LABEL, STATE_LABEL } from "@/lib/billing";
import { formatDateBR, todayIn } from "@/lib/dates";
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
  const subscribers = await listSubscribers(session.db, todayIn("America/Sao_Paulo"));
  return (
    <div className="space-y-4">
      <Title hint="Credenciais do Asaas, taxa e planos. Só o dono da plataforma vê esta página.">Plataforma</Title>
      <PlatformForm view={view} webhookUrl={`${origin}/api/webhooks/asaas`} events={WEBHOOK_EVENTS_TO_ENABLE} />
      <Card className="space-y-3">
        <div>
          <h2 className="font-bold text-slate-900">Assinantes</h2>
          <p className="text-sm text-slate-500">Quem usa o RecebeFácil, em que plano está e quando vence. Só leitura.</p>
        </div>
        {subscribers.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma empresa assinante ainda.</p>
        ) : (
          <Table>
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 font-semibold">Empresa</th>
                <th className="px-3 py-2 font-semibold">Plano</th>
                <th className="px-3 py-2 font-semibold">Situação</th>
                <th className="px-3 py-2 font-semibold">Próximo vencimento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {subscribers.map((row) => (
                <tr key={row.organizationId}>
                  <td className="px-3 py-2 font-medium text-slate-900">{row.company}</td>
                  <td className="px-3 py-2 text-slate-700">{PLAN_LABEL[row.planCode]}</td>
                  <td className="px-3 py-2 text-slate-700">{STATE_LABEL[row.state]}</td>
                  <td className="px-3 py-2 tabular-nums text-slate-700">{formatDateBR(row.dueOn)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
