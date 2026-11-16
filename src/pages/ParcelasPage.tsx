import React, { useState, useMemo } from 'react';
import {
  Search,
  CheckCircle2,
  SlidersHorizontal,
  GitCommitHorizontal,
  CalendarPlus,
  CalendarClock,
} from 'lucide-react';
import { useRecebeFacil } from '../context/RecebeFacilContext';
import { FormaPagamento, Parcela, Periodicidade, StatusParcela } from '../types/recebefacil';
import { formatBRL, formatDateBR, HOJE_DEMO, addPeriodToDate } from '../utils/formatters';
import { getParcelaStatusBadge } from '../components/ui/StatusBadge';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';

export const ParcelasPage: React.FC = () => {
  const { state, registrarPagamentoParcela, ajustarParcela, gerarParcelasParaVenda } =
    useRecebeFacil();

  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<'todos' | StatusParcela>('todos');

  // Modal Registrar Pagamento
  const [pagamentoParcela, setPagamentoParcela] = useState<Parcela | null>(null);
  const [pgValor, setPgValor] = useState('');
  const [pgData, setPgData] = useState(HOJE_DEMO);
  const [pgForma, setPgForma] = useState<FormaPagamento>('Pix');
  const [pgObs, setPgObs] = useState('');

  // Modal Ajustar Valor/Vencimento
  const [ajusteParcela, setAjusteParcela] = useState<Parcela | null>(null);
  const [ajValor, setAjValor] = useState('');
  const [ajVencimento, setAjVencimento] = useState('');

  // Modal Linha do Tempo do Parcelamento
  const [timelineRefVendaId, setTimelineRefVendaId] = useState<string | null>(null);

  // Modal Gerar Parcelas Automaticamente
  const [geradorOpen, setGeradorOpen] = useState(false);
  const [gVendaId, setGVendaId] = useState(state.vendas[0]?.id || '');
  const [gEntrada, setGEntrada] = useState('0');
  const [gQtd, setGQtd] = useState('4');
  const [gPrimeiroVenc, setGPrimeiroVenc] = useState(addPeriodToDate(HOJE_DEMO, 'mensal', 1));
  const [gPeriodicidade, setGPeriodicidade] = useState<Periodicidade>('mensal');

  const filteredParcelas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return state.parcelas
      .filter((p) => {
        if (filtroStatus !== 'todos' && p.status !== filtroStatus) return false;
        if (!q) return true;
        const cli = state.clientes.find((c) => c.id === p.clienteId);
        return (
          p.referenciaLabel.toLowerCase().includes(q) ||
          (cli && cli.nome.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  }, [state.parcelas, state.clientes, busca, filtroStatus]);

  const handleOpenPagamento = (p: Parcela) => {
    const saldo = Math.max(0, p.valor - p.valorPago);
    setPagamentoParcela(p);
    setPgValor(saldo.toFixed(2));
    setPgData(HOJE_DEMO);
    setPgForma('Pix');
    setPgObs('');
  };

  const handleSubmitPagamento = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pagamentoParcela) return;
    const val = parseFloat(pgValor.replace(',', '.')) || 0;
    if (val <= 0) return;
    registrarPagamentoParcela(pagamentoParcela.id, val, pgData, pgForma, pgObs);
    setPagamentoParcela(null);
  };

  const handleOpenAjuste = (p: Parcela) => {
    setAjusteParcela(p);
    setAjValor(String(p.valor));
    setAjVencimento(p.vencimento);
  };

  const handleSubmitAjuste = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ajusteParcela) return;
    const val = parseFloat(ajValor.replace(',', '.')) || 0;
    if (val <= 0 || !ajVencimento) return;
    ajustarParcela(ajusteParcela.id, val, ajVencimento);
    setAjusteParcela(null);
  };

  const handleSubmitGerador = (e: React.FormEvent) => {
    e.preventDefault();
    if (!gVendaId) return;
    const entrada = parseFloat(gEntrada.replace(',', '.')) || 0;
    const qtd = Math.max(1, parseInt(gQtd, 10) || 1);
    gerarParcelasParaVenda(gVendaId, entrada, qtd, gPrimeiroVenc, gPeriodicidade);
    setGeradorOpen(false);
  };

  // Resumo rápido de parcelas
  const resumo = useMemo(() => {
    const pendentes = state.parcelas.filter((p) => p.status === 'pendente' || p.status === 'parcialmente_paga');
    const vencidas = state.parcelas.filter((p) => p.status === 'vencida');
    const pagas = state.parcelas.filter((p) => p.status === 'paga');
    return {
      aVencerValor: pendentes.reduce((acc, p) => acc + Math.max(0, p.valor - p.valorPago), 0),
      vencidasValor: vencidas.reduce((acc, p) => acc + Math.max(0, p.valor - p.valorPago), 0),
      pagasValor: pagas.reduce((acc, p) => acc + p.valorPago, 0),
    };
  }, [state.parcelas]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Parcelas</h1>
            <span className="text-[11px] font-medium text-slate-500 border border-slate-200 bg-white px-2 py-0.5 rounded-md">
              Parcelamentos finitos
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Controle entradas, vencimentos, baixas parciais ou totais e cronogramas de vendas parceladas.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setGeradorOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold transition-colors whitespace-nowrap self-start sm:self-auto"
        >
          <CalendarPlus className="w-4 h-4" />
          <span>Gerar parcelamento</span>
        </button>
      </div>

      {/* Resumo do Parcelamento */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Parcelas já recebidas</p>
          <p className="text-lg font-bold text-emerald-700 mt-1 tabular-nums">
            {formatBRL(resumo.pagasValor)}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Parcelas a vencer</p>
          <p className="text-lg font-bold text-slate-900 mt-1 tabular-nums">
            {formatBRL(resumo.aVencerValor)}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Saldo vencido em parcelas</p>
          <p className="text-lg font-bold text-rose-600 mt-1 tabular-nums">
            {formatBRL(resumo.vencidasValor)}
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
            placeholder="Pesquisar por cliente, venda ou contrato..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-teal-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'todos', label: 'Todas' },
              { id: 'pendente', label: 'Pendentes' },
              { id: 'vencida', label: 'Vencidas' },
              { id: 'parcialmente_paga', label: 'Parciais' },
              { id: 'paga', label: 'Pagas' },
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

      {/* Tabela de Parcelas */}
      {filteredParcelas.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="Nenhuma parcela encontrada"
          description="Ajuste os filtros ou gere um novo cronograma de parcelamento para uma venda."
          actionLabel="Gerar parcelamento"
          onAction={() => setGeradorOpen(true)}
        />
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <th className="py-3 px-4 font-semibold">Parcela</th>
                <th className="py-3 px-4 font-semibold">Cliente</th>
                <th className="py-3 px-4 font-semibold">Venda / Contrato</th>
                <th className="py-3 px-4 font-semibold">Vencimento</th>
                <th className="py-3 px-4 font-semibold text-right">Valor</th>
                <th className="py-3 px-4 font-semibold text-right">Valor pago</th>
                <th className="py-3 px-4 font-semibold text-right">Saldo</th>
                <th className="py-3 px-4 font-semibold">Situação</th>
                <th className="py-3 px-4 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredParcelas.map((p) => {
                const cli = state.clientes.find((c) => c.id === p.clienteId);
                const saldo = Math.max(0, p.valor - p.valorPago);

                return (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                      {p.numeroParcela === 0 ? 'Entrada' : `${p.numeroParcela}/${p.totalParcelas}`}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                      {cli?.nome || 'Cliente'}
                    </td>
                    <td className="py-3 px-4 text-slate-700 max-w-xs truncate">
                      {p.referenciaLabel}
                    </td>
                    <td className="py-3 px-4 tabular-nums text-slate-600 whitespace-nowrap">
                      {formatDateBR(p.vencimento)}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-slate-900 whitespace-nowrap">
                      {formatBRL(p.valor)}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-emerald-700 font-medium whitespace-nowrap">
                      {formatBRL(p.valorPago)}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums font-bold text-slate-900 whitespace-nowrap">
                      {formatBRL(saldo)}
                    </td>
                    <td className="py-3 px-4">{getParcelaStatusBadge(p.status)}</td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        {p.vendaId && (
                          <button
                            type="button"
                            onClick={() => setTimelineRefVendaId(p.vendaId!)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                            title="Linha do tempo do parcelamento"
                          >
                            <GitCommitHorizontal className="w-4 h-4" />
                          </button>
                        )}
                        {p.status !== 'paga' && p.status !== 'cancelada' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOpenAjuste(p)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                              title="Ajustar valor ou vencimento"
                            >
                              <SlidersHorizontal className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenPagamento(p)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold border border-emerald-200 transition-colors"
                              title="Registrar pagamento"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Baixar</span>
                            </button>
                          </>
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

      {/* Modal Registrar Pagamento */}
      <Modal
        open={!!pagamentoParcela}
        onClose={() => setPagamentoParcela(null)}
        title="Registrar pagamento da parcela"
        subtitle={pagamentoParcela?.referenciaLabel}
        size="sm"
      >
        <form onSubmit={handleSubmitPagamento} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Valor recebido (R$) *</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={pgValor}
              onChange={(e) => setPgValor(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg tabular-nums font-semibold"
            />
            {pagamentoParcela && (
              <p className="text-[11px] text-slate-500 mt-1 tabular-nums">
                Saldo atual da parcela: {formatBRL(Math.max(0, pagamentoParcela.valor - pagamentoParcela.valorPago))}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Data do pagamento</label>
              <input
                type="date"
                value={pgData}
                onChange={(e) => setPgData(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Forma</label>
              <select
                value={pgForma}
                onChange={(e) => setPgForma(e.target.value as FormaPagamento)}
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

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Observação</label>
            <input
              type="text"
              value={pgObs}
              onChange={(e) => setPgObs(e.target.value)}
              placeholder="Ex: Comprovante enviado via WhatsApp"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setPagamentoParcela(null)}
              className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              Confirmar recebimento
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Ajustar Parcela */}
      <Modal
        open={!!ajusteParcela}
        onClose={() => setAjusteParcela(null)}
        title="Ajustar valor e vencimento"
        subtitle={ajusteParcela?.referenciaLabel}
        size="sm"
      >
        <form onSubmit={handleSubmitAjuste} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Novo valor (R$)</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={ajValor}
              onChange={(e) => setAjValor(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg tabular-nums"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Novo vencimento</label>
            <input
              type="date"
              required
              value={ajVencimento}
              onChange={(e) => setAjVencimento(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setAjusteParcela(null)}
              className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-semibold"
            >
              Salvar ajuste
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Gerador Automático de Parcelamento */}
      <Modal
        open={geradorOpen}
        onClose={() => setGeradorOpen(false)}
        title="Gerar parcelamento automaticamente"
        subtitle="Selecione uma venda para criar ou recalcular o cronograma de entrada e parcelas."
        size="md"
      >
        <form onSubmit={handleSubmitGerador} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Venda de referência *</label>
            <select
              value={gVendaId}
              onChange={(e) => setGVendaId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
            >
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Valor de entrada (R$)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={gEntrada}
                onChange={(e) => setGEntrada(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg tabular-nums"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Quantidade de parcelas</label>
              <input
                type="number"
                min="1"
                max="48"
                value={gQtd}
                onChange={(e) => setGQtd(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg tabular-nums"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">1º vencimento</label>
              <input
                type="date"
                value={gPrimeiroVenc}
                onChange={(e) => setGPrimeiroVenc(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Periodicidade</label>
              <select
                value={gPeriodicidade}
                onChange={(e) => setGPeriodicidade(e.target.value as Periodicidade)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
              >
                <option value="semanal">Semanal</option>
                <option value="quinzenal">Quinzenal</option>
                <option value="mensal">Mensal</option>
                <option value="trimestral">Trimestral</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setGeradorOpen(false)}
              className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-semibold"
            >
              Gerar cronograma
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Linha do Tempo Detalhada do Parcelamento */}
      <Modal
        open={!!timelineRefVendaId}
        onClose={() => setTimelineRefVendaId(null)}
        title="Linha do tempo do parcelamento"
        subtitle="Acompanhamento sequencial de entrada, parcelas e baixas registradas"
        size="lg"
      >
        {timelineRefVendaId && (
          <div className="space-y-4 text-xs">
            {(() => {
              const venda = state.vendas.find((v) => v.id === timelineRefVendaId);
              const cli = venda ? state.clientes.find((c) => c.id === venda.clienteId) : null;
              const parcelasVenda = state.parcelas
                .filter((p) => p.vendaId === timelineRefVendaId)
                .sort((a, b) => a.numeroParcela - b.numeroParcela);

              return (
                <>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-slate-900 text-sm">
                        {venda?.codigo} · {cli?.nome}
                      </p>
                      <p className="text-slate-500 mt-0.5">
                        {venda?.itens.map((i) => i.descricao).join(', ')}
                      </p>
                    </div>
                    <div className="text-right tabular-nums">
                      <p className="text-slate-500">Valor total da venda</p>
                      <p className="text-base font-bold text-slate-900">
                        {formatBRL(venda?.valorTotal || 0)}
                      </p>
                    </div>
                  </div>

                  <div className="relative pl-6 space-y-4 before:content-[''] before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-px before:bg-slate-200">
                    {parcelasVenda.map((p) => (
                      <div key={p.id} className="relative">
                        <span
                          className={`absolute -left-[19px] top-1.5 w-3 h-3 rounded-full border-2 border-white ${
                            p.status === 'paga'
                              ? 'bg-emerald-600'
                              : p.status === 'vencida'
                              ? 'bg-rose-600'
                              : p.status === 'parcialmente_paga'
                              ? 'bg-sky-600'
                              : 'bg-amber-500'
                          }`}
                        />
                        <div className="border border-slate-200 rounded-xl p-3.5 bg-white">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 tabular-nums">
                                {p.numeroParcela === 0
                                  ? 'Entrada'
                                  : `Parcela ${p.numeroParcela}/${p.totalParcelas}`}
                              </span>
                              <span className="text-slate-400">·</span>
                              <span className="text-slate-500 tabular-nums">
                                Vencimento: {formatDateBR(p.vencimento)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 tabular-nums">
                                {formatBRL(p.valor)}
                              </span>
                              {getParcelaStatusBadge(p.status)}
                            </div>
                          </div>

                          {p.historicoPagamentos.length > 0 && (
                            <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-1">
                              {p.historicoPagamentos.map((pg) => (
                                <div
                                  key={pg.id}
                                  className="flex items-center justify-between text-[11px] text-emerald-700"
                                >
                                  <span>
                                    Pagamento em {formatDateBR(pg.data)} ({pg.forma})
                                    {pg.observacao ? ` — ${pg.observacao}` : ''}
                                  </span>
                                  <span className="font-semibold tabular-nums">
                                    +{formatBRL(pg.valor)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
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
