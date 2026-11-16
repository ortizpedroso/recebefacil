import { IntegrationsPanel } from "@/components/integrations-panel";
import { formatDateTimeBR } from "@/lib/dates";
import { loadBook } from "@/lib/read";
import { requireSession } from "@/lib/session";

export default async function IntegracoesPage() {
  const session = await requireSession();
  const book = await loadBook(session.db, session.org.id, session.org.timezone);
  const events = [...book.events].sort((a, b) => b.happenedAt.localeCompare(a.happenedAt));
  return (
    <IntegrationsPanel
      connected={session.org.asaasConnected}
      environment={session.org.asaasEnvironment}
      account={session.org.tradeName}
      syncedAt={formatDateTimeBR(session.org.asaasSyncedAt)}
      keyHint={session.org.asaasKeyHint || ""}
      readOnly={session.publicDemo}
      events={events.map((event) => ({
        id: event.id,
        happenedAt: formatDateTimeBR(event.happenedAt),
        kind: event.kind,
        status: event.status,
        description: event.description,
      }))}
    />
  );
}
