import React, { useState, useMemo } from 'react';
import {
  UserPlus,
  ShoppingCart,
  Receipt,
  ArrowUpRight,
  Calendar,
  AlertCircle,
  Clock,
  FileText,
  Repeat,
  TrendingUp,
} from 'lucide-react';
import { useRecebeFacil } from '../context/RecebeFacilContext';
import { MenuRoute, FormaPagamento } from '../types/recebefacil';
import { formatBRL, formatDateBR, HOJE_DEMO, addPeriodToDate } from '../utils/formatters';
import { getVendaSituacaoBadge } from '../components/ui/StatusBadge';

interface VisaoGeralPageProps {
  onNavigate: (route: MenuRoute, entityId?: string) => void;
  onQuickAction: (action: 'novo-cliente' | 'nova-venda' | 'nova-cobranca') => void;
}

type PeriodFilter = 'hoje' | '7d' | '30d' | 'mes_atual' | 'personalizado';

export const VisaoGeralPage: React.FC<VisaoGeralPageProps> = ({
  onNavigate,
  onQuickAction,
}) => {
  const { state, clientesComMetricas } = useRecebeFacil();
  const [period, setPeriod] = useState<PeriodFilter>('mes_atual');
  const [customStart, setCustomStart] = useState('2026-08-01');
  const [customEnd, setCustomEnd] = useState(HOJE_DEMO);
  const [hoveredBarIdx, setHoveredBarIdx] = useState<number | null>(null);

  // Intervalo ativo para filtro temporal de vendas e recebimentos
  const dateRange = useMemo(() => {
    if (period === 'hoje') return { start: HOJE_DEMO, end: HOJE_DEMO };
    if (period === '7d') return { start: '2026-11-09', end: HOJE_DEMO };
    if (period === '30d') return { start: '2026-10-17', end: HOJE_DEMO };
    if (period === 'mes_atual') return { start: '2026-11-01', end: '2026-11-30' };
    return { start: customStart, end: customEnd };
  }, [period, customStart, customEnd]);

  // Indicadores financeiros coerentes com o restante do sistema
  const kpis = useMemo(() => {
    const totalVendidoGeral = clientesComMetricas.reduce((acc, c) => acc + c.totalComprado, 0);
    const totalRecebidoGeral = clientesComMetricas.reduce((acc, c) => acc + c.totalPago, 0);
    const totalAReceberGeral = clientesComMetricas.reduce((acc, c) => acc + c.saldoEmAberto, 0);
    const totalEmAtraso = state.parcelas
      .filter((p) => p.status === 'vencida')
      .reduce((acc, p) => acc + Math.max(0, p.valor - p.valorPago), 0);

    const vendasNoPeriodo = state.vendas.filter(
      (v) =>
        v.situacao !== 'cancelada' &&
        v.data >= dateRange.start &&
        v.data <= dateRange.end
    );
    const valorVendasPeriodo = vendasNoPeriodo.reduce((acc, v) => acc + v.valorTotal, 0);

    const vendasNoMes = state.vendas.filter(
      (v) => v.situacao !== 'cancelada' && v.data.startsWith('2026-11')
    );

    const contratosAtivos = state.contratos.filter((c) => c.situacao === 'ativo').length;
    const recorrenciasAtivas = state.recorrencias.filter((r) => r.status === 'ativa').length;

    return {
      totalVendidoGeral,
      totalRecebidoGeral,
      totalAReceberGeral,
      totalEmAtraso,
      vendasNoPeriodoQtd: vendasNoPeriodo.length,
      valorVendasPeriodo,
      vendasNoMesQtd: vendasNoMes.length,
      vendasNoMesValor: vendasNoMes.reduce((acc, v) => acc + v.valorTotal, 0),
      contratosAtivos,
      recorrenciasAtivas,
    };
  }, [clientesComMetricas, state.parcelas, state.vendas, state.contratos, state.recorrencias, dateRange]);

  // Série temporal dos últimos 4 meses (Ago - Nov 2026) derivada dos dados reais do estado
  const monthlySeries = useMemo(() => {
    const months = [
      { key: '2026-08', label: 'Ago/26' },
      { key: '2026-09', label: 'Set/26' },
      { key: '2026-10', label: 'Out/26' },
      { key: '2026-11', label: 'Nov/26' },
    ];

    return months.map((m) => {
      const vendido = state.vendas
        .filter((v) => v.situacao !== 'cancelada' && v.data.startsWith(m.key))
        .reduce((acc, v) => acc + v.valorTotal, 0);

      // Recebido inclui pagamentos de parcelas no mês + vendas à vista/recorrentes pagas no mês
      const recebidoParcelas = state.parcelas
        .flatMap((p) => p.historicoPagamentos)
        .filter((pg) => pg.data.startsWith(m.key))
        .reduce((acc, pg) => acc + pg.valor, 0);

      const recebidoDireto = state.vendas
        .filter(
          (v) =>
            v.tipoRecebimento !== 'parcelado' &&
            v.situacao === 'paga' &&
            v.data.startsWith(m.key)
        )
        .reduce((acc, v) => acc + v.valorTotal, 0);

      return {
        label: m.label,
        vendido,
        recebido: recebidoParcelas + recebidoDireto,
      };
    });
  }, [state.vendas, state.parcelas]);

  const maxChartVal = useMemo(() => {
    const vals = monthlySeries.flatMap((d) => [d.vendido, d.recebido]);
    return Math.max(1000, ...vals);
  }, [monthlySeries]);

  // Recebimentos por forma de pagamento
  const paymentBreakdown = useMemo(() => {
    const formas: FormaPagamento[] = ['Pix', 'Boleto', 'Cartão de Crédito', 'Transferência', 'Dinheiro'];
    const map: Record<FormaPagamento, number> = {
      Pix: 0,
      Boleto: 0,
      'Cartão de Crédito': 0,
      Transferência: 0,
      Dinheiro: 0,
    };

    state.parcelas.forEach((p) => {
      p.historicoPagamentos.forEach((pg) => {
        map[pg.forma] = (map[pg.forma] || 0) + pg.valor;
      });
    });

    state.vendas
      .filter((v) => v.tipoRecebimento !== 'parcelado' && v.situacao === 'paga')
      .forEach((v) => {
        map[v.formaRecebimento] = (map[v.formaRecebimento] || 0) + v.valorTotal;
      });

    const total = Object.values(map).reduce((a, b) => a + b, 0) || 1;
    const colors: Record<FormaPagamento, string> = {
      Pix: 'bg-teal-600',
      Boleto: 'bg-slate-700',
      'Cartão de Crédito': 'bg-sky-600',
      Transferência: 'bg-indigo-600',
      Dinheiro: 'bg-emerald-500',
    };

    return formas
      .map((f) => ({
        forma: f,
        valor: map[f],
        percent: Math.round((map[f] / total) * 100),
        color: colors[f],
      }))
      .filter((item) => item.valor > 0 || item.forma === 'Pix' || item.forma === 'Boleto');
  }, [state.parcelas, state.vendas]);

  // Próximos vencimentos
  const proximosVencimentos = useMemo(() => {
    return state.cobrancas
      .filter((c) => c.status === 'pendente' && c.vencimento >= HOJE_DEMO)
      .sort((a, b) => a.vencimento.localeCompare(b.vencimento))
      .slice(0, 5);
  }, [state.cobrancas]);

  // Cobranças atrasadas
  const cobrancasAtrasadas = useMemo(() => {
    return state.cobrancas
      .filter((c) => c.status === 'vencida')
      .sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  }, [state.cobrancas]);

  // Últimas vendas
  const ultimasVendas = useMemo(() => {
    return [...state.vendas]
      .sort((a, b) => b.data.localeCompare(a.data))
      .slice(0, 5);
  }, [state.vendas]);

  return (
    <div className="space-y-6">
      {/* Cabeçalho da página e atalhos */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Visão geral financeira
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Acompanhe vendas, recebimentos, contratos e vencimentos em um único painel demonstrativo.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onQuickAction('novo-cliente')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors whitespace-nowrap"
          >
            <UserPlus className="w-3.5 h-3.5 text-slate-500" />
            <span>Cadastrar cliente</span>
          </button>
          <button
            type="button"
            onClick={() => onQuickAction('nova-cobranca')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors whitespace-nowrap"
          >
            <Receipt className="w-3.5 h-3.5 text-slate-500" />
            <span>Gerar cobrança</span>
          </button>
          <button
            type="button"
            onClick={() => onQuickAction('nova-venda')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold transition-colors whitespace-nowrap"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>Criar venda</span>
          </button>
        </div>
      </div>

      {/* Filtros de Período */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'hoje', label: 'Hoje' },
              { id: '7d', label: 'Últimos 7 dias' },
              { id: '30d', label: 'Últimos 30 dias' },
              { id: 'mes_atual', label: 'Mês atual (Nov)' },
              { id: 'personalizado', label: 'Personalizado' },
            ] as { id: PeriodFilter; label: string }[]
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setPeriod(item.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                period === item.id
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {period === 'personalizado' ? (
          <div className="flex items-center gap-2 text-xs">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="px-2.5 py-1 border border-slate-200 rounded-lg text-slate-700 bg-slate-50"
            />
            <span className="text-slate-400">até</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="px-2.5 py-1 border border-slate-200 rounded-lg text-slate-700 bg-slate-50"
            />
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span className="tabular-nums">
              {formatDateBR(dateRange.start)} – {formatDateBR(dateRange.end)}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-medium text-slate-700 tabular-nums">
              {kpis.vendasNoPeriodoQtd} venda(s) ({formatBRL(kpis.valorVendasPeriodo)})
            </span>
          </div>
        )}
      </div>

      {/* Cards Financeiros Principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Total vendido (carteira)</p>
          <p className="text-2xl font-bold text-slate-900 mt-1.5 tabular-nums">
            {formatBRL(kpis.totalVendidoGeral)}
          </p>
          <p className="text-xs text-slate-500 mt-2 tabular-nums">
            {state.vendas.filter((v) => v.situacao !== 'cancelada').length} vendas registradas
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Total recebido</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1.5 tabular-nums">
            {formatBRL(kpis.totalRecebidoGeral)}
          </p>
          <p className="text-xs text-slate-500 mt-2 tabular-nums">
            {Math.round((kpis.totalRecebidoGeral / Math.max(1, kpis.totalVendidoGeral)) * 100)}% do volume vendido
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Total a receber</p>
          <p className="text-2xl font-bold text-slate-900 mt-1.5 tabular-nums">
            {formatBRL(kpis.totalAReceberGeral)}
          </p>
          <p className="text-xs text-slate-500 mt-2 tabular-nums">
            Parcelas futuras e saldo em aberto
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Total em atraso</p>
          <p className="text-2xl font-bold text-rose-600 mt-1.5 tabular-nums">
            {formatBRL(kpis.totalEmAtraso)}
          </p>
          <button
            type="button"
            onClick={() => onNavigate('inadimplencia')}
            className="text-xs font-medium text-rose-700 hover:underline mt-2 inline-flex items-center gap-1"
          >
            <span>{cobrancasAtrasadas.length} cobrança(s) vencida(s)</span>
            <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Faixa Operacional: Vendas no mês, Contratos ativos e Recorrências ativas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          type="button"
          onClick={() => onNavigate('vendas')}
          className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl px-5 py-4 flex items-center justify-between transition-colors text-left"
        >
          <div>
            <p className="text-xs font-medium text-slate-500">Vendas no mês (Novembro)</p>
            <p className="text-lg font-bold text-slate-900 mt-0.5 tabular-nums">
              {kpis.vendasNoMesQtd} vendas · {formatBRL(kpis.vendasNoMesValor)}
            </p>
          </div>
          <TrendingUp className="w-5 h-5 text-teal-700 shrink-0" />
        </button>

        <button
          type="button"
          onClick={() => onNavigate('contratos')}
          className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl px-5 py-4 flex items-center justify-between transition-colors text-left"
        >
          <div>
            <p className="text-xs font-medium text-slate-500">Contratos ativos</p>
            <p className="text-lg font-bold text-slate-900 mt-0.5 tabular-nums">
              {kpis.contratosAtivos} contrato(s) vigente(s)
            </p>
          </div>
          <FileText className="w-5 h-5 text-slate-500 shrink-0" />
        </button>

        <button
          type="button"
          onClick={() => onNavigate('recorrencias')}
          className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl px-5 py-4 flex items-center justify-between transition-colors text-left"
        >
          <div>
            <p className="text-xs font-medium text-slate-500">Recorrências ativas</p>
            <p className="text-lg font-bold text-slate-900 mt-0.5 tabular-nums">
              {kpis.recorrenciasAtivas} assinatura(s) mensal(is)
            </p>
          </div>
          <Repeat className="w-5 h-5 text-teal-700 shrink-0" />
        </button>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Gráfico 1: Vendas e recebimentos ao longo do tempo */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Vendas e recebimentos ao longo do tempo
              </h2>
              <p className="text-xs text-slate-500">
                Comparativo mensal entre valor vendido e valores efetivamente recebidos
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="w-2.5 h-2.5 rounded-xs bg-slate-800" />
                Vendido
              </span>
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="w-2.5 h-2.5 rounded-xs bg-teal-600" />
                Recebido
              </span>
            </div>
          </div>

          <div className="relative h-60 w-full">
            <svg viewBox="0 0 560 220" className="w-full h-full overflow-visible">
              {/* Linhas horizontais de guia */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                const y = 180 - ratio * 150;
                const val = maxChartVal * ratio;
                return (
                  <g key={idx}>
                    <line
                      x1="64"
                      y1={y}
                      x2="540"
                      y2={y}
                      stroke="#E2E8F0"
                      strokeDasharray={ratio === 0 ? undefined : '3 3'}
                    />
                    <text
                      x="56"
                      y={y + 4}
                      textAnchor="end"
                      className="fill-slate-400 text-[10px] font-mono"
                    >
                      {val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val.toFixed(0)}
                    </text>
                  </g>
                );
              })}

              {/* Barras por Mês */}
              {monthlySeries.map((d, idx) => {
                const groupX = 110 + idx * 112;
                const barW = 28;
                const hVendido = Math.max(4, (d.vendido / maxChartVal) * 150);
                const hRecebido = Math.max(4, (d.recebido / maxChartVal) * 150);
                const isHovered = hoveredBarIdx === idx;

                return (
                  <g
                    key={d.label}
                    onMouseEnter={() => setHoveredBarIdx(idx)}
                    onMouseLeave={() => setHoveredBarIdx(null)}
                    className="cursor-pointer"
                  >
                    {isHovered && (
                      <rect
                        x={groupX - 38}
                        y="20"
                        width="76"
                        height="164"
                        rx="6"
                        fill="#F1F5F9"
                      />
                    )}
                    <rect
                      x={groupX - barW - 3}
                      y={180 - hVendido}
                      width={barW}
                      height={hVendido}
                      rx="4"
                      fill="#1E293B"
                    />
                    <rect
                      x={groupX + 3}
                      y={180 - hRecebido}
                      width={barW}
                      height={hRecebido}
                      rx="4"
                      fill="#0D9488"
                    />
                    <text
                      x={groupX}
                      y="202"
                      textAnchor="middle"
                      className="fill-slate-600 text-[11px] font-medium"
                    >
                      {d.label}
                    </text>
                  </g>
                );
              })}
            </svg>

            {hoveredBarIdx !== null && monthlySeries[hoveredBarIdx] && (
              <div className="absolute top-2 right-2 bg-slate-900 text-white px-3 py-2 rounded-lg text-xs shadow-md pointer-events-none">
                <p className="font-semibold mb-1">{monthlySeries[hoveredBarIdx].label}</p>
                <p className="tabular-nums text-slate-300">
                  Vendido: {formatBRL(monthlySeries[hoveredBarIdx].vendido)}
                </p>
                <p className="tabular-nums text-teal-300">
                  Recebido: {formatBRL(monthlySeries[hoveredBarIdx].recebido)}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Gráfico 2: Recebimentos por forma de pagamento */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Recebimentos por forma de pagamento
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Distribuição dos valores já confirmados
            </p>
          </div>

          <div className="my-5 space-y-4">
            {/* Barra empilhada proporcional */}
            <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden flex">
              {paymentBreakdown.map((item) => (
                <div
                  key={item.forma}
                  style={{ width: `${Math.max(item.percent, 2)}%` }}
                  className={`${item.color} h-full`}
                  title={`${item.forma}: ${formatBRL(item.valor)} (${item.percent}%)`}
                />
              ))}
            </div>

            <div className="space-y-2.5">
              {paymentBreakdown.map((item) => (
                <div key={item.forma} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2.5 h-2.5 rounded-xs shrink-0 ${item.color}`} />
                    <span className="text-slate-700 font-medium truncate">{item.forma}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 tabular-nums">
                    <span className="text-slate-400">{item.percent}%</span>
                    <span className="font-semibold text-slate-900">{formatBRL(item.valor)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('relatorios')}
            className="text-xs font-semibold text-teal-700 hover:text-teal-800 inline-flex items-center gap-1 pt-2 border-t border-slate-100"
          >
            <span>Ver relatórios detalhados</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Listas Operacionais */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Próximos vencimentos */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600" />
              <h3 className="text-sm font-semibold text-slate-900">Próximos vencimentos</h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('cobrancas')}
              className="text-xs font-medium text-teal-700 hover:underline"
            >
              Ver todos
            </button>
          </div>
          <div className="divide-y divide-slate-100 flex-1">
            {proximosVencimentos.length === 0 ? (
              <p className="p-5 text-xs text-slate-500">Nenhuma cobrança pendente próxima.</p>
            ) : (
              proximosVencimentos.map((c) => {
                const cli = state.clientes.find((cl) => cl.id === c.clienteId);
                return (
                  <div key={c.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900 truncate">
                        {cli?.nome || 'Cliente'}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {formatDateBR(c.vencimento)} · {c.formaPagamento}
                      </p>
                    </div>
                    <span className="text-xs font-bold text-slate-900 tabular-nums shrink-0">
                      {formatBRL(c.valor)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Últimas vendas */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-teal-700" />
              <h3 className="text-sm font-semibold text-slate-900">Últimas vendas</h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('vendas')}
              className="text-xs font-medium text-teal-700 hover:underline"
            >
              Ver todas
            </button>
          </div>
          <div className="divide-y divide-slate-100 flex-1">
            {ultimasVendas.map((v) => {
              const cli = state.clientes.find((cl) => cl.id === v.clienteId);
              return (
                <div key={v.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-900 truncate">
                        {cli?.nome || 'Cliente'}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">{v.codigo}</span>
                    </div>
                    <div className="mt-1">{getVendaSituacaoBadge(v.situacao)}</div>
                  </div>
                  <span className="text-xs font-bold text-slate-900 tabular-nums shrink-0">
                    {formatBRL(v.valorTotal)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Cobranças atrasadas */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              <h3 className="text-sm font-semibold text-slate-900">Cobranças atrasadas</h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('inadimplencia')}
              className="text-xs font-medium text-rose-700 hover:underline"
            >
              Tratar atrasos
            </button>
          </div>
          <div className="divide-y divide-slate-100 flex-1">
            {cobrancasAtrasadas.length === 0 ? (
              <p className="p-5 text-xs text-slate-500">Nenhuma cobrança em atraso no momento.</p>
            ) : (
              cobrancasAtrasadas.map((c) => {
                const cli = state.clientes.find((cl) => cl.id === c.clienteId);
                return (
                  <div key={c.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900 truncate">
                        {cli?.nome || 'Cliente'}
                      </p>
                      <p className="text-[11px] text-rose-600 truncate">
                        Venceu em {formatDateBR(c.vencimento)} · {c.identificador}
                      </p>
                    </div>
                    <span className="text-xs font-bold text-rose-600 tabular-nums shrink-0">
                      {formatBRL(c.valor)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
