import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus,
  Search,
  Copy,
  Eye,
  MessageCircle,
  CheckCircle2,
  RotateCcw,
  XCircle,
  Receipt,
  QrCode,
  ExternalLink,
  Info,
} from 'lucide-react';
import { useRecebeFacil } from '../context/RecebeFacilContext';
import { Cobranca, FormaPagamento, StatusCobranca } from '../types/recebefacil';
import {
  formatBRL,
  formatDateBR,
  HOJE_DEMO,
  buildWhatsAppLink,
} from '../utils/formatters';
import { getCobrancaStatusBadge } from '../components/ui/StatusBadge';
import { Modal } from '../components/ui/Modal';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { EmptyState } from '../components/ui/EmptyState';
import { RecebeFacilLogo, AsaasLogo } from '../components/ui/BrandLogos';

interface CobrancasPageProps {
  openCreateModalSignal?: number;
}

export const CobrancasPage: React.FC<CobrancasPageProps> = ({ openCreateModalSignal }) => {
  const {
    state,
    showToast,
    createCobranca,
    marcarCobrancaPaga,
    cancelarCobranca,
    estornarCobranca,
  } = useRecebeFacil();

  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<'todos' | StatusCobranca>('todos');
  const [previewCob, setPreviewCob] = useState<Cobranca | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: 'cancelar' | 'estornar';
    cobranca: Cobranca;
  } | null>(null);

  // Modal Gerar Cobrança
  const [createOpen, setCreateOpen] = useState(false);
  const [cClienteId, setCClienteId] = useState(state.clientes[0]?.id || '');
  const [cVendaId, setCVendaId] = useState('');
  const [cReferencia, setCReferencia] = useState('');
  const [cValor, setCValor] = useState('');
  const [cVencimento, setCVencimento] = useState(HOJE_DEMO);
  const [cForma, setCForma] = useState<FormaPagamento>(state.configuracoes.financeiro.formaPadrao);

  useEffect(() => {
    if (openCreateModalSignal && openCreateModalSignal > 0) {
      setCreateOpen(true);
    }
  }, [openCreateModalSignal]);

  const filteredCobrancas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return state.cobrancas.filter((c) => {
      if (filtroStatus !== 'todos' && c.status !== filtroStatus) return false;
      if (!q) return true;
      const cli = state.clientes.find((cl) => cl.id === c.clienteId);
      return (
        c.identificador.toLowerCase().includes(q) ||
        c.referencia.toLowerCase().includes(q) ||
        (cli && cli.nome.toLowerCase().includes(q))
      );
    });
  }, [state.cobrancas, state.clientes, busca, filtroStatus]);

  const resumo = useMemo(() => {
    const pendentes = state.cobrancas
      .filter((c) => c.status === 'pendente')
      .reduce((acc, c) => acc + c.valor, 0);
    const pagas = state.cobrancas
      .filter((c) => c.status === 'paga')
      .reduce((acc, c) => acc + c.valor, 0);
    const vencidas = state.cobrancas
      .filter((c) => c.status === 'vencida')
      .reduce((acc, c) => acc + c.valor, 0);
    return { pendentes, pagas, vencidas };
  }, [state.cobrancas]);

  const handleSelectVenda = (vendaId: string) => {
    setCVendaId(vendaId);
    const v = state.vendas.find((item) => item.id === vendaId);
    if (v) {
      setCClienteId(v.clienteId);
      setCReferencia(`${v.codigo} · ${v.itens[0]?.descricao || 'Cobrança de venda'}`);
      setCValor(String(v.valorTotal));
      setCForma(v.formaRecebimento);
    }
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(cValor.replace(',', '.')) || 0;
    if (!cClienteId || !cReferencia.trim() || val <= 0) return;

    createCobranca({
      clienteId: cClienteId,
      referencia: cReferencia.trim(),
      valor: val,
      vencimento: cVencimento,
      formaPagamento: cForma,
      vendaId: cVendaId || undefined,
    });

    setCreateOpen(false);
    setCVendaId('');
    setCReferencia('');
    setCValor('');
  };

  const handleCopyLink = async (cob: Cobranca) => {
    try {
      await navigator.clipboard.writeText(cob.linkDemonstrativo);
      showToast(`Link demonstrativo de ${cob.identificador} copiado!`);
    } catch {
      showToast(`Link: ${cob.linkDemonstrativo}`, 'info');
    }
  };

  const handleWhatsApp = (cob: Cobranca) => {
    const cli = state.clientes.find((c) => c.id === cob.clienteId);
    if (!cli) return;
    const msg = `Olá, ${cli.nome}! Segue o link demonstrativo da sua cobrança ${cob.identificador} (${cob.referencia}) no valor de ${formatBRL(cob.valor)}, com vencimento em ${formatDateBR(cob.vencimento)}: ${cob.linkDemonstrativo}`;
    window.open(buildWhatsAppLink(cli.telefone, msg), '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Cobranças e recebimentos
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Emita links demonstrativos, compartilhe via WhatsApp e acompanhe liquidações e estornos.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold transition-colors whitespace-nowrap self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Gerar cobrança</span>
        </button>
      </div>

      {/* Aviso de posicionamento e ambiente demonstrativo */}
      <div className="bg-sky-50/70 border border-sky-200 rounded-xl p-3.5 flex items-start gap-3 text-xs text-sky-900">
        <Info className="w-4 h-4 text-sky-700 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold">Ambiente demonstrativo:</span> o RecebeFácil organiza vendas e cobranças utilizando o <span className="font-semibold">Asaas</span> como provedor externo planejado de meios de pagamento. Links, confirmações e estornos nesta tela são simulações visuais sem transação financeira real.
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Cobranças pendentes</p>
          <p className="text-lg font-bold text-amber-700 mt-1 tabular-nums">
            {formatBRL(resumo.pendentes)}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Recebimentos confirmados</p>
          <p className="text-lg font-bold text-emerald-700 mt-1 tabular-nums">
            {formatBRL(resumo.pagas)}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Cobranças vencidas</p>
          <p className="text-lg font-bold text-rose-700 mt-1 tabular-nums">
            {formatBRL(resumo.vencidas)}
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por identificador, cliente ou referência..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-teal-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'todos', label: 'Todas' },
              { id: 'pendente', label: 'Pendentes' },
              { id: 'paga', label: 'Pagas' },
              { id: 'vencida', label: 'Vencidas' },
              { id: 'cancelada', label: 'Canceladas' },
              { id: 'estornada', label: 'Estornos' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFiltroStatus(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                filtroStatus === tab.id
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabela de Cobranças */}
      {filteredCobrancas.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Nenhuma cobrança encontrada"
          description="Ajuste os filtros aplicados ou gere uma nova cobrança demonstrativa."
          actionLabel="Gerar cobrança"
          onAction={() => setCreateOpen(true)}
        />
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <th className="py-3 px-4 font-semibold">Identificador</th>
                <th className="py-3 px-4 font-semibold">Cliente</th>
                <th className="py-3 px-4 font-semibold">Referência</th>
                <th className="py-3 px-4 font-semibold">Vencimento</th>
                <th className="py-3 px-4 font-semibold">Forma</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold">Confirmação</th>
                <th className="py-3 px-4 font-semibold text-right">Valor</th>
                <th className="py-3 px-4 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCobrancas.map((cob) => {
                const cli = state.clientes.find((c) => c.id === cob.clienteId);
                return (
                  <tr key={cob.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-slate-900 whitespace-nowrap">
                      {cob.identificador}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                      {cli?.nome || 'Cliente'}
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-[240px] truncate">
                      {cob.referencia}
                    </td>
                    <td className="py-3 px-4 tabular-nums text-slate-700 whitespace-nowrap">
                      {formatDateBR(cob.vencimento)}
                    </td>
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                      {cob.formaPagamento}
                    </td>
                    <td className="py-3 px-4">{getCobrancaStatusBadge(cob.status)}</td>
                    <td className="py-3 px-4 tabular-nums text-slate-500 whitespace-nowrap">
                      {cob.dataConfirmacao ? formatDateBR(cob.dataConfirmacao) : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900 tabular-nums whitespace-nowrap">
                      {formatBRL(cob.valor)}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setPreviewCob(cob)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-teal-700 hover:bg-teal-50 transition-colors"
                          title="Visualizar prévia da cobrança"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopyLink(cob)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-teal-700 hover:bg-teal-50 transition-colors"
                          title="Copiar link demonstrativo"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleWhatsApp(cob)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                          title="Compartilhar por WhatsApp"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </button>

                        {(cob.status === 'pendente' || cob.status === 'vencida') && (
                          <>
                            <button
                              type="button"
                              onClick={() => marcarCobrancaPaga(cob.id)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                              title="Confirmar pagamento (Demo)"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmAction({ type: 'cancelar', cobranca: cob })}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-700 hover:bg-rose-50 transition-colors"
                              title="Cancelar cobrança"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </>
                        )}

                        {cob.status === 'paga' && (
                          <button
                            type="button"
                            onClick={() => setConfirmAction({ type: 'estornar', cobranca: cob })}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-amber-700 hover:bg-amber-50 transition-colors"
                            title="Simular estorno (Demo)"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Gerar Cobrança */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Gerar nova cobrança (Demonstração)"
        subtitle="Crie um registro de cobrança vinculado a um cliente ou venda existente."
        size="md"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Vincular a uma venda existente (opcional)
            </label>
            <select
              value={cVendaId}
              onChange={(e) => handleSelectVenda(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
            >
              <option value="">Cobrança avulsa / manual</option>
              {state.vendas
                .filter((v) => v.situacao !== 'cancelada')
                .map((v) => {
                  const cli = state.clientes.find((c) => c.id === v.clienteId);
                  return (
                    <option key={v.id} value={v.id}>
                      {v.codigo} — {cli?.nome} ({formatBRL(v.valorTotal)})
                    </option>
                  );
                })}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Cliente *</label>
            <select
              value={cClienteId}
              onChange={(e) => setCClienteId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
            >
              {state.clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Referência / Descrição *
            </label>
            <input
              type="text"
              required
              value={cReferencia}
              onChange={(e) => setCReferencia(e.target.value)}
              placeholder="Ex: Sinal projeto planejado / Mensalidade Novembro"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Valor (R$) *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={cValor}
                onChange={(e) => setCValor(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg tabular-nums"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Vencimento *</label>
              <input
                type="date"
                required
                value={cVencimento}
                onChange={(e) => setCVencimento(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Meio previsto</label>
              <select
                value={cForma}
                onChange={(e) => setCForma(e.target.value as FormaPagamento)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
              >
                <option value="Pix">Pix</option>
                <option value="Boleto">Boleto</option>
                <option value="Cartão de Crédito">Cartão de Crédito</option>
                <option value="Transferência">Transferência</option>
                <option value="Dinheiro">Dinheiro</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-semibold"
            >
              Gerar cobrança demo
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Prévia Demonstrativa da Cobrança */}
      <Modal
        open={!!previewCob}
        onClose={() => setPreviewCob(null)}
        title={`Prévia demonstrativa · ${previewCob?.identificador || ''}`}
        subtitle="Visualização simulada do documento enviado ao cliente"
        size="md"
      >
        {previewCob && (
          <div className="space-y-4 text-xs">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-900">
              Prévia demonstrativa de cobrança — sem checkout real, captura de cartão ou processamento bancário efetivo.
            </div>

            {(() => {
              const cli = state.clientes.find((c) => c.id === previewCob.clienteId);
              return (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                    <RecebeFacilLogo compact />
                    <div className="text-right">
                      <p className="font-semibold text-slate-900">
                        {state.configuracoes.empresa.nomeFantasia}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        CNPJ {state.configuracoes.empresa.cnpj}
                      </p>
                    </div>
                  </div>

                  <div className="p-5 space-y-4 bg-white">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">
                          Pagador
                        </p>
                        <p className="font-semibold text-slate-900 text-sm mt-0.5">{cli?.nome}</p>
                        <p className="text-slate-500">{cli?.cpfCnpj}</p>
                      </div>
                      <div className="text-right">
                        {getCobrancaStatusBadge(previewCob.status)}
                        <p className="text-2xl font-bold text-slate-900 tabular-nums mt-1.5">
                          {formatBRL(previewCob.valor)}
                        </p>
                      </div>
                    </div>

                    <div className="bg-slate-50 rounded-lg p-3.5 grid grid-cols-2 gap-3 border border-slate-100">
                      <div>
                        <p className="text-slate-500">Referência</p>
                        <p className="font-semibold text-slate-900 mt-0.5">{previewCob.referencia}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Vencimento</p>
                        <p className="font-semibold text-slate-900 tabular-nums mt-0.5">
                          {formatDateBR(previewCob.vencimento)}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500">Meio selecionado</p>
                        <p className="font-semibold text-slate-900 mt-0.5">
                          {previewCob.formaPagamento}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500">Provedor planejado</p>
                        <div className="mt-0.5">
                          <AsaasLogo className="h-4" />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-slate-300 bg-slate-50/50">
                      <div className="w-12 h-12 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
                        <QrCode className="w-7 h-7 text-slate-700" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-800">
                          Código Pix / Linha digitável simulados
                        </p>
                        <p className="font-mono text-[11px] text-slate-500 truncate mt-0.5">
                          {previewCob.linkDemonstrativo}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyLink(previewCob)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium inline-flex items-center gap-1 shrink-0"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <button
                type="button"
                onClick={() => handleWhatsApp(previewCob)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Enviar por WhatsApp</span>
              </button>

              <div className="flex items-center gap-2">
                {(previewCob.status === 'pendente' || previewCob.status === 'vencida') && (
                  <button
                    type="button"
                    onClick={() => {
                      marcarCobrancaPaga(previewCob.id);
                      setPreviewCob(null);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-semibold"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Simular pagamento confirmado</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setPreviewCob(null)}
                  className="px-3.5 py-2 rounded-lg border border-slate-200 text-slate-700 font-medium"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => {
          if (!confirmAction) return;
          if (confirmAction.type === 'cancelar') {
            cancelarCobranca(confirmAction.cobranca.id);
          } else {
            estornarCobranca(confirmAction.cobranca.id);
          }
        }}
        title={
          confirmAction?.type === 'cancelar'
            ? 'Cancelar cobrança'
            : 'Simular estorno de pagamento'
        }
        description={
          confirmAction?.type === 'cancelar'
            ? `Confirma o cancelamento da cobrança ${confirmAction.cobranca.identificador} no valor de ${formatBRL(confirmAction.cobranca.valor)}?`
            : `Confirma o registro de estorno demonstrativo da cobrança ${confirmAction?.cobranca.identificador}? Nenhuma movimentação bancária real será realizada.`
        }
        confirmLabel={
          confirmAction?.type === 'cancelar' ? 'Cancelar cobrança' : 'Confirmar estorno (Demo)'
        }
      />
    </div>
  );
};
