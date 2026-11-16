"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Barcode, CheckCircle2, Clock, CreditCard, Plug, PowerOff, QrCode, RefreshCw, ShieldAlert, Webhook } from "lucide-react";
import { asaasAction } from "@/app/actions";

type EventRow = { id: string; happenedAt: string; kind: string; status: string; description: string };

const environments = [
  { id: "demonstracao", label: "Demo" },
  { id: "sandbox", label: "Sandbox" },
  { id: "producao", label: "Produção" },
] as const;

export function IntegrationsPanel({
  connected,
  environment,
  account,
  syncedAt,
  events,
}: {
  connected: boolean;
  environment: string;
  account: string;
  syncedAt: string;
  events: EventRow[];
}) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);

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
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-950">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
        <div>
          <p className="font-bold">Demonstração visual — nenhuma chave de API real é solicitada ou armazenada</p>
          <p className="mt-1 leading-relaxed text-amber-900">
            O RecebeFácil é uma plataforma de gestão comercial e financeira (não atua como banco, carteira digital ou gateway próprio). Os controles abaixo simulam a experiência prevista com o provedor externo <span className="font-semibold">Asaas</span>, sem envio de credenciais nem transações bancárias reais.
          </p>
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 p-5 sm:p-6 lg:flex-row lg:items-center">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <AsaasLogo />
              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${connected ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
                <Clock className="h-3 w-3" /> {connected ? "Conectado (Simulado)" : "Desconectado"}
              </span>
              <span className="rounded border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">Provedor de pagamentos planejado</span>
            </div>
            <p className="max-w-2xl text-xs leading-relaxed text-slate-600">Provedor de pagamentos integrado. Arquitetura planejada para emissão de cobranças (Pix, boleto e cartão), envio de links e sincronização automática de status via Webhooks.</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {connected ? (
              <>
                <button type="button" className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-800" onClick={() => run("sync")}>
                  <RefreshCw className="h-3.5 w-3.5" /> Simular sincronização
                </button>
                <button type="button" className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100" onClick={() => setConfirm(true)}>
                  <PowerOff className="h-3.5 w-3.5" /> Desconectar
                </button>
              </>
            ) : (
              <button type="button" className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800" onClick={() => run("connect")}>
                <Plug className="h-3.5 w-3.5" /> Conectar conta (Demo)
              </button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6 bg-slate-50/50 p-5 sm:p-6 lg:grid-cols-3">
          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-xs font-bold text-slate-900">Parâmetros da simulação</h2>
            <div>
              <p className="mb-1.5 text-[11px] font-semibold text-slate-500">Ambiente visual</p>
              <div className="grid grid-cols-3 gap-1.5">
                {environments.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => run(item.id)}
                    className={`rounded-lg border px-2 py-1.5 text-xs font-medium ${environment === item.id ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5 border-t border-slate-100 pt-2 text-xs">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Conta simulada</span>
                <span className="max-w-[180px] truncate font-medium text-slate-800">{account}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Última sincronização</span>
                <span className="font-medium text-slate-800">{syncedAt}</span>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 lg:col-span-2">
            <h2 className="mb-3 text-xs font-bold text-slate-900">Fluxo planejado entre RecebeFácil e Asaas</h2>
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
            <h2 className="text-sm font-bold text-slate-900">Histórico simulado de eventos e sincronizações</h2>
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
            <h2 className="text-sm font-bold text-slate-900">Desconectar simulação do Asaas</h2>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">Esta ação altera apenas o estado visual demonstrativo da integração.</p>
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
