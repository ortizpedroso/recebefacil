"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Barcode, CheckCircle2, Clock, CreditCard, PowerOff, QrCode, Webhook } from "lucide-react";
import { asaasAction, revealWebhookAction, saveAsaasAction } from "@/app/actions";

type EventRow = { id: string; happenedAt: string; kind: string; status: string; description: string };

export function IntegrationsPanel({
  connected,
  environment,
  account,
  syncedAt,
  events,
  keyHint,
  readOnly,
}: {
  connected: boolean;
  environment: string;
  account: string;
  syncedAt: string;
  events: EventRow[];
  keyHint: string;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [notice, setNotice] = useState("");
  const [webhookToken, setWebhookToken] = useState("");

  async function run(command: "connect" | "disconnect" | "sync" | "demonstracao" | "sandbox" | "producao") {
    await asaasAction(command);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Integrações</h1>
        <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">Conecte provedores externos para disponibilizar meios de pagamento e sincronizar liquidações automaticamente.</p>
      </div>
      <form
        className="grid gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2"
        onSubmit={async (event) => {
          event.preventDefault();
          const result = await saveAsaasAction(new FormData(event.currentTarget));
          if (!result.ok) {
            setNotice(result.error);
            return;
          }
          setWebhookToken(result.webhookToken);
          setNotice(`Conta ${result.accountName} verificada. A chave ficou cifrada no banco. Copie o token abaixo para o webhook do Asaas.`);
          router.refresh();
        }}
      >
        <div className="sm:col-span-2">
          <p className="text-sm font-semibold text-slate-900">Credenciais do Asaas</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">Cole a chave da sua conta. Ela começa com $aact_ e não fica no código. O RecebeFácil guarda só o texto cifrado. O segredo de cifragem é RECEBEFACIL_SECRET, no ambiente.</p>
        </div>
        <label className="text-xs font-medium text-slate-600">
          Ambiente
          <select name="environment" defaultValue={environment === "producao" ? "producao" : "sandbox"} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="sandbox">Sandbox</option>
            <option value="producao">Produção</option>
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600">
          Chave de API
          <input name="apiKey" type="password" autoComplete="off" required placeholder="$aact_..." className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        </label>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button type="submit" disabled={readOnly} className="rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">Verificar e guardar</button>
          {keyHint ? <span className="text-xs text-slate-500">Chave gravada, final {keyHint}</span> : null}
          {connected ? (
            <button type="button" className="text-xs font-medium text-slate-600" onClick={async () => {
              const result = await revealWebhookAction();
              if (result.ok) setWebhookToken(result.webhookToken);
              else setNotice(result.error);
            }}>Mostrar token do webhook</button>
          ) : null}
        </div>
        {webhookToken ? <p className="sm:col-span-2 break-all rounded-lg bg-slate-50 p-3 font-mono text-xs text-slate-800">Token do webhook: {webhookToken}</p> : null}
        <p className="sm:col-span-2 text-xs text-slate-500">URL do webhook: /api/webhooks/asaas. No painel do Asaas, o header é asaas-access-token.</p>
        {notice ? <p className="sm:col-span-2 text-sm text-slate-700">{notice}</p> : null}
        {readOnly ? <p className="sm:col-span-2 text-xs text-rose-700">O visitante não grava chave.</p> : null}
      </form>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 p-5 sm:p-6 lg:flex-row lg:items-center">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <AsaasLogo />
              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${connected ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
                <Clock className="h-3 w-3" /> {connected ? "Conectado" : "Desconectado"}
              </span>
              <span className="rounded border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{environment === "producao" ? "Produção" : "Sandbox"}</span>
            </div>
            <p className="max-w-2xl text-xs leading-relaxed text-slate-600">A cobrança nasce no Asaas. O link da fatura, o boleto e o Pix ficam na cobrança. O pagamento só entra no livro quando o webhook confirma.</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {connected ? (
              <button type="button" className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100" onClick={() => setConfirm(true)}>
                <PowerOff className="h-3.5 w-3.5" /> Desconectar
              </button>
            ) : null}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6 bg-slate-50/50 p-5 sm:p-6 lg:grid-cols-3">
          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-xs font-bold text-slate-900">Conta ligada</h2>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Conta Asaas</span>
                <span className="max-w-[180px] truncate font-medium text-slate-800">{account}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Última verificação</span>
                <span className="font-medium text-slate-800">{syncedAt}</span>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 lg:col-span-2">
            <h2 className="mb-3 text-xs font-bold text-slate-900">O que o Asaas devolve</h2>
            <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
              <Flow icon={QrCode} title="Pix Dinâmico" text="Geração automática de QR Code e copia-e-cola para vendas à vista e parcelas." />
              <Flow icon={Barcode} title="Boleto Registrado" text="Emissão para carnês de parcelamento, contratos imobiliários e mensalidades B2B." />
              <Flow icon={CreditCard} title="Cartão de Crédito" text="Link de pagamento hospedado pelo provedor, sem captura de dados no RecebeFácil." />
              <Flow icon={Webhook} title="Webhooks de Baixa" text="Atualização automática de parcelas e vendas após confirmação no provedor." />
            </div>
          </div>
        </div>
      </div>
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-teal-700" />
            <h2 className="text-sm font-bold text-slate-900">Eventos da integração</h2>
          </div>
          <span className="text-xs text-slate-500">{events.length} evento(s)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <th className="px-4 py-2.5 font-semibold">Data / Hora</th>
                <th className="px-4 py-2.5 font-semibold">Evento</th>
                <th className="px-4 py-2.5 font-semibold">Descrição</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {events.map((event) => (
                <tr key={event.id} className="hover:bg-slate-50/70">
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-500">{event.happenedAt}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 font-mono font-semibold text-slate-800">{event.kind}</td>
                  <td className="px-4 py-2.5 text-slate-600">{event.description}</td>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    {event.status === "sucesso" ? (
                      <span className="inline-flex items-center gap-1 font-medium text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> Registrado</span>
                    ) : (
                      <span className="font-medium text-slate-500">Informativo</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {confirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button className="absolute inset-0 bg-slate-900/40" aria-label="Fechar" onClick={() => setConfirm(false)} />
          <div className="relative w-full max-w-md rounded-xl bg-white p-5 shadow-lg">
            <h2 className="text-sm font-bold text-slate-900">Desconectar o Asaas</h2>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">Apaga a chave cifrada e o token do webhook desta empresa. As cobranças já emitidas continuam no Asaas.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium" onClick={() => setConfirm(false)}>Cancelar</button>
              <button type="button" className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white" onClick={() => { setConfirm(false); void run("disconnect"); }}>Desconectar</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AsaasLogo() {
  return (
    <span className="inline-flex items-center gap-2">
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
        <rect width="28" height="28" rx="7" fill="#0030B9" />
        <path d="M14 6.5L20.5 20.5H17.3L15.9 17.2H12.1L10.7 20.5H7.5L14 6.5ZM14 11.4L12.9 14.4H15.1L14 11.4Z" fill="#FFFFFF" />
      </svg>
      <span className="text-base font-bold tracking-tight text-slate-900">Asaas</span>
    </span>
  );
}

function Flow({ icon: Icon, title, text }: { icon: typeof QrCode; title: string; text: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-slate-100 bg-slate-50 p-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" />
      <div>
        <p className="font-semibold text-slate-900">{title}</p>
        <p className="mt-0.5 text-[11px] text-slate-500">{text}</p>
      </div>
    </div>
  );
}
