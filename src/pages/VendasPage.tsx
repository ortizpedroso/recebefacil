import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus,
  Search,
  Eye,
  ShoppingCart,
  Trash2,
  Check,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { useRecebeFacil } from '../context/RecebeFacilContext';
import {
  FormaPagamento,
  Periodicidade,
  SituacaoVenda,
  TipoRecebimento,
  Venda,
  VendaItem,
} from '../types/recebefacil';
import { formatBRL, formatDateBR, HOJE_DEMO, addPeriodToDate } from '../utils/formatters';
import { getVendaSituacaoBadge } from '../components/ui/StatusBadge';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';

interface VendasPageProps {
  openWizardSignal?: number;
}

export const VendasPage: React.FC<VendasPageProps> = ({ openWizardSignal }) => {
  const { state, createVenda, updateVendaSituacao } = useRecebeFacil();

  // Filtros
  const [busca, setBusca] = useState('');
  const [filtroCliente, setFiltroCliente] = useState('todos');
  const [filtroSituacao, setFiltroSituacao] = useState<'todos' | SituacaoVenda>('todos');
  const [filtroTipo, setFiltroTipo] = useState<'todos' | TipoRecebimento>('todos');
  const [filtroForma, setFiltroForma] = useState<'todos' | FormaPagamento>('todos');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  // Modal Detalhes da Venda
  const [vendaDetalhe, setVendaDetalhe] = useState<Venda | null>(null);

  // Fluxo visual de Nova Venda em 4 etapas
  const [wizardOpen, setWizardOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [wClienteId, setWClienteId] = useState('');
  const [wData, setWData] = useState(HOJE_DEMO);
  const [wItens, setWItens] = useState<VendaItem[]>([]);
  const [wDesconto, setWDesconto] = useState('0');
  const [wObs, setWObs] = useState('');

  // Adicionar item do catálogo ou avulso
  const [wSelectedCatId, setWSelectedCatId] = useState('');
  const [wCustomDesc, setWCustomDesc] = useState('');
  const [wCustomTipo, setWCustomTipo] = useState<'produto' | 'servico'>('servico');
  const [wCustomQtd, setWCustomQtd] = useState('1');
  const [wCustomValor, setWCustomValor] = useState('');

  // Etapa 3: Condições
  const [wTipoRecebimento, setWTipoRecebimento] = useState<TipoRecebimento>('parcelado');
  const [wFormaRecebimento, setWFormaRecebimento] = useState<FormaPagamento>('Pix');
  const [wEntrada, setWEntrada] = useState('0');
  const [wQtdParcelas, setWQtdParcelas] = useState('3');
  const [wPrimeiroVenc, setWPrimeiroVenc] = useState(addPeriodToDate(HOJE_DEMO, 'mensal', 1));
  const [wPeriodicidade, setWPeriodicidade] = useState<Periodicidade>('mensal');
  const [wGerarContrato, setWGerarContrato] = useState(false);

  useEffect(() => {
    if (openWizardSignal && openWizardSignal > 0) {
      handleOpenWizard();
    }
  }, [openWizardSignal]);

  const handleOpenWizard = () => {
    setStep(1);
    setWClienteId(state.clientes[0]?.id || '');
    setWData(HOJE_DEMO);
    setWItens([]);
    setWDesconto('0');
    setWObs('');
    setWSelectedCatId('');
    setWCustomDesc('');
    setWCustomQtd('1');
    setWCustomValor('');
    setWTipoRecebimento('parcelado');
    setWFormaRecebimento(state.configuracoes.financeiro.formaPadrao);
    setWEntrada('0');
    setWQtdParcelas('3');
    setWPrimeiroVenc(addPeriodToDate(HOJE_DEMO, 'mensal', 1));
    setWPeriodicidade('mensal');
    setWGerarContrato(false);
    setWizardOpen(true);
  };

  const handleAddCatalogItemToSale = () => {
    const cat = state.catalogo.find((c) => c.id === wSelectedCatId);
    if (!cat) return;
    setWItens((prev) => [
      ...prev,
      {
        id: `vi-${Date.now()}`,
        itemId: cat.id,
        descricao: cat.nome,
        tipoCatalogo: cat.tipoCatalogo,
        quantidade: 1,
        valorUnitario: cat.preco,
      },
    ]);
    setWSelectedCatId('');
  };

  const handleAddCustomItemToSale = () => {
    const val = parseFloat(wCustomValor.replace(',', '.')) || 0;
    const qtd = Math.max(1, parseInt(wCustomQtd, 10) || 1);
    if (!wCustomDesc.trim() || val <= 0) return;

    setWItens((prev) => [
      ...prev,
      {
        id: `vi-${Date.now()}`,
        descricao: wCustomDesc.trim(),
        tipoCatalogo: wCustomTipo,
        quantidade: qtd,
        valorUnitario: val,
      },
    ]);
    setWCustomDesc('');
    setWCustomQtd('1');
    setWCustomValor('');
  };

  const wSubtotal = useMemo(
    () => wItens.reduce((acc, i) => acc + i.quantidade * i.valorUnitario, 0),
    [wItens]
  );
  const wDescontoNum = Math.max(0, parseFloat(wDesconto.replace(',', '.')) || 0);
  const wTotal = Math.max(0, wSubtotal - wDescontoNum);
  const wEntradaNum = Math.min(wTotal, Math.max(0, parseFloat(wEntrada.replace(',', '.')) || 0));
  const wQtdParcelasNum = Math.max(1, parseInt(wQtdParcelas, 10) || 1);

  const previewParcelas = useMemo(() => {
    if (wTipoRecebimento !== 'parcelado') return [];
    const saldo = Math.max(0, wTotal - wEntradaNum);
    const valParc = Number((saldo / wQtdParcelasNum).toFixed(2));
    return Array.from({ length: wQtdParcelasNum }).map((_, idx) => {
      const val =
        idx === wQtdParcelasNum - 1
          ? Number((saldo - valParc * (wQtdParcelasNum - 1)).toFixed(2))
          : valParc;
      return {
        numero: idx + 1,
        vencimento: addPeriodToDate(wPrimeiroVenc, wPeriodicidade, idx),
        valor: val,
      };
    });
  }, [wTipoRecebimento, wTotal, wEntradaNum, wQtdParcelasNum, wPrimeiroVenc, wPeriodicidade]);

  const handleConfirmVenda = () => {
    if (!wClienteId || wItens.length === 0) return;
    createVenda({
      clienteId: wClienteId,
      data: wData,
      itens: wItens,
      desconto: wDescontoNum,
      observacoes: wObs.trim() || undefined,
      tipoRecebimento: wTipoRecebimento,
      formaRecebimento: wFormaRecebimento,
      valorEntrada: wTipoRecebimento === 'parcelado' ? wEntradaNum : undefined,
      qtdParcelas: wTipoRecebimento === 'parcelado' ? wQtdParcelasNum : undefined,
      primeiroVencimento: wPrimeiroVenc,
      periodicidade: wPeriodicidade,
      gerarContrato: wGerarContrato,
    });
    setWizardOpen(false);
  };

  const filteredVendas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return state.vendas.filter((v) => {
      if (filtroCliente !== 'todos' && v.clienteId !== filtroCliente) return false;
      if (filtroSituacao !== 'todos' && v.situacao !== filtroSituacao) return false;
      if (filtroTipo !== 'todos' && v.tipoRecebimento !== filtroTipo) return false;
      if (filtroForma !== 'todos' && v.formaRecebimento !== filtroForma) return false;
      if (dataInicio && v.data < dataInicio) return false;
      if (dataFim && v.data > dataFim) return false;
      if (!q) return true;
      const cli = state.clientes.find((c) => c.id === v.clienteId);
      return (
        v.codigo.toLowerCase().includes(q) ||
        (cli && cli.nome.toLowerCase().includes(q)) ||
        v.itens.some((i) => i.descricao.toLowerCase().includes(q))
      );
    });
  }, [
    state.vendas,
    state.clientes,
    busca,
    filtroCliente,
    filtroSituacao,
    filtroTipo,
    filtroForma,
    dataInicio,
    dataFim,
  ]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Vendas</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Registre vendas à vista, parceladas ou recorrentes e acompanhe o recebimento de cada pedido.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenWizard}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold transition-colors whitespace-nowrap self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Nova venda</span>
        </button>
      </div>

      {/* Filtros completos */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 text-xs">
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por código, cliente ou item..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-teal-600"
            />
          </div>

          <select
            value={filtroCliente}
            onChange={(e) => setFiltroCliente(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-700"
          >
            <option value="todos">Todos os clientes</option>
            {state.clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>

          <select
            value={filtroSituacao}
            onChange={(e) => setFiltroSituacao(e.target.value as typeof filtroSituacao)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-700"
          >
            <option value="todos">Todas situações</option>
            <option value="rascunho">Rascunho</option>
            <option value="aguardando_pagamento">Aguardando pagamento</option>
            <option value="parcialmente_paga">Parcialmente paga</option>
            <option value="paga">Paga</option>
            <option value="cancelada">Cancelada</option>
          </select>

          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value as typeof filtroTipo)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-700"
          >
            <option value="todos">Todos tipos</option>
            <option value="avista">À vista</option>
            <option value="parcelado">Parcelado</option>
            <option value="recorrente">Recorrente</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-500">Período:</span>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="px-2.5 py-1 border border-slate-200 rounded-lg text-slate-700"
            />
            <span className="text-slate-400">até</span>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="px-2.5 py-1 border border-slate-200 rounded-lg text-slate-700"
            />
          </div>

          <select
            value={filtroForma}
            onChange={(e) => setFiltroForma(e.target.value as typeof filtroForma)}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700"
          >
            <option value="todos">Todas formas de recebimento</option>
            <option value="Pix">Pix</option>
            <option value="Boleto">Boleto</option>
            <option value="Cartão de Crédito">Cartão de Crédito</option>
            <option value="Transferência">Transferência</option>
            <option value="Dinheiro">Dinheiro</option>
          </select>
        </div>
      </div>

      {/* Tabela de Vendas */}
      {filteredVendas.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="Nenhuma venda encontrada"
          description="Ajuste os filtros selecionados ou crie uma nova venda em etapas."
          actionLabel="Criar nova venda"
          onAction={handleOpenWizard}
        />
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <th className="py-3 px-4 font-semibold">Código</th>
                <th className="py-3 px-4 font-semibold">Cliente</th>
                <th className="py-3 px-4 font-semibold">Data</th>
                <th className="py-3 px-4 font-semibold">Produtos / Serviços</th>
                <th className="py-3 px-4 font-semibold">Condição</th>
                <th className="py-3 px-4 font-semibold">Forma</th>
                <th className="py-3 px-4 font-semibold">Situação</th>
                <th className="py-3 px-4 font-semibold text-right">Valor total</th>
                <th className="py-3 px-4 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredVendas.map((v) => {
                const cli = state.clientes.find((c) => c.id === v.clienteId);
                return (
                  <tr key={v.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-slate-900 whitespace-nowrap">
                      {v.codigo}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                      {cli?.nome || 'Cliente'}
                    </td>
                    <td className="py-3 px-4 tabular-nums text-slate-600 whitespace-nowrap">
                      {formatDateBR(v.data)}
                    </td>
                    <td className="py-3 px-4 text-slate-700 max-w-xs truncate">
                      {v.itens.map((i) => `${i.quantidade}x ${i.descricao}`).join(', ')}
                    </td>
                    <td className="py-3 px-4 text-slate-600 capitalize whitespace-nowrap">
                      {v.tipoRecebimento === 'avista'
                        ? 'À vista'
                        : v.tipoRecebimento === 'parcelado'
                        ? `Parcelado (${v.qtdParcelas || 1}x)`
                        : 'Recorrente'}
                    </td>
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{v.formaRecebimento}</td>
                    <td className="py-3 px-4">{getVendaSituacaoBadge(v.situacao)}</td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900 tabular-nums whitespace-nowrap">
                      {formatBRL(v.valorTotal)}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setVendaDetalhe(v)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-teal-700 hover:bg-teal-50 transition-colors"
                        title="Visualizar detalhes da venda"
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

      {/* Modal Fluxo Visual de Nova Venda em 4 Etapas */}
      <Modal
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        title="Nova venda"
        subtitle="Siga as 4 etapas para registrar a venda e atualizar os recebimentos demonstrativos."
        size="lg"
      >
        <div className="space-y-6">
          {/* Indicador de Etapas */}
          <div className="grid grid-cols-4 gap-2 text-xs">
            {[
              { n: 1, label: '1. Cliente' },
              { n: 2, label: '2. Itens e valores' },
              { n: 3, label: '3. Recebimento' },
              { n: 4, label: '4. Revisão' },
            ].map((s) => (
              <button
                key={s.n}
                type="button"
                onClick={() => {
                  if (s.n <= step) setStep(s.n as 1 | 2 | 3 | 4);
                }}
                className={`py-2 px-2.5 rounded-lg font-semibold text-center border transition-colors ${
                  step === s.n
                    ? 'bg-teal-700 text-white border-teal-700'
                    : step > s.n
                    ? 'bg-teal-50 text-teal-800 border-teal-200'
                    : 'bg-slate-50 text-slate-400 border-slate-200'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Etapa 1: Selecionar Cliente */}
          {step === 1 && (
            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">
                  Selecione o cliente *
                </label>
                <select
                  value={wClienteId}
                  onChange={(e) => setWClienteId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg bg-white text-slate-900"
                >
                  {state.clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome} — {c.cpfCnpj}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">Data da venda *</label>
                <input
                  type="date"
                  value={wData}
                  onChange={(e) => setWData(e.target.value)}
                  className="w-full sm:w-56 px-3 py-2 border border-slate-200 rounded-lg text-slate-900"
                />
              </div>
            </div>
          )}

          {/* Etapa 2: Adicionar Produtos/Serviços */}
          {step === 2 && (
            <div className="space-y-4 text-xs">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <p className="font-semibold text-slate-800">Adicionar do catálogo</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={wSelectedCatId}
                    onChange={(e) => setWSelectedCatId(e.target.value)}
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="">Escolha um produto ou serviço ativo...</option>
                    {state.catalogo
                      .filter((c) => c.ativo)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome} — {formatBRL(c.preco)}
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleAddCatalogItemToSale}
                    disabled={!wSelectedCatId}
                    className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white font-semibold"
                  >
                    Adicionar
                  </button>
                </div>

                <div className="pt-3 border-t border-slate-200">
                  <p className="font-semibold text-slate-800 mb-2">
                    Ou inserir item personalizado (sem cadastro prévio)
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-6 gap-2">
                    <input
                      type="text"
                      value={wCustomDesc}
                      onChange={(e) => setWCustomDesc(e.target.value)}
                      placeholder="Descrição do produto/serviço"
                      className="sm:col-span-3 px-3 py-2 border border-slate-200 rounded-lg bg-white"
                    />
                    <input
                      type="number"
                      min="1"
                      value={wCustomQtd}
                      onChange={(e) => setWCustomQtd(e.target.value)}
                      placeholder="Qtd"
                      className="px-3 py-2 border border-slate-200 rounded-lg bg-white tabular-nums"
                    />
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={wCustomValor}
                      onChange={(e) => setWCustomValor(e.target.value)}
                      placeholder="Valor unit."
                      className="px-3 py-2 border border-slate-200 rounded-lg bg-white tabular-nums"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomItemToSale}
                      className="px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 font-semibold"
                    >
                      Incluir
                    </button>
                  </div>
                </div>
              </div>

              {/* Lista de Itens da Venda */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                {wItens.length === 0 ? (
                  <p className="p-4 text-slate-500 text-center">
                    Nenhum item adicionado ainda. Inclua ao menos 1 produto ou serviço para prosseguir.
                  </p>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                        <th className="py-2 px-3 font-semibold">Descrição</th>
                        <th className="py-2 px-3 font-semibold text-right">Qtd</th>
                        <th className="py-2 px-3 font-semibold text-right">Unitário</th>
                        <th className="py-2 px-3 font-semibold text-right">Subtotal</th>
                        <th className="py-2 px-3 font-semibold text-right"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {wItens.map((item) => (
                        <tr key={item.id}>
                          <td className="py-2 px-3 font-medium text-slate-900">{item.descricao}</td>
                          <td className="py-2 px-3 text-right tabular-nums">{item.quantidade}</td>
                          <td className="py-2 px-3 text-right tabular-nums">
                            {formatBRL(item.valorUnitario)}
                          </td>
                          <td className="py-2 px-3 text-right font-semibold tabular-nums">
                            {formatBRL(item.quantidade * item.valorUnitario)}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                setWItens((prev) => prev.filter((i) => i.id !== item.id))
                              }
                              className="text-slate-400 hover:text-rose-600 p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Desconto (R$)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={wDesconto}
                    onChange={(e) => setWDesconto(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Observações</label>
                  <input
                    type="text"
                    value={wObs}
                    onChange={(e) => setWObs(e.target.value)}
                    placeholder="Condições combinadas..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex justify-end text-sm font-bold text-slate-900 tabular-nums">
                Total líquido: {formatBRL(wTotal)}
              </div>
            </div>
          )}

          {/* Etapa 3: Definir Condições de Recebimento */}
          {step === 3 && (
            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">
                  Tipo de recebimento
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'avista', label: 'À vista' },
                      { id: 'parcelado', label: 'Parcelado' },
                      { id: 'recorrente', label: 'Recorrente' },
                    ] as const
                  ).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setWTipoRecebimento(t.id)}
                      className={`py-2.5 px-3 rounded-lg border font-semibold transition-colors ${
                        wTipoRecebimento === t.id
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-600 border-slate-200'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Forma de recebimento
                  </label>
                  <select
                    value={wFormaRecebimento}
                    onChange={(e) => setWFormaRecebimento(e.target.value as FormaPagamento)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="Pix">Pix</option>
                    <option value="Boleto">Boleto</option>
                    <option value="Cartão de Crédito">Cartão de Crédito</option>
                    <option value="Transferência">Transferência</option>
                    <option value="Dinheiro">Dinheiro</option>
                  </select>
                </div>

                {wTipoRecebimento !== 'avista' && (
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Periodicidade
                    </label>
                    <select
                      value={wPeriodicidade}
                      onChange={(e) => setWPeriodicidade(e.target.value as Periodicidade)}
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
                )}

                {wTipoRecebimento === 'parcelado' && (
                  <>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Valor de entrada (R$)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={wEntrada}
                        onChange={(e) => setWEntrada(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Quantidade de parcelas
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="60"
                        value={wQtdParcelas}
                        onChange={(e) => setWQtdParcelas(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg tabular-nums"
                      />
                    </div>
                  </>
                )}

                {wTipoRecebimento !== 'avista' && (
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      {wTipoRecebimento === 'parcelado' ? '1º vencimento' : '1ª cobrança'}
                    </label>
                    <input
                      type="date"
                      value={wPrimeiroVenc}
                      onChange={(e) => setWPrimeiroVenc(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                    />
                  </div>
                )}
              </div>

              <label className="flex items-center gap-2 pt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={wGerarContrato}
                  onChange={(e) => setWGerarContrato(e.target.checked)}
                  className="rounded border-slate-300 text-teal-700"
                />
                <span className="font-medium text-slate-700">
                  Vincular e gerar contrato automaticamente para esta venda
                </span>
              </label>

              {wTipoRecebimento === 'parcelado' && previewParcelas.length > 0 && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <p className="font-semibold text-slate-800">Prévia do cronograma de parcelas</p>
                  <div className="max-h-32 overflow-y-auto divide-y divide-slate-200">
                    {previewParcelas.map((p) => (
                      <div key={p.numero} className="py-1.5 flex justify-between tabular-nums">
                        <span className="text-slate-600">
                          Parcela {p.numero}/{wQtdParcelasNum} · Venc. {formatDateBR(p.vencimento)}
                        </span>
                        <span className="font-semibold text-slate-900">{formatBRL(p.valor)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Etapa 4: Revisar e Confirmar */}
          {step === 4 && (
            <div className="space-y-4 text-xs">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Cliente:</span>
                  <span className="font-semibold text-slate-900">
                    {state.clientes.find((c) => c.id === wClienteId)?.nome}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Data da venda:</span>
                  <span className="font-medium tabular-nums">{formatDateBR(wData)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Itens:</span>
                  <span className="font-medium text-right">
                    {wItens.map((i) => `${i.quantidade}x ${i.descricao}`).join(', ')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Recebimento:</span>
                  <span className="font-medium capitalize">
                    {wTipoRecebimento} · {wFormaRecebimento}
                  </span>
                </div>
                {wGerarContrato && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Contrato:</span>
                    <span className="font-medium text-teal-700">Será gerado automaticamente</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-slate-200 text-sm font-bold text-slate-900 tabular-nums">
                  <span>Valor total:</span>
                  <span>{formatBRL(wTotal)}</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-500">
                Ao confirmar, os dados demonstrativos de vendas, parcelas, cobranças e indicadores do painel serão atualizados.
              </p>
            </div>
          )}

          {/* Navegação do Stepper */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                if (step === 1) setWizardOpen(false);
                else setStep((step - 1) as 1 | 2 | 3 | 4);
              }}
              className="inline-flex items-center gap-1 px-4 py-2 rounded-lg border border-slate-200 text-slate-700 text-xs font-medium hover:bg-slate-50"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>{step === 1 ? 'Cancelar' : 'Voltar'}</span>
            </button>

            {step < 4 ? (
              <button
                type="button"
                disabled={
                  (step === 1 && !wClienteId) ||
                  (step === 2 && wItens.length === 0)
                }
                onClick={() => setStep((step + 1) as 1 | 2 | 3 | 4)}
                className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 disabled:opacity-40 text-white text-xs font-semibold"
              >
                <span>Avançar</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleConfirmVenda}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
              >
                <Check className="w-4 h-4" />
                <span>Confirmar venda</span>
              </button>
            )}
          </div>
        </div>
      </Modal>

      {/* Modal Detalhes da Venda */}
      <Modal
        open={!!vendaDetalhe}
        onClose={() => setVendaDetalhe(null)}
        title={`Detalhes da venda ${vendaDetalhe?.codigo || ''}`}
        size="md"
      >
        {vendaDetalhe && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500">Cliente</p>
                <p className="text-sm font-bold text-slate-900">
                  {state.clientes.find((c) => c.id === vendaDetalhe.clienteId)?.nome}
                </p>
              </div>
              {getVendaSituacaoBadge(vendaDetalhe.situacao)}
            </div>

            <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
              {vendaDetalhe.itens.map((item) => (
                <div key={item.id} className="px-3.5 py-2.5 flex justify-between">
                  <span>
                    {item.quantidade}x {item.descricao}
                  </span>
                  <span className="font-semibold tabular-nums">
                    {formatBRL(item.quantidade * item.valorUnitario)}
                  </span>
                </div>
              ))}
              {vendaDetalhe.desconto > 0 && (
                <div className="px-3.5 py-2 flex justify-between text-slate-500">
                  <span>Desconto</span>
                  <span className="tabular-nums">- {formatBRL(vendaDetalhe.desconto)}</span>
                </div>
              )}
              <div className="px-3.5 py-2.5 flex justify-between font-bold text-slate-900 bg-slate-50">
                <span>Total</span>
                <span className="tabular-nums">{formatBRL(vendaDetalhe.valorTotal)}</span>
              </div>
            </div>

            {vendaDetalhe.observacoes && (
              <div>
                <p className="font-semibold text-slate-700">Observações</p>
                <p className="text-slate-600 mt-0.5">{vendaDetalhe.observacoes}</p>
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-slate-500">Alterar situação:</span>
                <select
                  value={vendaDetalhe.situacao}
                  onChange={(e) => {
                    const nova = e.target.value as SituacaoVenda;
                    updateVendaSituacao(vendaDetalhe.id, nova);
                    setVendaDetalhe({ ...vendaDetalhe, situacao: nova });
                  }}
                  className="px-2.5 py-1 border border-slate-200 rounded-lg bg-white"
                >
                  <option value="rascunho">Rascunho</option>
                  <option value="aguardando_pagamento">Aguardando pagamento</option>
                  <option value="parcialmente_paga">Parcialmente paga</option>
                  <option value="paga">Paga</option>
                  <option value="cancelada">Cancelada</option>
                </select>
              </div>
              <button
                type="button"
                onClick={() => setVendaDetalhe(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-900 text-white font-semibold"
              >
                Fechar
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
