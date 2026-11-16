import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  Pause,
  Play,
  XCircle,
  Eye,
  Repeat,
  FilePlus2,
} from 'lucide-react';
import { useRecebeFacil } from '../context/RecebeFacilContext';
import {
  FormaPagamento,
  Periodicidade,
  Recorrencia,
  StatusRecorrencia,
} from '../types/recebefacil';
import { formatBRL, formatDateBR, HOJE_DEMO, addPeriodToDate } from '../utils/formatters';
import { getRecorrenciaStatusBadge, getCobrancaStatusBadge } from '../components/ui/StatusBadge';
import { Modal } from '../components/ui/Modal';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { EmptyState } from '../components/ui/EmptyState';

export const RecorrenciasPage: React.FC = () => {
  const {
    state,
    createRecorrencia,
    updateRecorrenciaStatus,
    gerarCobrancaRecorrencia,
  } = useRecebeFacil();

  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<'todos' | StatusRecorrencia>('todos');
  const [selectedRec, setSelectedRec] = useState<Recorrencia | null>(null);
  const [confirmCancelRec, setConfirmCancelRec] = useState<Recorrencia | null>(null);

  // Modal Criar Recorrência
  const [createOpen, setCreateOpen] = useState(false);
  const [rClienteId, setRClienteId] = useState(state.clientes[0]?.id || '');
  const [rItemId, setRItemId] = useState('');
  const [rDescricao, setRDescricao] = useState('');
  const [rValor, setRValor] = useState('');
  const [rPeriodicidade, setRPeriodicidade] = useState<Periodicidade>('mensal');
  const [rPrimeira, setRPrimeira] = useState(addPeriodToDate(HOJE_DEMO, 'mensal', 1));
  const [rEncerramento, setREncerramento] = useState('');
  const [rForma, setRForma] = useState<FormaPagamento>('Pix');

  const filteredRecorrencias = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return state.recorrencias.filter((r) => {
      if (filtroStatus !== 'todos' && r.status !== filtroStatus) return false;
      if (!q) return true;
      const cli = state.clientes.find((c) => c.id === r.clienteId);
      return (
        r.codigo.toLowerCase().includes(q) ||
        r.descricaoServico.toLowerCase().includes(q) ||
        (cli && cli.nome.toLowerCase().includes(q))
      );
    });
  }, [state.recorrencias, state.clientes, busca, filtroStatus]);

  const handleSelectItemCatalogo = (itemId: string) => {
    setRItemId(itemId);
    const found = state.catalogo.find((i) => i.id === itemId);
    if (found) {
      setRDescricao(found.nome);
      setRValor(String(found.preco));
    }
  };

  const handleSubmitCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(rValor.replace(',', '.')) || 0;
    if (!rClienteId || !rDescricao.trim() || val <= 0) return;

    createRecorrencia({
      clienteId: rClienteId,
      itemId: rItemId || undefined,
      descricaoServico: rDescricao.trim(),
      valor: val,
      periodicidade: rPeriodicidade,
      primeiraCobranca: rPrimeira,
      dataEncerramento: rEncerramento || undefined,
      formaPagamento: rForma,
    });

    setCreateOpen(false);
    setRItemId('');
    setRDescricao('');
    setRValor('');
    setREncerramento('');
  };

  const mrrAtivo = useMemo(() => {
    return state.recorrencias
      .filter((r) => r.status === 'ativa' && r.periodicidade === 'mensal')
      .reduce((acc, r) => acc + r.valor, 0);
  }, [state.recorrencias]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Recorrências
            </h1>
            <span className="text-[11px] font-medium text-teal-800 border border-teal-200 bg-teal-50 px-2 py-0.5 rounded-md">
              Ciclos contínuos · Assinaturas e mensalidades
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Diferente de parcelamentos finitos, as recorrências geram cobranças periódicas contínuas até suspensão ou encerramento.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold transition-colors whitespace-nowrap self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Nova recorrência</span>
        </button>
      </div>

      {/* Resumo de Recorrências */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Assinaturas ativas</p>
          <p className="text-lg font-bold text-slate-900 mt-1 tabular-nums">
            {state.recorrencias.filter((r) => r.status === 'ativa').length} recorrência(s)
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Receita mensal recorrente prevista</p>
          <p className="text-lg font-bold text-teal-700 mt-1 tabular-nums">
            {formatBRL(mrrAtivo)} / mês
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Suspensas / canceladas</p>
          <p className="text-lg font-bold text-slate-700 mt-1 tabular-nums">
            {state.recorrencias.filter((r) => r.status !== 'ativa').length} contrato(s)
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Pesquisar por código, cliente ou serviço..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-teal-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'todos', label: 'Todas' },
              { id: 'ativa', label: 'Ativas' },
              { id: 'suspensa', label: 'Suspensas' },
              { id: 'cancelada', label: 'Canceladas' },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFiltroStatus(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                filtroStatus === f.id
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabela */}
      {filteredRecorrencias.length === 0 ? (
        <EmptyState
          icon={Repeat}
          title="Nenhuma recorrência encontrada"
          description="Crie cobranças recorrentes para mensalidades, consultorias, academias ou planos de manutenção."
          actionLabel="Criar recorrência"
          onAction={() => setCreateOpen(true)}
        />
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <th className="py-3 px-4 font-semibold">Código</th>
                <th className="py-3 px-4 font-semibold">Cliente</th>
                <th className="py-3 px-4 font-semibold">Serviço / Plano</th>
                <th className="py-3 px-4 font-semibold">Periodicidade</th>
                <th className="py-3 px-4 font-semibold">Próxima cobrança</th>
                <th className="py-3 px-4 font-semibold">Situação</th>
                <th className="py-3 px-4 font-semibold text-right">Valor ciclo</th>
                <th className="py-3 px-4 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecorrencias.map((rec) => {
                const cli = state.clientes.find((c) => c.id === rec.clienteId);
                return (
                  <tr key={rec.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-slate-900 whitespace-nowrap">
                      {rec.codigo}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                      {cli?.nome || 'Cliente'}
                    </td>
                    <td className="py-3 px-4 text-slate-700">{rec.descricaoServico}</td>
                    <td className="py-3 px-4 text-slate-600 capitalize whitespace-nowrap">
                      {rec.periodicidade} · {rec.formaPagamento}
                    </td>
                    <td className="py-3 px-4 tabular-nums text-slate-700 whitespace-nowrap">
                      {rec.status === 'ativa' ? formatDateBR(rec.proximaCobranca) : '—'}
                    </td>
                    <td className="py-3 px-4">{getRecorrenciaStatusBadge(rec.status)}</td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900 tabular-nums whitespace-nowrap">
                      {formatBRL(rec.valor)}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setSelectedRec(rec)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-teal-700 hover:bg-teal-50 transition-colors"
                          title="Visualizar cobranças e histórico"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {rec.status === 'ativa' && (
                          <>
                            <button
                              type="button"
                              onClick={() => gerarCobrancaRecorrencia(rec.id)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-teal-700 hover:bg-teal-50 transition-colors"
                              title="Gerar próxima cobrança agora (demo)"
                            >
                              <FilePlus2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => updateRecorrenciaStatus(rec.id, 'suspensa')}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-amber-700 hover:bg-amber-50 transition-colors"
                              title="Suspender recorrência"
                            >
                              <Pause className="w-4 h-4" />
                            </button>
                          </>
                        )}

                        {rec.status === 'suspensa' && (
                          <button
                            type="button"
                            onClick={() => updateRecorrenciaStatus(rec.id, 'ativa')}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                            title="Retomar recorrência"
                          >
                            <Play className="w-4 h-4" />
                          </button>
                        )}

                        {rec.status !== 'cancelada' && (
                          <button
                            type="button"
                            onClick={() => setConfirmCancelRec(rec)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-700 hover:bg-rose-50 transition-colors"
                            title="Cancelar recorrência"
                          >
                            <XCircle className="w-4 h-4" />
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

      {/* Modal Criar Recorrência */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Criar cobrança recorrente"
        subtitle="Configure planos mensais, semanais, trimestrais ou anuais."
        size="md"
      >
        <form onSubmit={handleSubmitCreate} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Cliente *</label>
            <select
              value={rClienteId}
              onChange={(e) => setRClienteId(e.target.value)}
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
              Produto ou serviço do catálogo (opcional)
            </label>
            <select
              value={rItemId}
              onChange={(e) => handleSelectItemCatalogo(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
            >
              <option value="">Selecionar item ou preencher abaixo...</option>
              {state.catalogo
                .filter((i) => i.ativo)
                .map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.nome} — {formatBRL(i.preco)}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Descrição da recorrência *
            </label>
            <input
              type="text"
              required
              value={rDescricao}
              onChange={(e) => setRDescricao(e.target.value)}
              placeholder="Ex: Mensalidade consultoria financeira"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Valor do ciclo (R$) *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={rValor}
                onChange={(e) => setRValor(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg tabular-nums"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Periodicidade *</label>
              <select
                value={rPeriodicidade}
                onChange={(e) => setRPeriodicidade(e.target.value as Periodicidade)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
              >
                <option value="semanal">Semanal</option>
                <option value="quinzenal">Quinzenal</option>
                <option value="mensal">Mensal</option>
                <option value="trimestral">Trimestral</option>
                <option value="semestral">Semestral</option>
                <option value="anual">Anual</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Primeira cobrança *</label>
              <input
                type="date"
                required
                value={rPrimeira}
                onChange={(e) => setRPrimeira(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Encerramento (opcional)
              </label>
              <input
                type="date"
                value={rEncerramento}
                onChange={(e) => setREncerramento(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Forma de pagamento</label>
              <select
                value={rForma}
                onChange={(e) => setRForma(e.target.value as FormaPagamento)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
              >
                <option value="Pix">Pix</option>
                <option value="Boleto">Boleto</option>
                <option value="Cartão de Crédito">Cartão de Crédito</option>
                <option value="Transferência">Transferência</option>
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
              Ativar recorrência
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Detalhes da Recorrência */}
      <Modal
        open={!!selectedRec}
        onClose={() => setSelectedRec(null)}
        title={`Recorrência ${selectedRec?.codigo || ''}`}
        subtitle={selectedRec?.descricaoServico}
        size="lg"
      >
        {selectedRec && (
          <div className="space-y-4 text-xs">
            {(() => {
              const atual =
                state.recorrencias.find((r) => r.id === selectedRec.id) || selectedRec;
              const cli = state.clientes.find((c) => c.id === atual.clienteId);
              const cobrancasRec = state.cobrancas.filter((c) => c.recorrenciaId === atual.id);

              return (
                <>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <p className="text-slate-500">Cliente</p>
                      <p className="font-semibold text-slate-900 mt-0.5">{cli?.nome}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Valor / Periodicidade</p>
                      <p className="font-semibold text-slate-900 tabular-nums mt-0.5 capitalize">
                        {formatBRL(atual.valor)} · {atual.periodicidade}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Próxima cobrança</p>
                      <p className="font-semibold text-slate-900 tabular-nums mt-0.5">
                        {atual.status === 'ativa' ? formatDateBR(atual.proximaCobranca) : 'Inativa'}
                      </p>
                    </div>
                    <div className="flex sm:justify-end items-center">
                      {getRecorrenciaStatusBadge(atual.status)}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-slate-800 mb-2">
                      Cobranças geradas ({cobrancasRec.length})
                    </h4>
                    <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
                      {cobrancasRec.length === 0 ? (
                        <p className="p-3.5 text-slate-500">
                          Nenhuma cobrança gerada ainda para este ciclo.
                        </p>
                      ) : (
                        cobrancasRec.map((c) => (
                          <div key={c.id} className="px-3.5 py-2.5 flex items-center justify-between">
                            <div>
                              <span className="font-mono font-medium text-slate-900">
                                {c.identificador}
                              </span>
                              <span className="text-slate-400 mx-2">·</span>
                              <span className="text-slate-600 tabular-nums">
                                Venc. {formatDateBR(c.vencimento)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold tabular-nums">{formatBRL(c.valor)}</span>
                              {getCobrancaStatusBadge(c.status)}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-slate-800 mb-2">Histórico de eventos</h4>
                    <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
                      {atual.historico.map((h, idx) => (
                        <div key={idx} className="px-3.5 py-2 flex items-center gap-3">
                          <span className="font-mono text-[11px] text-slate-400 tabular-nums shrink-0">
                            {formatDateBR(h.data)}
                          </span>
                          <span className="text-slate-700">{h.evento}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={!!confirmCancelRec}
        onClose={() => setConfirmCancelRec(null)}
        onConfirm={() => {
          if (confirmCancelRec) updateRecorrenciaStatus(confirmCancelRec.id, 'cancelada');
        }}
        title="Cancelar recorrência"
        description={`Ao cancelar a recorrência ${confirmCancelRec?.codigo}, nenhuma nova cobrança periódica será gerada. Deseja prosseguir?`}
        confirmLabel="Cancelar recorrência"
      />
    </div>
  );
};
