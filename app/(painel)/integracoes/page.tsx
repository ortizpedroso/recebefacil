import { asaasAction } from "@/app/actions";
import { buttonClass, Card, Title } from "@/components/ui";
import { loadBook } from "@/lib/read";
import { requireSession } from "@/lib/session";

export default async function IntegracoesPage() {
  const session = await requireSession();
  const book = await loadBook(session.db, session.org.id, session.org.timezone);
  const connected = session.org.asaasConnected;
  return (
    <div className="space-y-4">
      <Title hint="Nenhuma chave é pedida. Conectar só muda o estado visual.">Integrações</Title>
      <Card>
        <p className="text-lg font-semibold">Asaas</p>
        <p className="mt-1 text-sm text-[#64748B]">Provedor previsto para Pix, boleto e cartão. Esta versão não envia cobrança.</p>
        <p className="mt-3 text-sm">Situação: {connected ? "conectado na simulação" : "não conectado"}</p>
        <p className="text-sm">Ambiente: {session.org.asaasEnvironment}</p>
        <p className="text-sm">Última sincronização: {session.org.asaasSyncedAt ?? "nunca"}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <form action={async () => { "use server"; await asaasAction("demonstracao", true); }}><button className={buttonClass}>Conectar demonstração</button></form>
          <form action={async () => { "use server"; await asaasAction("sandbox", true); }}><button className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-sm">Marcar sandbox</button></form>
          <form action={async () => { "use server"; await asaasAction("demonstracao", false); }}><button className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-sm">Desconectar</button></form>
        </div>
      </Card>
      <Card>
        <p className="mb-2 font-medium">Histórico simulado</p>
        {book.events.map((event) => <p key={event.id} className="text-sm text-[#64748B]">{event.happenedAt.slice(0, 16)} · {event.description}</p>)}
      </Card>
    </div>
  );
}
