import React, { useState, useMemo } from 'react';
import {
  Download,
  Printer,
  BarChart3,
  Users,
  FileText,
  Repeat,
  Wallet,
  Calendar,
} from 'lucide-react';
import { useRecebeFacil } from '../context/RecebeFacilContext';
import {
  formatBRL,
  formatDateBR,
  HOJE_DEMO,
  downloadCsvDemonstrativo,
} from '../utils/formatters';
import { getContratoSituacaoBadge, getRecorrenciaStatusBadge } from '../components/ui/StatusBadge';

export const RelatoriosPage: React.FC = () => {
  const { state, clientesComMetricas, showToast } = useRecebeFacil();

  const [dataInicio, setDataInicio] = useState('2026-08-01');
  const [dataFim, setDataFim] = useState(HOJE_DEMO);

  // 1. Vendas por período
  const vendasPeriodo = useMemo(() => {
    return state.vendas.filter(
      (v) => v.situacao !== 'cancelada' && v.data >= dataInicio && v.data <= dataFim
    );
  }, [state.vendas, dataInicio, dataFim]);

  const totalVendidoPeriodo = useMemo(
    () => vendasPeriodo.reduce((acc, v) => acc + v.valorTotal, 0),
    [vendasPeriodo]
  );

  // 2. Recebimentos por período (cobranças pagas no período)
  const recebimentosPeriodo = useMemo(() => {
    return state.cobrancas.filter(
      (c) =>
        c.status === 'paga' &&
        (c.dataConfirmacao || c.vencimento) >= dataInicio &&
        (c.dataConfirmacao || c.vencimento) <= dataFim
    );
  }, [state.cobrancas, dataInicio, dataFim]);

  // 3. Valores a receber e vencidos (consolidado atual)
  const consolidadoFinanceiro = useMemo(() => {
    const aReceber = clientesComMetricas.reduce((acc, c) => acc + c.saldoEmAberto, 0);
    const vencidos = state.parcelas
      .filter((p) => p.status === 'vencida')
      .reduce((acc, p) => acc + Math.max(0, p.valor - p.valorPago), 0);
    const recebidoGeral = clientesComMetricas.reduce((acc, c) => acc + c.totalPago, 0);
    return { aReceber, vencidos, recebidoGeral };
  }, [clientesComMetricas, state.parcelas]);

  // 4. Vendas por produto / serviço
  const vendasPorItem = useMemo(() => {
    const mapa = new Map<
      string,
      { nome: string; tipo: string; quantidade: number; total: number }
    >();
    vendasPeriodo.forEach((v) => {
      v.itens.forEach((item) => {
        const key = item.descricao;
        const curr = mapa.get(key) || {
          nome: item.descricao,
          tipo: item.tipoCatalogo === 'produto' ? 'Produto' : 'Serviço',
          quantidade: 0,
          total: 0,
        };
        curr.quantidade += item.quantidade;
        curr.total += item.quantidade * item.valorUnitario;
        mapa.set(key, curr);
      });
    });
    return Array.from(mapa.values()).sort((a, b) => b.total - a.total);
  }, [vendasPeriodo]);

  // 5. Recebimentos por forma de pagamento
  const recebimentosPorForma = useMemo(() => {
    const mapa = new Map<string, { forma: string; qtd: number; total: number }>();
    recebimentosPeriodo.forEach((c) => {
      const curr = mapa.get(c.formaPagamento) || {
        forma: c.formaPagamento,
        qtd: 0,
        total: 0,
      };
      curr.qtd += 1;
      curr.total += c.valor;
      mapa.set(c.formaPagamento, curr);
    });
    const arr = Array.from(mapa.values()).sort((a, b) => b.total - a.total);
    const sum = arr.reduce((acc, r) => acc + r.total, 0) || 1;
    return arr.map((r) => ({ ...r, pct: Math.round((r.total / sum) * 100) }));
  }, [recebimentosPeriodo]);

  // 6. Clientes com maior volume de compras
  const topClientes = useMemo(() => {
    return [...clientesComMetricas].sort((a, b) => b.totalComprado - a.totalComprado);
  }, [clientesComMetricas]);

  // 7. Contratos ativos e Recorrências ativas
  const contratosAtivos = useMemo(
    () => state.contratos.filter((c) => c.situacao === 'ativo'),
    [state.contratos]
  );

  const recorrenciasAtivas = useMemo(
    () => state.recorrencias.filter((r) => r.status === 'ativa'),
    [state.recorrencias]
  );

  const handleExportCsv = () => {
    downloadCsvDemonstrativo(
      `recebefacil-relatorio-vendas-${dataInicio}-a-${dataFim}.csv`,
      ['Código', 'Data', 'Cliente', 'Tipo', 'Forma', 'Situação', 'Valor Total (R$)'],
      vendasPeriodo.map((v) => {
        const cli = state.clientes.find((c) => c.id === v.clienteId);
        return [
          v.codigo,
          formatDateBR(v.data),
          cli?.nome || '',
          v.tipoRecebimento,
          v.formaRecebimento,
          v.situacao,
          v.valorTotal.toFixed(2).replace('.', ','),
        ];
      })
    );
    showToast('CSV gerado a partir dos dados demonstrativos.');
  };

  const handleVisualPrint = () => {
    showToast(
      'Modo de impressão visual acionado. Exportações PDF oficiais em lote dependem de servidor backend.',
      'info'
    );
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Relatórios gerenciais
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Consolidado analítico de vendas, recebimentos, inadimplência, clientes e contratos em ambiente demonstrativo.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="focus:outline-none text-slate-700"
            />
            <span className="text-slate-400">até</span>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="focus:outline-none text-slate-700"
            />
          </div>

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-teal-700" />
            <span>Exportar CSV (dados demonstrativos)</span>
          </button>

          <button
            type="button"
            onClick={handleVisualPrint}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimir / Salvar PDF (Visual)</span>
          </button>
        </div>
      </div>

      {/* KPIs Consolidados (Vendas, Recebimentos, A receber, Vencidos) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Vendas no período selecionado</p>
          <p className="text-xl font-bold text-slate-900 mt-1 tabular-nums">
            {formatBRL(totalVendidoPeriodo)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1 tabular-nums">
            {vendasPeriodo.length} venda(s) registrada(s)
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Total recebido (carteira geral)</p>
          <p className="text-xl font-bold text-emerald-700 mt-1 tabular-nums">
            {formatBRL(consolidadoFinanceiro.recebidoGeral)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1 tabular-nums">
            {recebimentosPeriodo.length} cobrança(s) liquidadas no filtro
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Valores a receber (em aberto)</p>
          <p className="text-xl font-bold text-slate-900 mt-1 tabular-nums">
            {formatBRL(consolidadoFinanceiro.aReceber)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Inclui parcelas futuras e vencidas</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Valores vencidos atualmente</p>
          <p className="text-xl font-bold text-rose-700 mt-1 tabular-nums">
            {formatBRL(consolidadoFinanceiro.vencidos)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            {state.parcelas.filter((p) => p.status === 'vencida').length} parcela(s) em atraso
          </p>
        </div>
      </div>

      {/* Vendas por produto/serviço & Recebimentos por forma de pagamento */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-teal-700" />
            <h2 className="text-sm font-bold text-slate-900">Vendas por produto e serviço</h2>
          </div>
          {vendasPorItem.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">
              Nenhuma venda encontrada no período selecionado.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 pr-3 font-semibold">Item</th>
                    <th className="py-2 px-2 font-semibold">Tipo</th>
                    <th className="py-2 px-2 font-semibold text-right">Qtd</th>
                    <th className="py-2 pl-2 font-semibold text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {vendasPorItem.map((item, i) => (
                    <tr key={i}>
                      <td className="py-2.5 pr-3 font-medium text-slate-900">{item.nome}</td>
                      <td className="py-2.5 px-2 text-slate-500">{item.tipo}</td>
                      <td className="py-2.5 px-2 text-right tabular-nums text-slate-700">
                        {item.quantidade}
                      </td>
                      <td className="py-2.5 pl-2 text-right font-semibold tabular-nums text-slate-900">
                        {formatBRL(item.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Wallet className="w-4 h-4 text-teal-700" />
            <h2 className="text-sm font-bold text-slate-900">
              Recebimentos por forma de pagamento
            </h2>
          </div>
          {recebimentosPorForma.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">
              Nenhum recebimento confirmado no período selecionado.
            </p>
          ) : (
            <div className="space-y-3.5">
              {recebimentosPorForma.map((r) => (
                <div key={r.forma}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-slate-800">
                      {r.forma}{' '}
                      <span className="text-slate-400 font-normal">({r.qtd} cob.)</span>
                    </span>
                    <span className="font-bold text-slate-900 tabular-nums">
                      {formatBRL(r.total)}{' '}
                      <span className="text-slate-400 font-normal">({r.pct}%)</span>
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-teal-700 rounded-full"
                      style={{ width: `${r.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Ranking de clientes */}
      <section className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-4 h-4 text-teal-700" />
          <h2 className="text-sm font-bold text-slate-900">
            Clientes com maior volume de compras
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2.5 pr-4 font-semibold">Cliente</th>
                <th className="py-2.5 px-4 font-semibold">Cidade</th>
                <th className="py-2.5 px-4 font-semibold text-right">Total comprado</th>
                <th className="py-2.5 px-4 font-semibold text-right">Total pago</th>
                <th className="py-2.5 pl-4 font-semibold text-right">Saldo em aberto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {topClientes.map((cli) => (
                <tr key={cli.id}>
                  <td className="py-2.5 pr-4 font-semibold text-slate-900">{cli.nome}</td>
                  <td className="py-2.5 px-4 text-slate-500">{cli.cidade || '—'}</td>
                  <td className="py-2.5 px-4 text-right font-semibold tabular-nums text-slate-900">
                    {formatBRL(cli.totalComprado)}
                  </td>
                  <td className="py-2.5 px-4 text-right tabular-nums text-emerald-700">
                    {formatBRL(cli.totalPago)}
                  </td>
                  <td className="py-2.5 pl-4 text-right tabular-nums text-slate-700">
                    {formatBRL(cli.saldoEmAberto)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Contratos ativos e Recorrências ativas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-teal-700" />
              <h2 className="text-sm font-bold text-slate-900">
                Contratos ativos ({contratosAtivos.length})
              </h2>
            </div>
          </div>
          <div className="divide-y divide-slate-100 text-xs">
            {contratosAtivos.map((ctr) => {
              const cli = state.clientes.find((c) => c.id === ctr.clienteId);
              return (
                <div key={ctr.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 truncate">
                      {ctr.numero} · {cli?.nome}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">{ctr.descricao}</p>
                  </div>
                  <div className="text-right shrink-0 flex items-center gap-2">
                    <span className="font-bold tabular-nums text-slate-900">
                      {formatBRL(ctr.valorTotal)}
                    </span>
                    {getContratoSituacaoBadge(ctr.situacao)}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Repeat className="w-4 h-4 text-teal-700" />
              <h2 className="text-sm font-bold text-slate-900">
                Recorrências ativas ({recorrenciasAtivas.length})
              </h2>
            </div>
          </div>
          <div className="divide-y divide-slate-100 text-xs">
            {recorrenciasAtivas.map((rec) => {
              const cli = state.clientes.find((c) => c.id === rec.clienteId);
              return (
                <div key={rec.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 truncate">
                      {rec.codigo} · {cli?.nome}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {rec.descricaoServico} · Próx. {formatDateBR(rec.proximaCobranca)}
                    </p>
                  </div>
                  <div className="text-right shrink-0 flex items-center gap-2">
                    <span className="font-bold tabular-nums text-slate-900">
                      {formatBRL(rec.valor)}
                    </span>
                    {getRecorrenciaStatusBadge(rec.status)}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};
