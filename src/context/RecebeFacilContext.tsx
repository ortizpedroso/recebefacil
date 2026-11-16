import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import {
  RecebeFacilState,
  Cliente,
  ClienteComMetricas,
  ContatoCliente,
  CatalogoItem,
  Venda,
  VendaItem,
  Contrato,
  Parcela,
  Recorrencia,
  Cobranca,
  FormaPagamento,
  TipoRecebimento,
  Periodicidade,
  SituacaoVenda,
  SituacaoContrato,
  StatusRecorrencia,
  StatusNegociacao,
  ConfiguracoesSistema,
} from '../types/recebefacil';
import { INITIAL_RECEBEFACIL_STATE } from '../data/mockData';
import { HOJE_DEMO, addPeriodToDate } from '../utils/formatters';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface NovoClienteInput {
  nome: string;
  cpfCnpj: string;
  telefone: string;
  email: string;
  cidade?: string;
  endereco?: string;
  observacoes?: string;
}

interface NovaVendaInput {
  clienteId: string;
  data: string;
  itens: VendaItem[];
  desconto: number;
  observacoes?: string;
  tipoRecebimento: TipoRecebimento;
  formaRecebimento: FormaPagamento;
  valorEntrada?: number;
  qtdParcelas?: number;
  primeiroVencimento?: string;
  periodicidade?: Periodicidade;
  gerarContrato?: boolean;
  descricaoContrato?: string;
}

interface RecebeFacilContextValue {
  state: RecebeFacilState;
  clientesComMetricas: ClienteComMetricas[];
  toasts: ToastMessage[];
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  dismissToast: (id: string) => void;
  resetDemoData: () => void;

  // Clientes & Contatos
  addCliente: (input: NovoClienteInput) => Cliente;
  updateCliente: (id: string, input: Partial<NovoClienteInput>) => void;
  addContatoCliente: (input: Omit<ContatoCliente, 'id'>) => void;

  // Catálogo (Produtos e Serviços)
  addCatalogoItem: (item: Omit<CatalogoItem, 'id' | 'criadoEm'>) => CatalogoItem;
  updateCatalogoItem: (id: string, item: Partial<CatalogoItem>) => void;
  toggleCatalogoAtivo: (id: string) => void;

  // Vendas
  createVenda: (input: NovaVendaInput) => Venda;
  updateVendaSituacao: (id: string, situacao: SituacaoVenda) => void;

  // Contratos
  createContrato: (input: Omit<Contrato, 'id' | 'numero' | 'historico'>) => Contrato;
  updateContratoSituacao: (id: string, situacao: SituacaoContrato) => void;

  // Parcelas
  registrarPagamentoParcela: (
    parcelaId: string,
    valor: number,
    data: string,
    forma: FormaPagamento,
    observacao?: string
  ) => void;
  ajustarParcela: (parcelaId: string, novoValor: number, novoVencimento: string) => void;
  gerarParcelasParaVenda: (
    vendaId: string,
    valorEntrada: number,
    qtdParcelas: number,
    primeiroVencimento: string,
    periodicidade: Periodicidade
  ) => void;

  // Recorrências
  createRecorrencia: (input: {
    clienteId: string;
    itemId?: string;
    descricaoServico: string;
    valor: number;
    periodicidade: Periodicidade;
    primeiraCobranca: string;
    dataEncerramento?: string;
    formaPagamento: FormaPagamento;
  }) => Recorrencia;
  updateRecorrenciaStatus: (id: string, status: StatusRecorrencia) => void;
  gerarCobrancaRecorrencia: (id: string) => void;

  // Cobranças e Inadimplência
  createCobranca: (input: {
    clienteId: string;
    referencia: string;
    valor: number;
    vencimento: string;
    formaPagamento: FormaPagamento;
    vendaId?: string;
    contratoId?: string;
  }) => Cobranca;
  marcarCobrancaPaga: (id: string) => void;
  cancelarCobranca: (id: string) => void;
  estornarCobranca: (id: string) => void;
  atualizarNegociacaoCobranca: (id: string, status: StatusNegociacao) => void;

  // Asaas (Simulado)
  conectarAsaasDemo: () => void;
  desconectarAsaasDemo: () => void;
  mudarAmbienteAsaas: (ambiente: 'demonstracao' | 'sandbox' | 'producao') => void;
  sincronizarAsaasDemo: () => void;

  // Configurações
  updateConfiguracoes: (novas: ConfiguracoesSistema) => void;
}

const RecebeFacilContext = createContext<RecebeFacilContextValue | null>(null);
const STORAGE_KEY = 'recebefacil_saas_demo_v1';

function readLocalBook(): RecebeFacilState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved) as RecebeFacilState;
  } catch {
    return INITIAL_RECEBEFACIL_STATE;
  }
  return INITIAL_RECEBEFACIL_STATE;
}

function writeLocalBook(document: RecebeFacilState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(document));
  } catch {
    return;
  }
}

