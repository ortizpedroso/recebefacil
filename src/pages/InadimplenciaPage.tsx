import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  MessageCircle,
  MessageSquarePlus,
  CalendarCheck2,
  History,
  Settings2,
  CheckCircle2,
} from 'lucide-react';
import { useRecebeFacil } from '../context/RecebeFacilContext';
import { Cobranca, StatusNegociacao } from '../types/recebefacil';
import {
  formatBRL,
  formatDateBR,
  diffDaysFromToday,
  buildWhatsAppLink,
  HOJE_DEMO,
} from '../utils/formatters';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';

const NEGOCIACAO_LABELS: Record<
  StatusNegociacao,
  { label: string; variant: 'neutral' | 'info' | 'warning' | 'success' }
> = {
  sem_contato: { label: 'Sem contato', variant: 'neutral' },
  em_contato: { label: 'Em contato', variant: 'info' },
  promessa_pagamento: { label: 'Promessa de pagamento', variant: 'warning' },
  acordo_firmado: { label: 'Acordo firmado', variant: 'success' },
};

export const InadimplenciaPage: React.FC = () => {
  const {
    state,
    addContatoCliente,
    atualizarNegociacaoCobranca,
    updateConfiguracoes,
    marcarCobrancaPaga,
  } = useRecebeFacil();

  const [filtroNegociacao, setFiltroNegociacao] = useState<'todos' | StatusNegociacao>('todos');
  const [filtroDias, setFiltroDias] = useState<'todos' | '1-15' | '16-30' | '30+'>('todos');

  // Modais de interação
  const [historicoCob, setHistoricoCob] = useState<Cobranca | null>(null);
  const [contatoCob, setContatoCob] = useState<Cobranca | null>(null);
  const [promessaCob, setPromessaCob] = useState<Cobranca | null>(null);
  const [modelosOpen, setModelosOpen] = useState(false);

  // Form Registrar Contato
  const [canal, setCanal] = useState<'WhatsApp' | 'Ligação' | 'E-mail' | 'Presencial'>('WhatsApp');
  const [resumoContato, setResumoContato] = useState('');
  const [novoStatusNeg, setNovoStatusNeg] = useState<StatusNegociacao>('em_contato');

  // Form Promessa de Pagamento
  const [dataPromessa, setDataPromessa] = useState('2026-11-25');
  const [obsPromessa, setObsPromessa] = useState('');

  // Modelos de mensagem editáveis
  const [modelosDraft, setModelosDraft] = useState(state.configuracoes.modelosMensagem);

  const cobrancasVencidas = useMemo(() => {
    return state.cobrancas
      .filter((c) => c.status === 'vencida')
      .filter((c) => {
        const neg = c.negociacaoStatus || 'sem_contato';
        if (filtroNegociacao !== 'todos' && neg !== filtroNegociacao) return false;

        const dias = Math.max(1, diffDaysFromToday(c.vencimento));
        if (filtroDias === '1-15' && (dias < 1 || dias > 15)) return false;
        if (filtroDias === '16-30' && (dias < 16 || dias > 30)) return false;
        if (filtroDias === '30+' && dias <= 30) return false;
        return true;
      });
  }, [state.cobrancas, filtroNegociacao, filtroDias]);

  const totalEmAtraso = useMemo(
    () =>
      state.cobrancas
        .filter((c) => c.status === 'vencida')
        .reduce((acc, c) => acc + c.valor, 0),
    [state.cobrancas]
  );

  const getUltimoContatoCliente = (clienteId: string) => {
    const lista = state.contatos
      .filter((ct) => ct.clienteId === clienteId)
      .sort((a, b) => b.data.localeCompare(a.data));
    return lista[0];
  };

  const handleOpenWhatsAppEducado = (cob: Cobranca) => {
    const cli = state.clientes.find((c) => c.id === cob.clienteId);
    if (!cli) return;
    const modeloAtraso =
      state.configuracoes.modelosMensagem.find((m) => m.tipo === 'atraso')?.texto ||
      'Olá, {nome}! Lembramos que a cobrança {referencia} no valor de {valor}, vencida em {vencimento}, encontra-se em aberto.';
    const texto = modeloAtraso
      .replace(/\{nome\}/g, cli.nome)
      .replace(/\{referencia\}/g, cob.referencia)
      .replace(/\{valor\}/g, formatBRL(cob.valor))
      .replace(/\{vencimento\}/g, formatDateBR(cob.vencimento));

    window.open(buildWhatsAppLink(cli.telefone, texto), '_blank', 'noopener,noreferrer');
  };

  const handleSaveContato = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contatoCob || !resumoContato.trim()) return;
    addContatoCliente({
      clienteId: contatoCob.clienteId,
      cobrancaId: contatoCob.id,
      data: HOJE_DEMO,
      canal,
      resumo: resumoContato.trim(),
      responsavel: state.configuracoes.usuario.nome,
    });
    atualizarNegociacaoCobranca(contatoCob.id, novoStatusNeg);
    setContatoCob(null);
    setResumoContato('');
  };

  const handleSavePromessa = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promessaCob || !dataPromessa) return;
    addContatoCliente({
      clienteId: promessaCob.clienteId,
      cobrancaId: promessaCob.id,
      data: HOJE_DEMO,
      canal: 'WhatsApp',
      resumo:
        obsPromessa.trim() ||
        `Cliente informou previsão de pagamento para ${formatDateBR(dataPromessa)}.`,
      promessaPagamentoData: dataPromessa,
      responsavel: state.configuracoes.usuario.nome,
    });
    atualizarNegociacaoCobranca(promessaCob.id, 'promessa_pagamento');
    setPromessaCob(null);
    setObsPromessa('');
  };

  const handleSaveModelos = (e: React.FormEvent) => {
    e.preventDefault();
    updateConfiguracoes({
      ...state.configuracoes,
      modelosMensagem: modelosDraft,
    });
    setModelosOpen(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Inadimplência e acompanhamento
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Conduza negociações cordiais, registre promessas de pagamento e envie lembretes via WhatsApp.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setModelosDraft(state.configuracoes.modelosMensagem);
            setModelosOpen(true);
          }}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors whitespace-nowrap self-start sm:self-auto"
        >
          <Settings2 className="w-4 h-4 text-slate-500" />
          <span>Modelos de lembrete</span>
        </button>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Total em atraso</p>
          <p className="text-lg font-bold text-rose-700 mt-1 tabular-nums">
            {formatBRL(totalEmAtraso)}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Cobranças vencidas</p>
          <p className="text-lg font-bold text-slate-900 mt-1 tabular-nums">
            {state.cobrancas.filter((c) => c.status === 'vencida').length} ocorrência(s)
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Com promessa ou acordo</p>
          <p className="text-lg font-bold text-teal-700 mt-1 tabular-nums">
            {
              state.cobrancas.filter(
                (c) =>
                  c.status === 'vencida' &&
                  (c.negociacaoStatus === 'promessa_pagamento' ||
                    c.negociacaoStatus === 'acordo_firmado')
              ).length
            }{' '}
            em negociação
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-slate-500 mr-1">Negociação:</span>
          {(
            [
              { id: 'todos', label: 'Todas' },
              { id: 'sem_contato', label: 'Sem contato' },
              { id: 'em_contato', label: 'Em contato' },
              { id: 'promessa_pagamento', label: 'Promessa de pagamento' },
              { id: 'acordo_firmado', label: 'Acordo firmado' },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFiltroNegociacao(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                filtroNegociacao === f.id
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500">Dias em atraso:</span>
          <select
            value={filtroDias}
            onChange={(e) => setFiltroDias(e.target.value as 'todos' | '1-15' | '16-30' | '30+')}
            className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50"
          >
            <option value="todos">Qualquer faixa</option>
            <option value="1-15">1 a 15 dias</option>
            <option value="16-30">16 a 30 dias</option>
            <option value="30+">Acima de 30 dias</option>
          </select>
        </div>
      </div>

      {/* Tabela */}
      {cobrancasVencidas.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title="Nenhuma cobrança vencida neste filtro"
          description="Excelente! Não há títulos vencidos correspondentes aos filtros selecionados."
        />
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <th className="py-3 px-4 font-semibold">Cliente</th>
                <th className="py-3 px-4 font-semibold">Cobrança</th>
                <th className="py-3 px-4 font-semibold">Vencimento</th>
                <th className="py-3 px-4 font-semibold">Atraso</th>
                <th className="py-3 px-4 font-semibold">Último contato</th>
                <th className="py-3 px-4 font-semibold">Situação da negociação</th>
                <th className="py-3 px-4 font-semibold text-right">Valor vencido</th>
                <th className="py-3 px-4 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cobrancasVencidas.map((cob) => {
                const cli = state.clientes.find((c) => c.id === cob.clienteId);
                const diasAtraso = Math.max(1, diffDaysFromToday(cob.vencimento));
                const ultimoContato = getUltimoContatoCliente(cob.clienteId);
                const negStatus = cob.negociacaoStatus || 'sem_contato';
                const negMeta = NEGOCIACAO_LABELS[negStatus];

                return (
                  <tr key={cob.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-900 whitespace-nowrap">
                        {cli?.nome || 'Cliente'}
                      </p>
                      <p className="text-[11px] text-slate-500">{cli?.telefone}</p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-mono font-semibold text-slate-900">{cob.identificador}</p>
                      <p className="text-[11px] text-slate-500 max-w-[210px] truncate">
                        {cob.referencia}
                      </p>
                    </td>
                    <td className="py-3 px-4 tabular-nums text-slate-700 whitespace-nowrap">
                      {formatDateBR(cob.vencimento)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-semibold text-rose-700 tabular-nums">
                        {diasAtraso} dia(s)
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-[200px]">
                      {ultimoContato ? (
                        <div>
                          <span className="font-medium text-slate-800">
                            {formatDateBR(ultimoContato.data)} · {ultimoContato.canal}
                          </span>
                          <p className="text-[11px] text-slate-500 truncate">
                            {ultimoContato.resumo}
                          </p>
                        </div>
                      ) : (
                        <span className="text-slate-400">Nenhum contato</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge label={negMeta.label} variant={negMeta.variant} />
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-rose-700 tabular-nums whitespace-nowrap">
                      {formatBRL(cob.valor)}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenWhatsAppEducado(cob)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                          title="Enviar lembrete cordial via WhatsApp"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setContatoCob(cob);
                            setNovoStatusNeg(cob.negociacaoStatus || 'em_contato');
                          }}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-teal-700 hover:bg-teal-50 transition-colors"
                          title="Registrar contato"
                        >
                          <MessageSquarePlus className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPromessaCob(cob)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-amber-700 hover:bg-amber-50 transition-colors"
                          title="Registrar promessa de pagamento"
                        >
                          <CalendarCheck2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setHistoricoCob(cob)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                          title="Histórico de contatos"
                        >
                          <History className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => marcarCobrancaPaga(cob.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                          title="Marcar como paga (Demo)"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Histórico de Contatos */}
      <Modal
        open={!!historicoCob}
        onClose={() => setHistoricoCob(null)}
        title={`Histórico de negociação · ${historicoCob?.identificador || ''}`}
        subtitle={historicoCob?.referencia}
        size="md"
      >
        {historicoCob && (
          <div className="space-y-3 text-xs">
            {(() => {
              const contatosCliente = state.contatos
                .filter((ct) => ct.clienteId === historicoCob.clienteId)
                .sort((a, b) => b.data.localeCompare(a.data));
              if (contatosCliente.length === 0) {
                return (
                  <p className="text-slate-500 py-6 text-center">
                    Ainda não há contatos registrados para este cliente.
                  </p>
                );
              }
              return (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
                  {contatosCliente.map((ct) => (
                    <div key={ct.id} className="p-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-900">{ct.canal}</span>
                        <span className="text-[11px] text-slate-400 tabular-nums">
                          {formatDateBR(ct.data)} · {ct.responsavel}
                        </span>
                      </div>
                      <p className="text-slate-700 mt-1">{ct.resumo}</p>
                      {ct.promessaPagamentoData && (
                        <p className="text-[11px] font-medium text-amber-700 mt-1.5">
                          Promessa registrada para: {formatDateBR(ct.promessaPagamentoData)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}
      </Modal>

      {/* Modal Registrar Contato */}
      <Modal
        open={!!contatoCob}
        onClose={() => setContatoCob(null)}
        title="Registrar contato de cobrança"
        subtitle={contatoCob?.identificador}
        size="md"
      >
        <form onSubmit={handleSaveContato} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Canal</label>
              <select
                value={canal}
                onChange={(e) =>
                  setCanal(e.target.value as 'WhatsApp' | 'Ligação' | 'E-mail' | 'Presencial')
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
              >
                <option value="WhatsApp">WhatsApp</option>
                <option value="Ligação">Ligação</option>
                <option value="E-mail">E-mail</option>
                <option value="Presencial">Presencial</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Situação da negociação
              </label>
              <select
                value={novoStatusNeg}
                onChange={(e) => setNovoStatusNeg(e.target.value as StatusNegociacao)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
              >
                <option value="em_contato">Em contato</option>
                <option value="promessa_pagamento">Promessa de pagamento</option>
                <option value="acordo_firmado">Acordo firmado</option>
                <option value="sem_contato">Sem contato</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Resumo da conversa *</label>
            <textarea
              rows={3}
              required
              value={resumoContato}
              onChange={(e) => setResumoContato(e.target.value)}
              placeholder="Ex: Cliente solicitou envio da segunda via por WhatsApp e informou que pagará sexta-feira."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setContatoCob(null)}
              className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-semibold"
            >
              Salvar registro
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Promessa de Pagamento */}
      <Modal
        open={!!promessaCob}
        onClose={() => setPromessaCob(null)}
        title="Registrar promessa de pagamento"
        subtitle={`${promessaCob?.identificador || ''} · ${formatBRL(promessaCob?.valor || 0)}`}
        size="sm"
      >
        <form onSubmit={handleSavePromessa} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Data combinada *</label>
            <input
              type="date"
              required
              value={dataPromessa}
              onChange={(e) => setDataPromessa(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Observação</label>
            <textarea
              rows={2}
              value={obsPromessa}
              onChange={(e) => setObsPromessa(e.target.value)}
              placeholder="Detalhes do combinado com o cliente..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setPromessaCob(null)}
              className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-semibold"
            >
              Confirmar promessa
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Editor de Modelos de Mensagem */}
      <Modal
        open={modelosOpen}
        onClose={() => setModelosOpen(false)}
        title="Modelos de mensagem de lembrete"
        subtitle="Personalize os textos pré-preenchidos para envio via WhatsApp. Use {nome}, {referencia}, {valor} e {vencimento}."
        size="lg"
      >
        <form onSubmit={handleSaveModelos} className="space-y-4 text-xs">
          {modelosDraft.map((modelo, idx) => (
            <div key={modelo.id} className="border border-slate-200 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-900">{modelo.titulo}</span>
                <span className="text-[11px] text-slate-500 capitalize">{modelo.tipo}</span>
              </div>
              <textarea
                rows={3}
                value={modelo.texto}
                onChange={(e) => {
                  const next = [...modelosDraft];
                  next[idx] = { ...modelo, texto: e.target.value };
                  setModelosDraft(next);
                }}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>
          ))}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setModelosOpen(false)}
              className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-semibold"
            >
              Salvar modelos
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
