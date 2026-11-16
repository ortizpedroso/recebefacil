import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  UserPlus,
  Eye,
  Edit2,
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  MessageSquarePlus,
  Users,
} from 'lucide-react';
import { useRecebeFacil } from '../context/RecebeFacilContext';
import { ClienteComMetricas, SituacaoCliente } from '../types/recebefacil';
import { formatBRL, formatDateBR, HOJE_DEMO } from '../utils/formatters';
import {
  getClienteSituacaoBadge,
  getVendaSituacaoBadge,
  getContratoSituacaoBadge,
  getParcelaStatusBadge,
  getCobrancaStatusBadge,
} from '../components/ui/StatusBadge';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';

interface ClientesPageProps {
  initialSelectedClienteId?: string | null;
  openCreateModalSignal?: number;
}

export const ClientesPage: React.FC<ClientesPageProps> = ({
  initialSelectedClienteId,
  openCreateModalSignal,
}) => {
  const { state, clientesComMetricas, addCliente, updateCliente, addContatoCliente, showToast } =
    useRecebeFacil();

  const [busca, setBusca] = useState('');
  const [filtroSituacao, setFiltroSituacao] = useState<'todos' | SituacaoCliente>('todos');
  const [selectedClienteId, setSelectedClienteId] = useState<string | null>(
    initialSelectedClienteId || null
  );
  const [detailTab, setDetailTab] = useState<
    'resumo' | 'vendas' | 'contratos' | 'parcelas' | 'cobrancas' | 'pagamentos' | 'contatos'
  >('resumo');

  // Modal de Cadastro / Edição
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formNome, setFormNome] = useState('');
  const [formCpfCnpj, setFormCpfCnpj] = useState('');
  const [formTelefone, setFormTelefone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formCidade, setFormCidade] = useState('');
  const [formEndereco, setFormEndereco] = useState('');
  const [formObs, setFormObs] = useState('');
  const [formError, setFormError] = useState('');

  // Modal de Novo Contato
  const [contatoModalOpen, setContatoModalOpen] = useState(false);
  const [contatoCanal, setContatoCanal] = useState<'WhatsApp' | 'Ligação' | 'E-mail' | 'Presencial'>('WhatsApp');
  const [contatoResumo, setContatoResumo] = useState('');
  const [contatoPromessa, setContatoPromessa] = useState('');

  useEffect(() => {
    if (initialSelectedClienteId) {
      setSelectedClienteId(initialSelectedClienteId);
    }
  }, [initialSelectedClienteId]);

  useEffect(() => {
    if (openCreateModalSignal && openCreateModalSignal > 0) {
      handleOpenCreate();
    }
  }, [openCreateModalSignal]);

  const filteredClientes = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return clientesComMetricas.filter((c) => {
      if (filtroSituacao !== 'todos' && c.situacao !== filtroSituacao) return false;
      if (!q) return true;
      return (
        c.nome.toLowerCase().includes(q) ||
        c.cpfCnpj.toLowerCase().includes(q) ||
        c.telefone.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)
      );
    });
  }, [clientesComMetricas, busca, filtroSituacao]);

  const selectedCliente: ClienteComMetricas | undefined = useMemo(
    () => clientesComMetricas.find((c) => c.id === selectedClienteId),
    [clientesComMetricas, selectedClienteId]
  );

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormNome('');
    setFormCpfCnpj('');
    setFormTelefone('');
    setFormEmail('');
    setFormCidade('');
    setFormEndereco('');
    setFormObs('');
    setFormError('');
    setModalOpen(true);
  };

  const handleOpenEdit = (cli: ClienteComMetricas) => {
    setEditingId(cli.id);
    setFormNome(cli.nome);
    setFormCpfCnpj(cli.cpfCnpj);
    setFormTelefone(cli.telefone);
    setFormEmail(cli.email);
    setFormCidade(cli.cidade || '');
    setFormEndereco(cli.endereco || '');
    setFormObs(cli.observacoes || '');
    setFormError('');
    setModalOpen(true);
  };

  const handleSubmitCliente = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNome.trim() || !formCpfCnpj.trim() || !formTelefone.trim()) {
      setFormError('Preencha nome, CPF/CNPJ e telefone.');
      return;
    }

    if (editingId) {
      updateCliente(editingId, {
        nome: formNome.trim(),
        cpfCnpj: formCpfCnpj.trim(),
        telefone: formTelefone.trim(),
        email: formEmail.trim(),
        cidade: formCidade.trim() || undefined,
        endereco: formEndereco.trim() || undefined,
        observacoes: formObs.trim() || undefined,
      });
    } else {
      addCliente({
        nome: formNome.trim(),
        cpfCnpj: formCpfCnpj.trim(),
        telefone: formTelefone.trim(),
        email: formEmail.trim(),
        cidade: formCidade.trim() || undefined,
        endereco: formEndereco.trim() || undefined,
        observacoes: formObs.trim() || undefined,
      });
    }
    setModalOpen(false);
  };

  const handleSaveContato = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCliente || !contatoResumo.trim()) {
      showToast('Descreva o resumo do contato.', 'error');
      return;
    }
    addContatoCliente({
      clienteId: selectedCliente.id,
      data: HOJE_DEMO,
      canal: contatoCanal,
      resumo: contatoResumo.trim(),
      promessaPagamentoData: contatoPromessa || undefined,
      responsavel: state.configuracoes.usuario.nome,
    });
    setContatoResumo('');
    setContatoPromessa('');
    setContatoModalOpen(false);
  };

  // --- VIEW DETALHES DO CLIENTE ---
  if (selectedCliente) {
    const vendasCli = state.vendas.filter((v) => v.clienteId === selectedCliente.id);
    const contratosCli = state.contratos.filter((c) => c.clienteId === selectedCliente.id);
    const parcelasCli = state.parcelas.filter((p) => p.clienteId === selectedCliente.id);
    const cobrancasCli = state.cobrancas.filter((c) => c.clienteId === selectedCliente.id);
    const contatosCli = state.contatos.filter((ct) => ct.clienteId === selectedCliente.id);
    const pagamentosCli = [
      ...parcelasCli.flatMap((p) =>
        p.historicoPagamentos.map((pg) => ({
          id: pg.id,
          data: pg.data,
          referencia: `${p.referenciaLabel} (Parcela ${p.numeroParcela === 0 ? 'Entrada' : `${p.numeroParcela}/${p.totalParcelas}`})`,
          forma: pg.forma,
          valor: pg.valor,
        }))
      ),
      ...vendasCli
        .filter((v) => v.tipoRecebimento !== 'parcelado' && v.situacao === 'paga')
        .map((v) => ({
          id: `vpg-${v.id}`,
          data: v.data,
          referencia: `${v.codigo} · ${v.itens[0]?.descricao || 'Venda'}`,
          forma: v.formaRecebimento,
          valor: v.valorTotal,
        })),
    ].sort((a, b) => b.data.localeCompare(a.data));

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setSelectedClienteId(null)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar para listagem de clientes</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setContatoModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700"
            >
              <MessageSquarePlus className="w-3.5 h-3.5" />
              <span>Registrar contato</span>
            </button>
            <button
              type="button"
              onClick={() => handleOpenEdit(selectedCliente)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Editar cadastro</span>
            </button>
          </div>
        </div>

        {/* Cabeçalho do Cliente + Resumo Financeiro */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl font-bold text-slate-900">{selectedCliente.nome}</h1>
                {getClienteSituacaoBadge(selectedCliente.situacao)}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                <span className="font-mono text-slate-700">{selectedCliente.cpfCnpj}</span>
                <span className="inline-flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  {selectedCliente.telefone}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  {selectedCliente.email}
                </span>
                {selectedCliente.cidade && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {selectedCliente.cidade}
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100">
              <div>
                <p className="text-[11px] text-slate-500">Total comprado</p>
                <p className="text-base font-bold text-slate-900 tabular-nums">
                  {formatBRL(selectedCliente.totalComprado)}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Total pago</p>
                <p className="text-base font-bold text-emerald-700 tabular-nums">
                  {formatBRL(selectedCliente.totalPago)}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Saldo em aberto</p>
                <p className="text-base font-bold text-slate-900 tabular-nums">
                  {formatBRL(selectedCliente.saldoEmAberto)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Abas de Histórico Completo */}
        <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-200 pb-px">
          {(
            [
              { id: 'resumo', label: 'Dados cadastrais' },
              { id: 'vendas', label: `Vendas (${vendasCli.length})` },
              { id: 'contratos', label: `Contratos (${contratosCli.length})` },
              { id: 'parcelas', label: `Parcelas (${parcelasCli.length})` },
              { id: 'cobrancas', label: `Cobranças (${cobrancasCli.length})` },
              { id: 'pagamentos', label: `Pagamentos (${pagamentosCli.length})` },
              { id: 'contatos', label: `Histórico de contatos (${contatosCli.length})` },
            ] as { id: typeof detailTab; label: string }[]
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setDetailTab(t.id)}
              className={`px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
                detailTab === t.id
                  ? 'border-teal-700 text-teal-800'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Conteúdo da Aba Selecionada */}
        {detailTab === 'resumo' && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div className="space-y-3">
              <div>
                <p className="text-xs text-slate-500">Nome completo / Razão social</p>
                <p className="font-medium text-slate-900 mt-0.5">{selectedCliente.nome}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">CPF / CNPJ</p>
                <p className="font-mono text-slate-900 mt-0.5">{selectedCliente.cpfCnpj}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">E-mail</p>
                <p className="text-slate-900 mt-0.5">{selectedCliente.email || 'Não informado'}</p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-slate-500">Telefone / WhatsApp</p>
                <p className="text-slate-900 mt-0.5">{selectedCliente.telefone}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Endereço</p>
                <p className="text-slate-900 mt-0.5">
                  {selectedCliente.endereco || 'Não informado'}
                  {selectedCliente.cidade ? ` · ${selectedCliente.cidade}` : ''}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Observações comerciais</p>
                <p className="text-slate-700 mt-0.5">
                  {selectedCliente.observacoes || 'Sem observações cadastradas.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {detailTab === 'vendas' && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
            {vendasCli.length === 0 ? (
              <p className="p-6 text-xs text-slate-500">Nenhuma venda vinculada a este cliente.</p>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                    <th className="py-3 px-4 font-semibold">Código</th>
                    <th className="py-3 px-4 font-semibold">Data</th>
                    <th className="py-3 px-4 font-semibold">Itens</th>
                    <th className="py-3 px-4 font-semibold">Condição</th>
                    <th className="py-3 px-4 font-semibold">Situação</th>
                    <th className="py-3 px-4 font-semibold text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {vendasCli.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-50/60">
                      <td className="py-3 px-4 font-mono font-medium text-slate-900">{v.codigo}</td>
                      <td className="py-3 px-4 tabular-nums text-slate-600">{formatDateBR(v.data)}</td>
                      <td className="py-3 px-4 text-slate-700">
                        {v.itens.map((i) => i.descricao).join(', ')}
                      </td>
                      <td className="py-3 px-4 text-slate-600 capitalize">{v.tipoRecebimento}</td>
                      <td className="py-3 px-4">{getVendaSituacaoBadge(v.situacao)}</td>
                      <td className="py-3 px-4 text-right font-semibold tabular-nums text-slate-900">
                        {formatBRL(v.valorTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {detailTab === 'contratos' && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
            {contratosCli.length === 0 ? (
              <p className="p-6 text-xs text-slate-500">Nenhum contrato registrado para este cliente.</p>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                    <th className="py-3 px-4 font-semibold">Contrato</th>
                    <th className="py-3 px-4 font-semibold">Descrição</th>
                    <th className="py-3 px-4 font-semibold">Vigência</th>
                    <th className="py-3 px-4 font-semibold">Situação</th>
                    <th className="py-3 px-4 font-semibold text-right">Valor total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {contratosCli.map((ctr) => (
                    <tr key={ctr.id} className="hover:bg-slate-50/60">
                      <td className="py-3 px-4 font-mono font-medium text-slate-900">{ctr.numero}</td>
                      <td className="py-3 px-4 text-slate-700">{ctr.descricao}</td>
                      <td className="py-3 px-4 tabular-nums text-slate-600">
                        {formatDateBR(ctr.dataInicio)} – {formatDateBR(ctr.dataTermino)}
                      </td>
                      <td className="py-3 px-4">{getContratoSituacaoBadge(ctr.situacao)}</td>
                      <td className="py-3 px-4 text-right font-semibold tabular-nums text-slate-900">
                        {formatBRL(ctr.valorTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {detailTab === 'parcelas' && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
            {parcelasCli.length === 0 ? (
              <p className="p-6 text-xs text-slate-500">Nenhuma parcela vinculada a este cliente.</p>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                    <th className="py-3 px-4 font-semibold">Parcela</th>
                    <th className="py-3 px-4 font-semibold">Referência</th>
                    <th className="py-3 px-4 font-semibold">Vencimento</th>
                    <th className="py-3 px-4 font-semibold text-right">Valor</th>
                    <th className="py-3 px-4 font-semibold text-right">Pago</th>
                    <th className="py-3 px-4 font-semibold">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parcelasCli.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/60">
                      <td className="py-3 px-4 font-semibold text-slate-900 tabular-nums">
                        {p.numeroParcela === 0 ? 'Entrada' : `${p.numeroParcela}/${p.totalParcelas}`}
                      </td>
                      <td className="py-3 px-4 text-slate-700">{p.referenciaLabel}</td>
                      <td className="py-3 px-4 tabular-nums text-slate-600">{formatDateBR(p.vencimento)}</td>
                      <td className="py-3 px-4 text-right tabular-nums text-slate-900">
                        {formatBRL(p.valor)}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums text-emerald-700 font-medium">
                        {formatBRL(p.valorPago)}
                      </td>
                      <td className="py-3 px-4">{getParcelaStatusBadge(p.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {detailTab === 'cobrancas' && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
            {cobrancasCli.length === 0 ? (
              <p className="p-6 text-xs text-slate-500">Nenhuma cobrança emitida para este cliente.</p>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                    <th className="py-3 px-4 font-semibold">Identificador</th>
                    <th className="py-3 px-4 font-semibold">Referência</th>
                    <th className="py-3 px-4 font-semibold">Vencimento</th>
                    <th className="py-3 px-4 font-semibold">Forma</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cobrancasCli.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/60">
                      <td className="py-3 px-4 font-mono font-medium text-slate-900">{c.identificador}</td>
                      <td className="py-3 px-4 text-slate-700">{c.referencia}</td>
                      <td className="py-3 px-4 tabular-nums text-slate-600">{formatDateBR(c.vencimento)}</td>
                      <td className="py-3 px-4 text-slate-600">{c.formaPagamento}</td>
                      <td className="py-3 px-4">{getCobrancaStatusBadge(c.status)}</td>
                      <td className="py-3 px-4 text-right font-semibold tabular-nums text-slate-900">
                        {formatBRL(c.valor)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {detailTab === 'pagamentos' && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
            {pagamentosCli.length === 0 ? (
              <p className="p-6 text-xs text-slate-500">Nenhum pagamento registrado até o momento.</p>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                    <th className="py-3 px-4 font-semibold">Data</th>
                    <th className="py-3 px-4 font-semibold">Referência</th>
                    <th className="py-3 px-4 font-semibold">Forma</th>
                    <th className="py-3 px-4 font-semibold text-right">Valor pago</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pagamentosCli.map((pg) => (
                    <tr key={pg.id} className="hover:bg-slate-50/60">
                      <td className="py-3 px-4 tabular-nums text-slate-600">{formatDateBR(pg.data)}</td>
                      <td className="py-3 px-4 text-slate-800">{pg.referencia}</td>
                      <td className="py-3 px-4 text-slate-600">{pg.forma}</td>
                      <td className="py-3 px-4 text-right font-semibold tabular-nums text-emerald-700">
                        {formatBRL(pg.valor)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {detailTab === 'contatos' && (
          <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
            {contatosCli.length === 0 ? (
              <p className="p-6 text-xs text-slate-500">Nenhum contato registrado com este cliente.</p>
            ) : (
              contatosCli.map((ct) => (
                <div key={ct.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-semibold text-slate-900">{ct.canal}</span>
                      <span aria-hidden="true" className="text-slate-300">·</span>
                      <span className="text-slate-500 tabular-nums">{formatDateBR(ct.data)}</span>
                      <span aria-hidden="true" className="text-slate-300">·</span>
                      <span className="text-slate-500">Por {ct.responsavel}</span>
                    </div>
                    <p className="text-xs text-slate-700 mt-1">{ct.resumo}</p>
                  </div>
                  {ct.promessaPagamentoData && (
                    <span className="text-[11px] font-medium text-teal-800 bg-teal-50 border border-teal-200 px-2.5 py-1 rounded-md shrink-0 tabular-nums">
                      Promessa: {formatDateBR(ct.promessaPagamentoData)}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Modal Registrar Contato */}
        <Modal
          open={contatoModalOpen}
          onClose={() => setContatoModalOpen(false)}
          title={`Registrar contato — ${selectedCliente.nome}`}
          size="sm"
        >
          <form onSubmit={handleSaveContato} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Canal de contato</label>
              <select
                value={contatoCanal}
                onChange={(e) => setContatoCanal(e.target.value as typeof contatoCanal)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-slate-800"
              >
                <option value="WhatsApp">WhatsApp</option>
                <option value="Ligação">Ligação</option>
                <option value="E-mail">E-mail</option>
                <option value="Presencial">Presencial</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Resumo da conversa *</label>
              <textarea
                rows={3}
                required
                value={contatoResumo}
                onChange={(e) => setContatoResumo(e.target.value)}
                placeholder="Descreva o que foi tratado com o cliente..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Promessa de pagamento (opcional)
              </label>
              <input
                type="date"
                value={contatoPromessa}
                onChange={(e) => setContatoPromessa(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setContatoModalOpen(false)}
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
      </div>
    );
  }

  // --- VIEW LISTAGEM DE CLIENTES ---
  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Clientes</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Consulte histórico financeiro, contratos, parcelas e contatos de cada cliente.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold transition-colors whitespace-nowrap self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>Novo cliente</span>
        </button>
      </div>

      {/* Filtros e Pesquisa */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Pesquisar por nome, CPF/CNPJ, telefone ou e-mail..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-teal-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'todos', label: 'Todos' },
              { id: 'em_dia', label: 'Em dia' },
              { id: 'com_pendencias', label: 'Com pendências' },
              { id: 'inadimplente', label: 'Inadimplentes' },
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

      {/* Tabela de Clientes */}
      {filteredClientes.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum cliente encontrado"
          description="Ajuste os filtros de busca ou cadastre um novo cliente na base demonstrativa."
          actionLabel="Cadastrar cliente"
          onAction={handleOpenCreate}
        />
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <th className="py-3 px-4 font-semibold">Nome</th>
                <th className="py-3 px-4 font-semibold">CPF / CNPJ</th>
                <th className="py-3 px-4 font-semibold">Telefone / E-mail</th>
                <th className="py-3 px-4 font-semibold text-right">Total comprado</th>
                <th className="py-3 px-4 font-semibold text-right">Total pago</th>
                <th className="py-3 px-4 font-semibold text-right">Saldo em aberto</th>
                <th className="py-3 px-4 font-semibold">Situação</th>
                <th className="py-3 px-4 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredClientes.map((cli) => (
                <tr key={cli.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedClienteId(cli.id);
                        setDetailTab('resumo');
                      }}
                      className="hover:text-teal-700 hover:underline text-left"
                    >
                      {cli.nome}
                    </button>
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">{cli.cpfCnpj}</td>
                  <td className="py-3 px-4 text-slate-600">
                    <div className="whitespace-nowrap">{cli.telefone}</div>
                    <div className="text-[11px] text-slate-400 truncate max-w-[180px]">{cli.email}</div>
                  </td>
                  <td className="py-3 px-4 text-right font-medium text-slate-900 tabular-nums whitespace-nowrap">
                    {formatBRL(cli.totalComprado)}
                  </td>
                  <td className="py-3 px-4 text-right font-medium text-emerald-700 tabular-nums whitespace-nowrap">
                    {formatBRL(cli.totalPago)}
                  </td>
                  <td className="py-3 px-4 text-right font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                    {formatBRL(cli.saldoEmAberto)}
                  </td>
                  <td className="py-3 px-4">{getClienteSituacaoBadge(cli.situacao)}</td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedClienteId(cli.id);
                          setDetailTab('resumo');
                        }}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-teal-700 hover:bg-teal-50 transition-colors"
                        title="Visualizar detalhes"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(cli)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                        title="Editar cliente"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Cadastrar / Editar Cliente */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Editar cliente' : 'Cadastrar novo cliente'}
        subtitle="O cadastro entra na demonstração. A cobrança no Asaas continua simulada."
        size="md"
      >
        <form onSubmit={handleSubmitCliente} className="space-y-4 text-xs">
          {formError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 font-medium">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Nome completo ou Razão social *</label>
              <input
                type="text"
                required
                value={formNome}
                onChange={(e) => setFormNome(e.target.value)}
                placeholder="Ex: João Silva"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">CPF / CNPJ *</label>
              <input
                type="text"
                required
                value={formCpfCnpj}
                onChange={(e) => setFormCpfCnpj(e.target.value)}
                placeholder="000.000.000-00"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono focus:outline-none focus:border-teal-600"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Telefone / WhatsApp *</label>
              <input
                type="text"
                required
                value={formTelefone}
                onChange={(e) => setFormTelefone(e.target.value)}
                placeholder="(11) 99999-9999"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">E-mail</label>
              <input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="cliente@email.com"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Cidade / UF</label>
              <input
                type="text"
                value={formCidade}
                onChange={(e) => setFormCidade(e.target.value)}
                placeholder="São Paulo - SP"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Endereço</label>
              <input
                type="text"
                value={formEndereco}
                onChange={(e) => setFormEndereco(e.target.value)}
                placeholder="Rua, número e bairro"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Observações</label>
              <textarea
                rows={2}
                value={formObs}
                onChange={(e) => setFormObs(e.target.value)}
                placeholder="Informações úteis para atendimento ou cobrança..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-semibold"
            >
              {editingId ? 'Salvar alterações' : 'Cadastrar cliente'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
