export type MenuRoute =
  | 'visao-geral'
  | 'clientes'
  | 'produtos-servicos'
  | 'vendas'
  | 'contratos'
  | 'parcelas'
  | 'recorrencias'
  | 'cobrancas'
  | 'inadimplencia'
  | 'relatorios'
  | 'integracoes'
  | 'configuracoes'
  | 'ajuda';

export type FormaPagamento =
  | 'Pix'
  | 'Boleto'
  | 'Cartão de Crédito'
  | 'Transferência'
  | 'Dinheiro';

export type SituacaoCliente = 'em_dia' | 'com_pendencias' | 'inadimplente';

export interface Cliente {
  id: string;
  nome: string;
  cpfCnpj: string;
  telefone: string;
  email: string;
  cidade?: string;
  endereco?: string;
  observacoes?: string;
  criadoEm: string;
}

export interface ClienteComMetricas extends Cliente {
  totalComprado: number;
  totalPago: number;
  saldoEmAberto: number;
  situacao: SituacaoCliente;
}

export interface ContatoCliente {
  id: string;
  clienteId: string;
  cobrancaId?: string;
  data: string;
  canal: 'WhatsApp' | 'Ligação' | 'E-mail' | 'Presencial';
  resumo: string;
  promessaPagamentoData?: string;
  responsavel: string;
}

export type TipoCatalogo = 'produto' | 'servico';
export type TipoServico = 'pontual' | 'recorrente';

export interface CatalogoItem {
  id: string;
  tipoCatalogo: TipoCatalogo;
  nome: string;
  descricao: string;
  categoria: string;
  preco: number;
  codigoReferencia?: string;
  tipoServico?: TipoServico;
  ativo: boolean;
  criadoEm: string;
}

export type TipoRecebimento = 'avista' | 'parcelado' | 'recorrente';
export type SituacaoVenda =
  | 'rascunho'
  | 'aguardando_pagamento'
  | 'parcialmente_paga'
  | 'paga'
  | 'cancelada';

export interface VendaItem {
  id: string;
  itemId?: string;
  descricao: string;
  tipoCatalogo: TipoCatalogo;
  quantidade: number;
  valorUnitario: number;
}

export type Periodicidade =
  | 'semanal'
  | 'quinzenal'
  | 'mensal'
  | 'trimestral'
  | 'semestral'
  | 'anual';

export interface Venda {
  id: string;
  codigo: string;
  clienteId: string;
  data: string;
  itens: VendaItem[];
  desconto: number;
  valorTotal: number;
  observacoes?: string;
  tipoRecebimento: TipoRecebimento;
  formaRecebimento: FormaPagamento;
  situacao: SituacaoVenda;
  contratoId?: string;
  valorEntrada?: number;
  qtdParcelas?: number;
  periodicidade?: Periodicidade;
}

export type SituacaoContrato = 'ativo' | 'concluido' | 'suspenso' | 'cancelado';

export interface Contrato {
  id: string;
  numero: string;
  clienteId: string;
  vendaId?: string;
  descricao: string;
  valorTotal: number;
  dataInicio: string;
  dataTermino: string;
  condicoesPagamento: string;
  situacao: SituacaoContrato;
  historico: { data: string; evento: string }[];
}

export type StatusParcela =
  | 'pendente'
  | 'paga'
  | 'parcialmente_paga'
  | 'vencida'
  | 'cancelada';

export interface PagamentoParcela {
  id: string;
  data: string;
  valor: number;
  forma: FormaPagamento;
  observacao?: string;
}

export interface Parcela {
  id: string;
  clienteId: string;
  vendaId?: string;
  contratoId?: string;
  referenciaLabel: string;
  numeroParcela: number;
  totalParcelas: number;
  vencimento: string;
  valor: number;
  valorPago: number;
  status: StatusParcela;
  historicoPagamentos: PagamentoParcela[];
}

export type StatusRecorrencia = 'ativa' | 'suspensa' | 'cancelada';

export interface Recorrencia {
  id: string;
  codigo: string;
  clienteId: string;
  itemId?: string;
  descricaoServico: string;
  valor: number;
  periodicidade: Periodicidade;
  primeiraCobranca: string;
  proximaCobranca: string;
  dataEncerramento?: string;
  formaPagamento: FormaPagamento;
  status: StatusRecorrencia;
  historico: { data: string; evento: string }[];
}

export type StatusCobranca =
  | 'pendente'
  | 'paga'
  | 'vencida'
  | 'cancelada'
  | 'estornada';

export type StatusNegociacao =
  | 'sem_contato'
  | 'em_contato'
  | 'promessa_pagamento'
  | 'acordo_firmado';

export interface Cobranca {
  id: string;
  identificador: string;
  clienteId: string;
  referencia: string;
  vendaId?: string;
  contratoId?: string;
  parcelaId?: string;
  recorrenciaId?: string;
  valor: number;
  vencimento: string;
  formaPagamento: FormaPagamento;
  status: StatusCobranca;
  dataConfirmacao?: string;
  linkDemonstrativo: string;
  negociacaoStatus?: StatusNegociacao;
}

export interface AsaasEvento {
  id: string;
  data: string;
  tipo: string;
  descricao: string;
  status: 'sucesso' | 'info';
}

export interface AsaasIntegracao {
  conectado: boolean;
  ambiente: 'demonstracao' | 'sandbox' | 'producao';
  ultimaSincronizacao: string | null;
  contaSimuladaNome: string;
  eventos: AsaasEvento[];
}

export interface ModeloMensagem {
  id: string;
  titulo: string;
  tipo: 'lembrete' | 'atraso' | 'agradecimento';
  texto: string;
}

export interface UsuarioEquipe {
  id: string;
  nome: string;
  email: string;
  papel: 'Administrador' | 'Financeiro' | 'Vendedor';
  ativo: boolean;
}

export interface ConfiguracoesSistema {
  empresa: {
    nomeFantasia: string;
    razaoSocial: string;
    cnpj: string;
    telefone: string;
    email: string;
    endereco: string;
    slogan: string;
  };
  usuario: {
    nome: string;
    email: string;
    cargo: string;
    telefone: string;
  };
  usuariosEquipe: UsuarioEquipe[];
  notificacoes: {
    lembreteAntesVencimento: boolean;
    diasAntes: number;
    alertaAtraso: boolean;
    resumoDiarioEmail: boolean;
  };
  modelosMensagem: ModeloMensagem[];
  financeiro: {
    multaAtrasoPercent: number;
    jurosMesPercent: number;
    diasTolerancia: number;
    formaPadrao: FormaPagamento;
  };
}

export interface RecebeFacilState {
  clientes: Cliente[];
  contatos: ContatoCliente[];
  catalogo: CatalogoItem[];
  vendas: Venda[];
  contratos: Contrato[];
  parcelas: Parcela[];
  recorrencias: Recorrencia[];
  cobrancas: Cobranca[];
  asaas: AsaasIntegracao;
  configuracoes: ConfiguracoesSistema;
}
