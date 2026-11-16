import React, { useState } from 'react';
import {
  Plug,
  RefreshCw,
  CheckCircle2,
  PowerOff,
  ShieldAlert,
  Webhook,
  QrCode,
  CreditCard,
  Barcode,
  Clock,
} from 'lucide-react';
import { useRecebeFacil } from '../context/RecebeFacilContext';
import { AsaasLogo } from '../components/ui/BrandLogos';
import { StatusBadge } from '../components/ui/StatusBadge';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { formatDateTimeBR } from '../utils/formatters';

export const IntegracoesPage: React.FC = () => {
  const {
    state,
    conectarAsaasDemo,
    desconectarAsaasDemo,
    mudarAmbienteAsaas,
    sincronizarAsaasDemo,
  } = useRecebeFacil();

  const [confirmDisconnectOpen, setConfirmDisconnectOpen] = useState(false);

  const { asaas } = state;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
          Integrações
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Conecte provedores externos para disponibilizar meios de pagamento e sincronizar liquidações automaticamente.
        </p>
      </div>

      {/* Aviso explícito de simulação visual */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 text-xs text-amber-950">
        <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold">Demonstração visual — nenhuma chave de API real é solicitada ou armazenada</p>
          <p className="mt-1 text-amber-900 leading-relaxed">
            O RecebeFácil é uma plataforma de gestão comercial e financeira (não atua como banco, carteira digital ou gateway próprio). Os controles abaixo simulam a experiência prevista com o provedor externo <span className="font-semibold">Asaas</span>, sem envio de credenciais nem transações bancárias reais.
          </p>
        </div>
      </div>

      {/* Card principal Asaas */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <AsaasLogo />
              {asaas.conectado ? (
                <StatusBadge label="Conectado (Simulado)" variant="success" />
              ) : (
                <StatusBadge label="Desconectado" variant="neutral" />
              )}
              <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                Provedor de pagamentos planejado
              </span>
            </div>
            <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
              Provedor de pagamentos integrado — arquitetura planejada para emissão de cobranças (Pix, boleto e cartão), envio de links e sincronização automática de status via Webhooks.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {asaas.conectado ? (
              <>
                <button
                  type="button"
                  onClick={sincronizarAsaasDemo}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Simular sincronização</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDisconnectOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold transition-colors"
                >
                  <PowerOff className="w-3.5 h-3.5" />
                  <span>Desconectar</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={conectarAsaasDemo}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold transition-colors"
              >
                <Plug className="w-3.5 h-3.5" />
                <span>Conectar conta (Demo)</span>
              </button>
            )}
          </div>
        </div>

        {/* Configurações visuais e recursos planejados */}
        <div className="p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 bg-slate-50/50">
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-bold text-slate-900">Parâmetros da simulação</h3>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">
                Ambiente visual
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    { id: 'demonstracao', label: 'Demo' },
                    { id: 'sandbox', label: 'Sandbox' },
                    { id: 'producao', label: 'Produção' },
                  ] as const
                ).map((env) => (
                  <button
                    key={env.id}
                    type="button"
                    onClick={() => mudarAmbienteAsaas(env.id)}
                    className={`py-1.5 px-2 rounded-lg text-xs font-medium border transition-colors ${
                      asaas.ambiente === env.id
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {env.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Conta simulada</span>
                <span className="font-medium text-slate-800 truncate max-w-[180px]">
                  {asaas.contaSimuladaNome}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Última sincronização</span>
                <span className="font-medium text-slate-800 tabular-nums">
                  {formatDateTimeBR(asaas.ultimaSincronizacao)}
                </span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-4">
            <h3 className="text-xs font-bold text-slate-900 mb-3">
              Fluxo planejado entre RecebeFácil e Asaas
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 flex items-start gap-2.5">
                <QrCode className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-slate-900">Pix Dinâmico</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Geração automática de QR Code e copia-e-cola para vendas à vista e parcelas.
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 flex items-start gap-2.5">
                <Barcode className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-slate-900">Boleto Registrado</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Emissão para carnês de parcelamento, contratos imobiliários e mensalidades B2B.
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 flex items-start gap-2.5">
                <CreditCard className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-slate-900">Cartão de Crédito</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Link de pagamento hospedado pelo provedor, sem captura de dados no RecebeFácil.
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 flex items-start gap-2.5">
                <Webhook className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-slate-900">Webhooks de Baixa</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Atualização automática de parcelas e vendas após confirmação no provedor.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Histórico simulado de eventos */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-teal-700" />
            <h2 className="text-sm font-bold text-slate-900">
              Histórico simulado de eventos e sincronizações
            </h2>
          </div>
          <span className="text-xs text-slate-500 tabular-nums">
            {asaas.eventos.length} evento(s)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <th className="py-2.5 px-4 font-semibold">Data / Hora</th>
                <th className="py-2.5 px-4 font-semibold">Evento</th>
                <th className="py-2.5 px-4 font-semibold">Descrição</th>
                <th className="py-2.5 px-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {asaas.eventos.map((evt) => (
                <tr key={evt.id} className="hover:bg-slate-50/70">
                  <td className="py-2.5 px-4 tabular-nums text-slate-500 whitespace-nowrap">
                    {formatDateTimeBR(evt.data)}
                  </td>
                  <td className="py-2.5 px-4 font-mono font-semibold text-slate-800 whitespace-nowrap">
                    {evt.tipo}
                  </td>
                  <td className="py-2.5 px-4 text-slate-600">{evt.descricao}</td>
                  <td className="py-2.5 px-4 whitespace-nowrap">
                    {evt.status === 'sucesso' ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Registrado</span>
                      </span>
                    ) : (
                      <span className="text-slate-500 font-medium">Informativo</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <ConfirmModal
        open={confirmDisconnectOpen}
        onClose={() => setConfirmDisconnectOpen(false)}
        onConfirm={desconectarAsaasDemo}
        title="Desconectar simulação do Asaas"
        description="Esta ação altera apenas o estado visual demonstrativo da integração. Deseja desconectar?"
        confirmLabel="Desconectar"
      />
    </div>
  );
};