export const RecebeFacilProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<RecebeFacilState>(INITIAL_RECEBEFACIL_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const revisionRef = useRef(0);
  const echoRef = useRef(true);
  const savingRef = useRef(false);
  const pendingRef = useRef<RecebeFacilState | null>(null);

  const remoteRef = useRef(false);

  const persist = async (document: RecebeFacilState) => {
    if (!remoteRef.current) {
      writeLocalBook(document);
      return;
    }
    if (savingRef.current) {
      pendingRef.current = document;
      return;
    }
    savingRef.current = true;
    try {
      const response = await fetch('/api/book', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ revision: revisionRef.current, document }),
      });
      if (response.status === 409) {
        const fresh = await fetch('/api/book');
        if (!fresh.ok) return;
        const body = (await fresh.json()) as { revision: number; document: RecebeFacilState };
        revisionRef.current = body.revision;
        echoRef.current = true;
        pendingRef.current = null;
        setState(body.document);
        showToast('O livro foi atualizado em outro lugar. Recarreguei os dados.', 'info');
        return;
      }
      if (!response.ok) {
        showToast('Não consegui gravar a demonstração no servidor.', 'error');
        return;
      }
      const body = (await response.json()) as { revision: number };
      revisionRef.current = body.revision;
    } finally {
      savingRef.current = false;
      const pending = pendingRef.current;
      if (pending) {
        pendingRef.current = null;
        void persist(pending);
      }
    }
  };

  useEffect(() => {
    if (!hydrated) return;
    if (echoRef.current) {
      echoRef.current = false;
      return;
    }
    const document = state;
    const timer = setTimeout(() => {
      void persist(document);
    }, 200);
    return () => clearTimeout(timer);
  }, [state, hydrated]);

  useEffect(() => {
    let cancel = false;
    void (async () => {
      try {
        const response = await fetch('/api/book');
        if (cancel) return;
        if (response.ok) {
          const body = (await response.json()) as { revision: number; document: RecebeFacilState };
          remoteRef.current = true;
          revisionRef.current = body.revision;
          echoRef.current = true;
          setState(body.document);
          setHydrated(true);
          return;
        }
        remoteRef.current = false;
        echoRef.current = true;
        setState(readLocalBook());
        setHydrated(true);
      } catch {
        if (cancel) return;
        remoteRef.current = false;
        echoRef.current = true;
        setState(readLocalBook());
        setHydrated(true);
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3800);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const resetDemoData = () => {
    setState(INITIAL_RECEBEFACIL_STATE);
    showToast('Dados demonstrativos restaurados para o estado inicial.', 'info');
  };

  // Cálculo coerente por cliente derivado de vendas, parcelas e cobranças
  const clientesComMetricas: ClienteComMetricas[] = useMemo(() => {
    return state.clientes.map((cli) => {
      const vendasCliente = state.vendas.filter(
        (v) => v.clienteId === cli.id && v.situacao !== 'cancelada' && v.situacao !== 'rascunho'
      );
      const parcelasCliente = state.parcelas.filter(
        (p) => p.clienteId === cli.id && p.status !== 'cancelada'
      );
      const cobrancasCliente = state.cobrancas.filter((c) => c.clienteId === cli.id);

      let totalComprado = 0;
      let totalPago = 0;
      let saldoEmAberto = 0;

      vendasCliente.forEach((v) => {
        totalComprado += v.valorTotal;
        if (v.tipoRecebimento === 'parcelado') {
          const ps = parcelasCliente.filter((p) => p.vendaId === v.id);
          if (ps.length > 0) {
            const pago = ps.reduce((acc, p) => acc + p.valorPago, 0);
            const aberto = ps.reduce((acc, p) => acc + Math.max(0, p.valor - p.valorPago), 0);
            totalPago += pago;
            saldoEmAberto += aberto;
          } else {
            if (v.situacao === 'paga') totalPago += v.valorTotal;
            else saldoEmAberto += v.valorTotal;
          }
        } else {
          if (v.situacao === 'paga') {
            totalPago += v.valorTotal;
          } else {
            saldoEmAberto += v.valorTotal;
          }
        }
      });

      const temVencida =
        parcelasCliente.some((p) => p.status === 'vencida') ||
        cobrancasCliente.some((c) => c.status === 'vencida');

      const situacao = temVencida
        ? 'inadimplente'
        : saldoEmAberto > 0
        ? 'com_pendencias'
        : 'em_dia';

      return {
        ...cli,
        totalComprado,
        totalPago,
        saldoEmAberto,
        situacao,
      };
    });
  }, [state.clientes, state.vendas, state.parcelas, state.cobrancas]);

  // --- CLIENTES ---
  const addCliente = (input: NovoClienteInput): Cliente => {
    const novo: Cliente = {
      id: `cli-${Date.now()}`,
      ...input,
      criadoEm: HOJE_DEMO,
    };
    setState((prev) => ({
      ...prev,
      clientes: [novo, ...prev.clientes],
    }));
    showToast(`Cliente "${novo.nome}" cadastrado com sucesso.`);
    return novo;
  };

  const updateCliente = (id: string, input: Partial<NovoClienteInput>) => {
    setState((prev) => ({
      ...prev,
      clientes: prev.clientes.map((c) => (c.id === id ? { ...c, ...input } : c)),
    }));
    showToast('Dados do cliente atualizados.');
  };

  const addContatoCliente = (input: Omit<ContatoCliente, 'id'>) => {
    const novo: ContatoCliente = {
      id: `cont-${Date.now()}`,
      ...input,
    };
    setState((prev) => ({
      ...prev,
      contatos: [novo, ...prev.contatos],
    }));
    showToast('Registro de contato salvo no histórico.');
  };

  // --- CATÁLOGO ---
  const addCatalogoItem = (item: Omit<CatalogoItem, 'id' | 'criadoEm'>): CatalogoItem => {
    const novo: CatalogoItem = {
      id: `cat-${Date.now()}`,
      ...item,
      criadoEm: HOJE_DEMO,
    };
    setState((prev) => ({
      ...prev,
      catalogo: [novo, ...prev.catalogo],
    }));
    showToast(`${novo.tipoCatalogo === 'produto' ? 'Produto' : 'Serviço'} "${novo.nome}" adicionado ao catálogo.`);
    return novo;
  };

  const updateCatalogoItem = (id: string, item: Partial<CatalogoItem>) => {
    setState((prev) => ({
      ...prev,
      catalogo: prev.catalogo.map((i) => (i.id === id ? { ...i, ...item } : i)),
    }));
    showToast('Item do catálogo atualizado.');
  };

  const toggleCatalogoAtivo = (id: string) => {
    setState((prev) => ({
      ...prev,
      catalogo: prev.catalogo.map((i) => (i.id === id ? { ...i, ativo: !i.ativo } : i)),
    }));
    showToast('Situação do item atualizada.');
  };

  // --- VENDAS ---
  const createVenda = (input: NovaVendaInput): Venda => {
    const subtotal = input.itens.reduce((acc, i) => acc + i.quantidade * i.valorUnitario, 0);
    const valorTotal = Math.max(0, subtotal - (input.desconto || 0));
    const vendaId = `vnd-${Date.now()}`;
    const codigoNum = String(state.vendas.length + 45).padStart(3, '0');
    const codigo = `VND-2026-${codigoNum}`;

    let contratoId: string | undefined;
    const novosContratos: Contrato[] = [];
    if (input.gerarContrato) {
      contratoId = `ctr-${Date.now()}`;
      const ctrNum = String(state.contratos.length + 1).padStart(3, '0');
      novosContratos.push({
        id: contratoId,
        numero: `CTR-2026-${ctrNum}`,
        clienteId: input.clienteId,
        vendaId,
        descricao:
          input.descricaoContrato?.trim() ||
          input.itens.map((i) => i.descricao).join(', '),
        valorTotal,
        dataInicio: input.data,
        dataTermino: addPeriodToDate(
          input.data,
          input.periodicidade || 'mensal',
          input.qtdParcelas || 12
        ),
        condicoesPagamento:
          input.tipoRecebimento === 'avista'
            ? `À vista via ${input.formaRecebimento}`
            : input.tipoRecebimento === 'parcelado'
            ? `${input.valorEntrada ? `Entrada de R$ ${input.valorEntrada.toFixed(2)} + ` : ''}${input.qtdParcelas || 1}x via ${input.formaRecebimento}`
            : `Recorrente ${input.periodicidade || 'mensal'} via ${input.formaRecebimento}`,
        situacao: 'ativo',
        historico: [
          {
            data: input.data,
            evento: `Contrato criado automaticamente a partir da venda ${codigo}.`,
          },
        ],
      });
    }

    const novasParcelas: Parcela[] = [];
    const novasCobrancas: Cobranca[] = [];
    const novasRecorrencias: Recorrencia[] = [];

    if (input.tipoRecebimento === 'avista') {
      const cobId = `cob-${Date.now()}`;
      const cobNum = String(state.cobrancas.length + 144).padStart(4, '0');
      novasCobrancas.push({
        id: cobId,
        identificador: `COB-2026-${cobNum}`,
        clienteId: input.clienteId,
        referencia: `${codigo} · ${input.itens[0]?.descricao || 'Venda à vista'}`,
        vendaId,
        contratoId,
        valor: valorTotal,
        vencimento: input.data,
        formaPagamento: input.formaRecebimento,
        status: 'pendente',
        linkDemonstrativo: `https://recebefacil.app/demo/cob-${cobNum}`,
      });
    } else if (input.tipoRecebimento === 'parcelado') {
      const entrada = Math.min(valorTotal, input.valorEntrada || 0);
      const qtd = Math.max(1, input.qtdParcelas || 1);
      const saldoParcelado = Math.max(0, valorTotal - entrada);
      const valorParcela = Number((saldoParcelado / qtd).toFixed(2));
      const primeiroVenc = input.primeiroVencimento || addPeriodToDate(input.data, input.periodicidade || 'mensal', 1);

      if (entrada > 0) {
        const pEntId = `prc-ent-${Date.now()}`;
        novasParcelas.push({
          id: pEntId,
          clienteId: input.clienteId,
          vendaId,
          contratoId,
          referenciaLabel: `${codigo} · ${input.itens[0]?.descricao || 'Venda parcelada'}`,
          numeroParcela: 0,
          totalParcelas: qtd,
          vencimento: input.data,
          valor: entrada,
          valorPago: entrada,
          status: 'paga',
          historicoPagamentos: [
            {
              id: `pg-${Date.now()}`,
              data: input.data,
              valor: entrada,
              forma: input.formaRecebimento,
              observacao: 'Entrada registrada no ato da venda',
            },
          ],
        });
      }

      for (let i = 1; i <= qtd; i++) {
        const venc = addPeriodToDate(primeiroVenc, input.periodicidade || 'mensal', i - 1);
        const val =
          i === qtd
            ? Number((saldoParcelado - valorParcela * (qtd - 1)).toFixed(2))
            : valorParcela;
        const pId = `prc-${Date.now()}-${i}`;
        novasParcelas.push({
          id: pId,
          clienteId: input.clienteId,
          vendaId,
          contratoId,
          referenciaLabel: `${codigo} · ${input.itens[0]?.descricao || 'Venda parcelada'}`,
          numeroParcela: i,
          totalParcelas: qtd,
          vencimento: venc,
          valor: val,
          valorPago: 0,
          status: venc < HOJE_DEMO ? 'vencida' : 'pendente',
          historicoPagamentos: [],
        });

        // Gera cobrança para a 1ª parcela automaticamente
        if (i === 1) {
          const cobNum = String(state.cobrancas.length + 144).padStart(4, '0');
          novasCobrancas.push({
            id: `cob-${Date.now()}-${i}`,
            identificador: `COB-2026-${cobNum}`,
            clienteId: input.clienteId,
            referencia: `${codigo} · Parcela 1/${qtd}`,
            vendaId,
            contratoId,
            parcelaId: pId,
            valor: val,
            vencimento: venc,
            formaPagamento: input.formaRecebimento,
            status: venc < HOJE_DEMO ? 'vencida' : 'pendente',
            linkDemonstrativo: `https://recebefacil.app/demo/cob-${cobNum}`,
          });
        }
      }
    } else if (input.tipoRecebimento === 'recorrente') {
      const recId = `rec-${Date.now()}`;
      const recNum = String(state.recorrencias.length + 1).padStart(3, '0');
      const primeira = input.primeiroVencimento || input.data;
      novasRecorrencias.push({
        id: recId,
        codigo: `REC-2026-${recNum}`,
        clienteId: input.clienteId,
        itemId: input.itens[0]?.itemId,
        descricaoServico: input.itens.map((i) => i.descricao).join(', '),
        valor: valorTotal,
        periodicidade: input.periodicidade || 'mensal',
        primeiraCobranca: primeira,
        proximaCobranca: addPeriodToDate(primeira, input.periodicidade || 'mensal', 1),
        formaPagamento: input.formaRecebimento,
        status: 'ativa',
        historico: [
          {
            data: input.data,
            evento: `Recorrência criada pela venda ${codigo} e 1ª cobrança gerada.`,
          },
        ],
      });

      const cobNum = String(state.cobrancas.length + 144).padStart(4, '0');
      novasCobrancas.push({
        id: `cob-${Date.now()}`,
        identificador: `COB-2026-${cobNum}`,
        clienteId: input.clienteId,
        referencia: `REC-2026-${recNum} · ${input.itens[0]?.descricao || 'Recorrência'}`,
        vendaId,
        contratoId,
        recorrenciaId: recId,
        valor: valorTotal,
        vencimento: primeira,
        formaPagamento: input.formaRecebimento,
        status: primeira < HOJE_DEMO ? 'vencida' : 'pendente',
        linkDemonstrativo: `https://recebefacil.app/demo/cob-${cobNum}`,
      });
    }

    const situacaoInicial: SituacaoVenda =
      input.tipoRecebimento === 'parcelado' && (input.valorEntrada || 0) > 0
        ? 'parcialmente_paga'
        : 'aguardando_pagamento';

    const novaVenda: Venda = {
      id: vendaId,
      codigo,
      clienteId: input.clienteId,
      data: input.data,
      itens: input.itens,
      desconto: input.desconto || 0,
      valorTotal,
      observacoes: input.observacoes,
      tipoRecebimento: input.tipoRecebimento,
      formaRecebimento: input.formaRecebimento,
      situacao: situacaoInicial,
      contratoId,
      valorEntrada: input.valorEntrada,
      qtdParcelas: input.qtdParcelas,
      periodicidade: input.periodicidade,
    };

    setState((prev) => ({
      ...prev,
      vendas: [novaVenda, ...prev.vendas],
      contratos: [...novosContratos, ...prev.contratos],
      parcelas: [...prev.parcelas, ...novasParcelas],
      cobrancas: [...novasCobrancas, ...prev.cobrancas],
      recorrencias: [...novasRecorrencias, ...prev.recorrencias],
    }));

    showToast(`Venda ${codigo} registrada e cronograma financeiro atualizado.`);
    return novaVenda;
  };

  const updateVendaSituacao = (id: string, situacao: SituacaoVenda) => {
    setState((prev) => ({
      ...prev,
      vendas: prev.vendas.map((v) => (v.id === id ? { ...v, situacao } : v)),
    }));
    showToast('Situação da venda atualizada.');
  };

  // --- CONTRATOS ---
  const createContrato = (input: Omit<Contrato, 'id' | 'numero' | 'historico'>): Contrato => {
    const num = String(state.contratos.length + 1).padStart(3, '0');
    const novo: Contrato = {
      id: `ctr-${Date.now()}`,
      numero: `CTR-2026-${num}`,
      ...input,
      historico: [
        { data: HOJE_DEMO, evento: 'Contrato cadastrado no RecebeFácil (ambiente demonstrativo).' },
      ],
    };
    setState((prev) => ({
      ...prev,
      contratos: [novo, ...prev.contratos],
    }));
    showToast(`Contrato ${novo.numero} criado com sucesso.`);
    return novo;
  };

  const updateContratoSituacao = (id: string, situacao: SituacaoContrato) => {
    const labels: Record<SituacaoContrato, string> = {
      ativo: 'Ativo',
      concluido: 'Concluído',
      suspenso: 'Suspenso',
      cancelado: 'Cancelado',
    };
    setState((prev) => ({
      ...prev,
      contratos: prev.contratos.map((c) =>
        c.id === id
          ? {
              ...c,
              situacao,
              historico: [
                ...c.historico,
                { data: HOJE_DEMO, evento: `Situação alterada para ${labels[situacao]}.` },
              ],
            }
          : c
      ),
    }));
    showToast(`Contrato marcado como ${labels[situacao]}.`);
  };

  // --- PARCELAS ---
  const registrarPagamentoParcela = (
    parcelaId: string,
    valor: number,
    data: string,
    forma: FormaPagamento,
    observacao?: string
  ) => {
    setState((prev) => {
      const target = prev.parcelas.find((p) => p.id === parcelaId);
      if (!target) return prev;

      const novoValorPago = Math.min(target.valor, Number((target.valorPago + valor).toFixed(2)));
      const quitada = novoValorPago >= target.valor - 0.01;
      const novoStatus = quitada ? 'paga' : novoValorPago > 0 ? 'parcialmente_paga' : target.status;

      const updatedParcelas = prev.parcelas.map((p) =>
        p.id === parcelaId
          ? {
              ...p,
              valorPago: novoValorPago,
              status: novoStatus,
              historicoPagamentos: [
                ...p.historicoPagamentos,
                {
                  id: `pg-${Date.now()}`,
                  data,
                  valor,
                  forma,
                  observacao: observacao || 'Baixa registrada no painel',
                },
              ],
            }
          : p
      );

      // Atualiza cobrança vinculada
      const updatedCobrancas = prev.cobrancas.map((c) => {
        if (c.parcelaId !== parcelaId) return c;
        if (quitada) {
          return { ...c, status: 'paga' as const, dataConfirmacao: data, formaPagamento: forma };
        }
        return { ...c, valor: Math.max(0, Number((target.valor - novoValorPago).toFixed(2))) };
      });

      // Atualiza situação da venda vinculada
      const updatedVendas = prev.vendas.map((v) => {
        if (v.id !== target.vendaId) return v;
        const psVenda = updatedParcelas.filter((p) => p.vendaId === v.id && p.status !== 'cancelada');
        const todasPagas = psVenda.every((p) => p.status === 'paga');
        const algumaPaga = psVenda.some((p) => p.valorPago > 0);
        return {
          ...v,
          situacao: todasPagas ? ('paga' as const) : algumaPaga ? ('parcialmente_paga' as const) : v.situacao,
        };
      });

      return {
        ...prev,
        parcelas: updatedParcelas,
        cobrancas: updatedCobrancas,
        vendas: updatedVendas,
      };
    });
    showToast('Pagamento registrado na parcela com sucesso.');
  };

  const ajustarParcela = (parcelaId: string, novoValor: number, novoVencimento: string) => {
    setState((prev) => ({
      ...prev,
      parcelas: prev.parcelas.map((p) => {
        if (p.id !== parcelaId) return p;
        const novoStatus =
          p.status === 'paga' || p.status === 'cancelada'
            ? p.status
            : novoVencimento < HOJE_DEMO
            ? 'vencida'
            : p.valorPago > 0
            ? 'parcialmente_paga'
            : 'pendente';
        return { ...p, valor: novoValor, vencimento: novoVencimento, status: novoStatus };
      }),
      cobrancas: prev.cobrancas.map((c) =>
        c.parcelaId === parcelaId && c.status !== 'paga'
          ? {
              ...c,
              valor: novoValor,
              vencimento: novoVencimento,
              status: novoVencimento < HOJE_DEMO ? 'vencida' : 'pendente',
            }
          : c
      ),
    }));
    showToast('Valor e vencimento da parcela ajustados.');
  };

  const gerarParcelasParaVenda = (
    vendaId: string,
    valorEntrada: number,
    qtdParcelas: number,
    primeiroVencimento: string,
    periodicidade: Periodicidade
  ) => {
    setState((prev) => {
      const venda = prev.vendas.find((v) => v.id === vendaId);
      if (!venda) return prev;

      const parcelasRestantes = prev.parcelas.filter((p) => p.vendaId !== vendaId);
      const novas: Parcela[] = [];
      const entrada = Math.min(venda.valorTotal, Math.max(0, valorEntrada));
      const saldo = Math.max(0, venda.valorTotal - entrada);
      const valParcela = Number((saldo / qtdParcelas).toFixed(2));

      if (entrada > 0) {
        novas.push({
          id: `prc-ent-${Date.now()}`,
          clienteId: venda.clienteId,
          vendaId: venda.id,
          contratoId: venda.contratoId,
          referenciaLabel: `${venda.codigo} · ${venda.itens[0]?.descricao || 'Parcelamento'}`,
          numeroParcela: 0,
          totalParcelas: qtdParcelas,
          vencimento: venda.data,
          valor: entrada,
          valorPago: entrada,
          status: 'paga',
          historicoPagamentos: [
            { id: `pg-${Date.now()}`, data: venda.data, valor: entrada, forma: venda.formaRecebimento, observacao: 'Entrada' },
          ],
        });
      }

      for (let i = 1; i <= qtdParcelas; i++) {
        const venc = addPeriodToDate(primeiroVencimento, periodicidade, i - 1);
        const val = i === qtdParcelas ? Number((saldo - valParcela * (qtdParcelas - 1)).toFixed(2)) : valParcela;
        novas.push({
          id: `prc-${Date.now()}-${i}`,
          clienteId: venda.clienteId,
          vendaId: venda.id,
          contratoId: venda.contratoId,
          referenciaLabel: `${venda.codigo} · ${venda.itens[0]?.descricao || 'Parcelamento'}`,
          numeroParcela: i,
          totalParcelas: qtdParcelas,
          vencimento: venc,
          valor: val,
          valorPago: 0,
          status: venc < HOJE_DEMO ? 'vencida' : 'pendente',
          historicoPagamentos: [],
        });
      }

      return {
        ...prev,
        parcelas: [...parcelasRestantes, ...novas],
        vendas: prev.vendas.map((v) =>
          v.id === vendaId
            ? {
                ...v,
                tipoRecebimento: 'parcelado',
                valorEntrada: entrada,
                qtdParcelas,
                periodicidade,
                situacao: entrada > 0 ? 'parcialmente_paga' : 'aguardando_pagamento',
              }
            : v
        ),
      };
    });
    showToast(`Cronograma de ${qtdParcelas} parcelas gerado automaticamente.`);
  };

  // --- RECORRÊNCIAS ---
  const createRecorrencia = (input: {
    clienteId: string;
    itemId?: string;
    descricaoServico: string;
    valor: number;
    periodicidade: Periodicidade;
    primeiraCobranca: string;
    dataEncerramento?: string;
    formaPagamento: FormaPagamento;
  }): Recorrencia => {
    const num = String(state.recorrencias.length + 1).padStart(3, '0');
    const nova: Recorrencia = {
      id: `rec-${Date.now()}`,
      codigo: `REC-2026-${num}`,
      clienteId: input.clienteId,
      itemId: input.itemId,
      descricaoServico: input.descricaoServico,
      valor: input.valor,
      periodicidade: input.periodicidade,
      primeiraCobranca: input.primeiraCobranca,
      proximaCobranca: input.primeiraCobranca,
      dataEncerramento: input.dataEncerramento || undefined,
      formaPagamento: input.formaPagamento,
      status: 'ativa',
      historico: [
        { data: HOJE_DEMO, evento: `Assinatura recorrente criada (${input.periodicidade}).` },
      ],
    };

    setState((prev) => ({
      ...prev,
      recorrencias: [nova, ...prev.recorrencias],
    }));
    showToast(`Recorrência ${nova.codigo} criada com sucesso.`);
    return nova;
  };

  const updateRecorrenciaStatus = (id: string, status: StatusRecorrencia) => {
    const label = status === 'ativa' ? 'Retomada' : status === 'suspensa' ? 'Suspensa' : 'Cancelada';
    setState((prev) => ({
      ...prev,
      recorrencias: prev.recorrencias.map((r) =>
        r.id === id
          ? {
              ...r,
              status,
              historico: [
                ...r.historico,
                { data: HOJE_DEMO, evento: `Recorrência ${label.toLowerCase()} pelo usuário.` },
              ],
            }
          : r
      ),
    }));
    showToast(`Recorrência marcada como ${label.toLowerCase()}.`);
  };

  const gerarCobrancaRecorrencia = (id: string) => {
    const rec = state.recorrencias.find((r) => r.id === id);
    if (!rec) return;
    const cobNum = String(state.cobrancas.length + 144).padStart(4, '0');
    const novaCob: Cobranca = {
      id: `cob-${Date.now()}`,
      identificador: `COB-2026-${cobNum}`,
      clienteId: rec.clienteId,
      referencia: `${rec.codigo} · ${rec.descricaoServico}`,
      recorrenciaId: rec.id,
      valor: rec.valor,
      vencimento: rec.proximaCobranca,
      formaPagamento: rec.formaPagamento,
      status: rec.proximaCobranca < HOJE_DEMO ? 'vencida' : 'pendente',
      linkDemonstrativo: `https://recebefacil.app/demo/cob-${cobNum}`,
    };

    const proxima = addPeriodToDate(rec.proximaCobranca, rec.periodicidade, 1);

    setState((prev) => ({
      ...prev,
      cobrancas: [novaCob, ...prev.cobrancas],
      recorrencias: prev.recorrencias.map((r) =>
        r.id === id
          ? {
              ...r,
              proximaCobranca: proxima,
              historico: [
                ...r.historico,
                {
                  data: HOJE_DEMO,
                  evento: `Cobrança ${novaCob.identificador} gerada para ${rec.proximaCobranca}.`,
                },
              ],
            }
          : r
      ),
    }));
    showToast(`Cobrança ${novaCob.identificador} gerada para a recorrência ${rec.codigo}.`);
  };

  // --- COBRANÇAS & INADIMPLÊNCIA ---
  const createCobranca = (input: {
    clienteId: string;
    referencia: string;
    valor: number;
    vencimento: string;
    formaPagamento: FormaPagamento;
    vendaId?: string;
    contratoId?: string;
  }): Cobranca => {
    const cobNum = String(state.cobrancas.length + 144).padStart(4, '0');
    const nova: Cobranca = {
      id: `cob-${Date.now()}`,
      identificador: `COB-2026-${cobNum}`,
      clienteId: input.clienteId,
      referencia: input.referencia,
      vendaId: input.vendaId,
      contratoId: input.contratoId,
      valor: input.valor,
      vencimento: input.vencimento,
      formaPagamento: input.formaPagamento,
      status: input.vencimento < HOJE_DEMO ? 'vencida' : 'pendente',
      linkDemonstrativo: `https://recebefacil.app/demo/cob-${cobNum}`,
    };

    setState((prev) => ({
      ...prev,
      cobrancas: [nova, ...prev.cobrancas],
    }));
    showToast(`Cobrança ${nova.identificador} gerada (modo demonstrativo).`);
    return nova;
  };

  const marcarCobrancaPaga = (id: string) => {
    const cob = state.cobrancas.find((c) => c.id === id);
    if (!cob) return;

    if (cob.parcelaId) {
      const parcela = state.parcelas.find((p) => p.id === cob.parcelaId);
      if (parcela) {
        const restante = Math.max(0, parcela.valor - parcela.valorPago);
        if (restante > 0) {
          registrarPagamentoParcela(parcela.id, restante, HOJE_DEMO, cob.formaPagamento, 'Confirmação via Cobrança');
          return;
        }
      }
    }

    setState((prev) => ({
      ...prev,
      cobrancas: prev.cobrancas.map((c) =>
        c.id === id ? { ...c, status: 'paga', dataConfirmacao: HOJE_DEMO } : c
      ),
      vendas: cob.vendaId
        ? prev.vendas.map((v) =>
            v.id === cob.vendaId && v.tipoRecebimento !== 'parcelado'
              ? { ...v, situacao: 'paga' }
              : v
          )
        : prev.vendas,
    }));
    showToast(`Cobrança ${cob.identificador} confirmada como paga (demonstração).`);
  };

  const cancelarCobranca = (id: string) => {
    setState((prev) => ({
      ...prev,
      cobrancas: prev.cobrancas.map((c) =>
        c.id === id ? { ...c, status: 'cancelada' } : c
      ),
    }));
    showToast('Cobrança cancelada.');
  };

  const estornarCobranca = (id: string) => {
    setState((prev) => ({
      ...prev,
      cobrancas: prev.cobrancas.map((c) =>
        c.id === id ? { ...c, status: 'estornada', dataConfirmacao: HOJE_DEMO } : c
      ),
    }));
    showToast('Estorno demonstrativo registrado na cobrança.');
  };

  const atualizarNegociacaoCobranca = (id: string, status: StatusNegociacao) => {
    setState((prev) => ({
      ...prev,
      cobrancas: prev.cobrancas.map((c) =>
        c.id === id ? { ...c, negociacaoStatus: status } : c
      ),
    }));
    showToast('Status da negociação atualizado.');
  };

  // --- ASAAS (SIMULADO) ---
  const conectarAsaasDemo = () => {
    const now = new Date().toISOString();
    setState((prev) => ({
      ...prev,
      asaas: {
        ...prev.asaas,
        conectado: true,
        ultimaSincronizacao: now,
        eventos: [
          {
            id: `evt-${Date.now()}`,
            data: now,
            tipo: 'CONEXAO_SIMULADA',
            descricao: `Conta demonstrativa conectada no ambiente "${prev.asaas.ambiente}". Nenhuma chave real utilizada.`,
            status: 'sucesso',
          },
          ...prev.asaas.eventos,
        ],
      },
    }));
    showToast('Conexão demonstrativa com Asaas ativada (simulação visual).');
  };

  const desconectarAsaasDemo = () => {
    const now = new Date().toISOString();
    setState((prev) => ({
      ...prev,
      asaas: {
        ...prev.asaas,
        conectado: false,
        eventos: [
          {
            id: `evt-${Date.now()}`,
            data: now,
            tipo: 'DESCONEXAO_SIMULADA',
            descricao: 'Integração simulada desconectada pelo usuário.',
            status: 'info',
          },
          ...prev.asaas.eventos,
        ],
      },
    }));
    showToast('Conexão demonstrativa desconectada.', 'info');
  };

  const mudarAmbienteAsaas = (ambiente: 'demonstracao' | 'sandbox' | 'producao') => {
    const now = new Date().toISOString();
    setState((prev) => ({
      ...prev,
      asaas: {
        ...prev.asaas,
        ambiente,
        eventos: [
          {
            id: `evt-${Date.now()}`,
            data: now,
            tipo: 'AMBIENTE_ALTERADO',
            descricao: `Ambiente visual alterado para "${ambiente.toUpperCase()}".`,
            status: 'info',
          },
          ...prev.asaas.eventos,
        ],
      },
    }));
    showToast(`Ambiente visual alterado para ${ambiente}.`, 'info');
  };

  const sincronizarAsaasDemo = () => {
    const now = new Date().toISOString();
    setState((prev) => ({
      ...prev,
      asaas: {
        ...prev.asaas,
        ultimaSincronizacao: now,
        eventos: [
          {
            id: `evt-${Date.now()}`,
            data: now,
            tipo: 'SYNC_WEBHOOK_SIMULADO',
            descricao: `Simulação de sincronização de ${prev.cobrancas.length} cobranças via Webhook Asaas.`,
            status: 'sucesso',
          },
          ...prev.asaas.eventos,
        ],
      },
    }));
    showToast('Sincronização visual simulada concluída.');
  };

  // --- CONFIGURAÇÕES ---
  const updateConfiguracoes = (novas: ConfiguracoesSistema) => {
    setState((prev) => ({
      ...prev,
      configuracoes: novas,
    }));
    showToast('Configurações salvas no armazenamento local.');
  };

  return (
    <RecebeFacilContext.Provider
      value={{
        state,
        clientesComMetricas,
        toasts,
        showToast,
        dismissToast,
        resetDemoData,
        addCliente,
        updateCliente,
        addContatoCliente,
        addCatalogoItem,
        updateCatalogoItem,
        toggleCatalogoAtivo,
        createVenda,
        updateVendaSituacao,
        createContrato,
        updateContratoSituacao,
        registrarPagamentoParcela,
        ajustarParcela,
        gerarParcelasParaVenda,
        createRecorrencia,
        updateRecorrenciaStatus,
        gerarCobrancaRecorrencia,
        createCobranca,
        marcarCobrancaPaga,
        cancelarCobranca,
        estornarCobranca,
        atualizarNegociacaoCobranca,
        conectarAsaasDemo,
        desconectarAsaasDemo,
        mudarAmbienteAsaas,
        sincronizarAsaasDemo,
        updateConfiguracoes,
      }}
    >
      {hydrated ? children : <p className="p-8 text-sm text-slate-600">Carregando a demonstração...</p>}
    </RecebeFacilContext.Provider>
  );
};

export function useRecebeFacil(): RecebeFacilContextValue {
  const ctx = useContext(RecebeFacilContext);
  if (!ctx) throw new Error('useRecebeFacil deve ser usado dentro de RecebeFacilProvider');
  return ctx;
}
