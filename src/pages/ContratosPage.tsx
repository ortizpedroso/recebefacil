import React, { useState, useMemo } from 'react';
import { Plus, Search, Eye, FileText } from 'lucide-react';
import { useRecebeFacil } from '../context/RecebeFacilContext';
import { Contrato, SituacaoContrato } from '../types/recebefacil';
import { formatBRL, formatDateBR, HOJE_DEMO, addPeriodToDate } from '../utils/formatters';
import {
  getContratoSituacaoBadge,
  getParcelaStatusBadge,
  getCobrancaStatusBadge,
} from '../components/ui/StatusBadge';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';

export const ContratosPage: React.FC = () => {
  const { state, createContrato, updateContratoSituacao } = useRecebeFacil();

  const [busca, setBusca] = useState('');
  const [filtroSituacao, setFiltroSituacao] = useState<'todos' | SituacaoContrato>('todos');
  const [selectedContrato, setSelectedContrato] = useState<Contrato | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [cClienteId, setCClienteId] = useState(state.clientes[0]?.id || '');
  const [cDescricao, setCDescricao] = useState('');
  const [cValor, setCValor] = useState('');
  const [cInicio, setCInicio] = useState(HOJE_DEMO);
  const [cTermino, setCTermino] = useState(addPeriodToDate(HOJE_DEMO, 'anual', 1));
  const [cCondicoes, setCCondicoes] = useState('');

  const filteredContratos = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return state.contratos.filter((c) => {
      if (filtroSituacao !== 'todos' && c.situacao !== filtroSituacao) return false;
      if (!q) return true;
      const cli = state.clientes.find((cl) => cl.id === c.clienteId);
      return (
        c.numero.toLowerCase().includes(q) ||
        c.descricao.toLowerCase().includes(q) ||
        (cli && cli.nome.toLowerCase().includes(q))
      );
    });
  }, [state.contratos, state.clientes, busca, filtroSituacao]);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(cValor.replace(',', '.')) || 0;
    if (!cClienteId || !cDescricao.trim() || val <= 0) return;

    createContrato({
      clienteId: cClienteId,
      descricao: cDescricao.trim(),
      valorTotal: val,
      dataInicio: cInicio,
      dataTermino: cTermino,
      condicoesPagamento: cCondicoes.trim() || 'Conforme cronograma combinado',
      situacao: 'ativo',
    });

    setCreateOpen(false);
    setCDescricao('');
    setCValor('');
    setCCondicoes('');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Contratos</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Organize contratos comerciais com vigência, condições financeiras, parcelas e cobranças associadas.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold transition-colors whitespace-nowrap self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Novo contrato</span>
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Pesquisar por nº do contrato, cliente ou descrição..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-teal-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'todos', label: 'Todos' },
              { id: 'ativo', label: 'Ativos' },
              { id: 'concluido', label: 'Concluídos' },
              { id: 'suspenso', label: 'Suspensos' },
              { id: 'cancelado', label: 'Cancelados' },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFiltroSituacao(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                filtroSituacao === f.id
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Listagem */}
      {filteredContratos.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Nenhum contrato encontrado"
          description="Cadastre um novo contrato para acompanhar vigência, parcelas e histórico."
          actionLabel="Criar contrato"
          onAction={() => setCreateOpen(true)}
        />
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <th className="py-3 px-4 font-semibold">Nº do contrato</th>
                <th className="py-3 px-4 font-semibold">Cliente</th>
                <th className="py-3 px-4 font-semibold">Descrição e condições</th>
                <th className="py-3 px-4 font-semibold">Vigência</th>
                <th className="py-3 px-4 font-semibold">Situação</th>
                <th className="py-3 px-4 font-semibold text-right">Valor total</th>
                <th className="py-3 px-4 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredContratos.map((ctr) => {
                const cli = state.clientes.find((c) => c.id === ctr.clienteId);
                return (
                  <tr key={ctr.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-slate-900 whitespace-nowrap">
                      {ctr.numero}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                      {cli?.nome || 'Cliente'}
                    </td>
                    <td className="py-3 px-4 max-w-xs">
                      <div className="font-medium text-slate-800 truncate">{ctr.descricao}</div>
                      <div className="text-[11px] text-slate-500 truncate">{ctr.condicoesPagamento}</div>
                    </td>
                    <td className="py-3 px-4 tabular-nums text-slate-600 whitespace-nowrap">
                      {formatDateBR(ctr.dataInicio)} – {formatDateBR(ctr.dataTermino)}
                    </td>
                    <td className="py-3 px-4">{getContratoSituacaoBadge(ctr.situacao)}</td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900 tabular-nums whitespace-nowrap">
                      {formatBRL(ctr.valorTotal)}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setSelectedContrato(ctr)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-teal-700 hover:bg-teal-50 transition-colors"
                        title="Visualizar contrato e vínculos"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Novo Contrato */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Cadastrar contrato"
        subtitle="Registro organizacional e financeiro (sem assinatura eletrônica neste protótipo)."
        size="md"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
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
            <label className="block font-semibold text-slate-700 mb-1">Objeto / Descrição *</label>
            <input
              type="text"
              required
              value={cDescricao}
              onChange={(e) => setCDescricao(e.target.value)}
              placeholder="Ex: Contrato de prestação de serviços ou venda imobiliária"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Valor total (R$) *</label>
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
              <label className="block font-semibold text-slate-700 mb-1">Data de início</label>
              <input
                type="date"
                value={cInicio}
                onChange={(e) => setCInicio(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Data de término</label>
              <input
                type="date"
                value={cTermino}
                onChange={(e) => setCTermino(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Condições de pagamento</label>
            <input
              type="text"
              value={cCondicoes}
              onChange={(e) => setCCondicoes(e.target.value)}
              placeholder="Ex: Entrada de 20% + 12 parcelas mensais via Boleto"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
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
              Registrar contrato
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Detalhes do Contrato */}
      <Modal
        open={!!selectedContrato}
        onClose={() => setSelectedContrato(null)}
        title={`Contrato ${selectedContrato?.numero || ''}`}
        subtitle={selectedContrato?.descricao}
        size="lg"
      >
        {selectedContrato && (
          <div className="space-y-5 text-xs">
            {(() => {
              const atual =
                state.contratos.find((c) => c.id === selectedContrato.id) || selectedContrato;
              const cli = state.clientes.find((c) => c.id === atual.clienteId);
              const vendasCtr = state.vendas.filter((v) => v.contratoId === atual.id);
              const parcelasCtr = state.parcelas.filter((p) => p.contratoId === atual.id);
              const cobrancasCtr = state.cobrancas.filter((c) => c.contratoId === atual.id);

              return (
                <>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <p className="text-slate-500">Cliente</p>
                      <p className="font-semibold text-slate-900 mt-0.5">{cli?.nome}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Vigência</p>
                      <p className="font-medium text-slate-900 tabular-nums mt-0.5">
                        {formatDateBR(atual.dataInicio)} até {formatDateBR(atual.dataTermino)}
                      </p>
                    </div>
                    <div className="flex flex-col sm:items-end">
                      <p className="text-slate-500">Valor total</p>
                      <p className="text-sm font-bold text-slate-900 tabular-nums mt-0.5">
                        {formatBRL(atual.valorTotal)}
                      </p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-slate-500">Condições de pagamento</p>
                      <p className="text-slate-800 mt-0.5">{atual.condicoesPagamento}</p>
                    </div>
                    <div className="flex items-center sm:justify-end gap-2">
                      {getContratoSituacaoBadge(atual.situacao)}
                    </div>
                  </div>

                  {/* Vendas e Parcelas vinculadas */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 font-semibold text-slate-800">
                        Parcelas vinculadas ({parcelasCtr.length})
                      </div>
                      <div className="max-h-48 overflow-y-auto divide-y divide-slate-100">
                        {parcelasCtr.length === 0 ? (
                          <p className="p-3.5 text-slate-500">Nenhuma parcela vinculada.</p>
                        ) : (
                          parcelasCtr.map((p) => (
                            <div key={p.id} className="px-3.5 py-2 flex items-center justify-between">
                              <div>
                                <p className="font-medium text-slate-800 tabular-nums">
                                  {p.numeroParcela === 0 ? 'Entrada' : `Parcela ${p.numeroParcela}/${p.totalParcelas}`} ·{' '}
                                  {formatDateBR(p.vencimento)}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold tabular-nums">{formatBRL(p.valor)}</span>
                                {getParcelaStatusBadge(p.status)}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 font-semibold text-slate-800">
                        Cobranças ({cobrancasCtr.length}) & Vendas ({vendasCtr.length})
                      </div>
                      <div className="max-h-48 overflow-y-auto divide-y divide-slate-100">
                        {cobrancasCtr.length === 0 ? (
                          <p className="p-3.5 text-slate-500">Nenhuma cobrança gerada.</p>
                        ) : (
                          cobrancasCtr.map((c) => (
                            <div key={c.id} className="px-3.5 py-2 flex items-center justify-between">
                              <div>
                                <p className="font-mono font-medium text-slate-900">{c.identificador}</p>
                                <p className="text-[11px] text-slate-500 tabular-nums">
                                  Venc. {formatDateBR(c.vencimento)}
                                </p>
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
                  </div>

                  {/* Histórico do Contrato */}
                  <div>
                    <h4 className="font-semibold text-slate-800 mb-2">Histórico do contrato</h4>
                    <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
                      {atual.historico.map((h, i) => (
                        <div key={i} className="px-3.5 py-2 flex items-center gap-3">
                          <span className="font-mono text-[11px] text-slate-400 tabular-nums shrink-0">
                            {formatDateBR(h.data)}
                          </span>
                          <span className="text-slate-700">{h.evento}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Alterar Situação */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500">Alterar situação:</span>
                      <select
                        value={atual.situacao}
                        onChange={(e) => {
                          const s = e.target.value as SituacaoContrato;
                          updateContratoSituacao(atual.id, s);
                          setSelectedContrato({ ...atual, situacao: s });
                        }}
                        className="px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white"
                      >
                        <option value="ativo">Ativo</option>
                        <option value="concluido">Concluído</option>
                        <option value="suspenso">Suspenso</option>
                        <option value="cancelado">Cancelado</option>
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedContrato(null)}
                      className="px-4 py-2 rounded-lg bg-slate-900 text-white font-semibold"
                    >
                      Fechar
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </Modal>
    </div>
  );
};
