import React, { useState } from 'react';
import {
  Building2,
  User,
  Users,
  Bell,
  MessageSquare,
  Plug,
  Sliders,
  Save,
  Plus,
  ArrowRight,
} from 'lucide-react';
import { useRecebeFacil } from '../context/RecebeFacilContext';
import {
  ConfiguracoesSistema,
  FormaPagamento,
  MenuRoute,
  UsuarioEquipe,
} from '../types/recebefacil';
import { StatusBadge } from '../components/ui/StatusBadge';
import { AsaasLogo } from '../components/ui/BrandLogos';
import { Modal } from '../components/ui/Modal';
import avatarUserImg from '../assets/images/avatar_recebefacil_user_1794841800339.jpg';

interface ConfiguracoesPageProps {
  onNavigate: (route: MenuRoute) => void;
}

type ConfigTab =
  | 'empresa'
  | 'perfil'
  | 'equipe'
  | 'notificacoes'
  | 'mensagens'
  | 'integracoes'
  | 'financeiro';

export const ConfiguracoesPage: React.FC<ConfiguracoesPageProps> = ({ onNavigate }) => {
  const { state, updateConfiguracoes } = useRecebeFacil();
  const [activeTab, setActiveTab] = useState<ConfigTab>('empresa');
  const [draft, setDraft] = useState<ConfiguracoesSistema>(state.configuracoes);

  // Modal adicionar membro equipe
  const [newUserOpen, setNewUserOpen] = useState(false);
  const [uNome, setUNome] = useState('');
  const [uEmail, setUEmail] = useState('');
  const [uPapel, setUPapel] = useState<UsuarioEquipe['papel']>('Vendedor');

  const tabs: { id: ConfigTab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'empresa', label: 'Dados da empresa', icon: Building2 },
    { id: 'perfil', label: 'Perfil do usuário', icon: User },
    { id: 'equipe', label: 'Usuários e permissões', icon: Users },
    { id: 'notificacoes', label: 'Notificações', icon: Bell },
    { id: 'mensagens', label: 'Modelos de mensagens', icon: MessageSquare },
    { id: 'integracoes', label: 'Integrações', icon: Plug },
    { id: 'financeiro', label: 'Preferências financeiras', icon: Sliders },
  ];

  const handleSaveAll = (e: React.FormEvent) => {
    e.preventDefault();
    updateConfiguracoes(draft);
  };

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uNome.trim() || !uEmail.trim()) return;
    const novo: UsuarioEquipe = {
      id: `usr-${Date.now()}`,
      nome: uNome.trim(),
      email: uEmail.trim(),
      papel: uPapel,
      ativo: true,
    };
    const next = {
      ...draft,
      usuariosEquipe: [...draft.usuariosEquipe, novo],
    };
    setDraft(next);
    updateConfiguracoes(next);
    setNewUserOpen(false);
    setUNome('');
    setUEmail('');
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
          Configurações
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Personalize dados da empresa, equipe, alertas, modelos de cobrança e regras financeiras.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 items-start">
        {/* Menu lateral das abas */}
        <div className="bg-white border border-slate-200 rounded-xl p-2 space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs transition-colors ${
                  isActive
                    ? 'bg-teal-50 text-teal-800 font-semibold'
                    : 'text-slate-600 hover:bg-slate-50 font-medium'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${isActive ? 'text-teal-700' : 'text-slate-400'}`}
                />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Conteúdo da aba selecionada */}
        <form
          onSubmit={handleSaveAll}
          className="lg:col-span-3 bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-5 text-xs"
        >
          {activeTab === 'empresa' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Dados da empresa</h2>
                <p className="text-slate-500 mt-0.5">
                  Informações exibidas em cabeçalhos de contratos e prévias de cobrança.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nome fantasia</label>
                  <input
                    type="text"
                    value={draft.empresa.nomeFantasia}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        empresa: { ...draft.empresa, nomeFantasia: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Razão social</label>
                  <input
                    type="text"
                    value={draft.empresa.razaoSocial}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        empresa: { ...draft.empresa, razaoSocial: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">CNPJ</label>
                  <input
                    type="text"
                    value={draft.empresa.cnpj}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        empresa: { ...draft.empresa, cnpj: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Telefone</label>
                  <input
                    type="text"
                    value={draft.empresa.telefone}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        empresa: { ...draft.empresa, telefone: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    E-mail comercial
                  </label>
                  <input
                    type="email"
                    value={draft.empresa.email}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        empresa: { ...draft.empresa, email: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Slogan</label>
                  <input
                    type="text"
                    value={draft.empresa.slogan}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        empresa: { ...draft.empresa, slogan: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Endereço</label>
                  <input
                    type="text"
                    value={draft.empresa.endereco}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        empresa: { ...draft.empresa, endereco: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'perfil' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Perfil do usuário</h2>
                <p className="text-slate-500 mt-0.5">
                  Dados da gestora ou operador responsável pelos registros.
                </p>
              </div>
              <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <img
                  src={avatarUserImg}
                  alt={draft.usuario.nome}
                  className="w-14 h-14 rounded-full object-cover border border-slate-200"
                />
                <div>
                  <p className="text-sm font-bold text-slate-900">{draft.usuario.nome}</p>
                  <p className="text-slate-500">{draft.usuario.cargo}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nome completo</label>
                  <input
                    type="text"
                    value={draft.usuario.nome}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        usuario: { ...draft.usuario, nome: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Cargo</label>
                  <input
                    type="text"
                    value={draft.usuario.cargo}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        usuario: { ...draft.usuario, cargo: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">E-mail</label>
                  <input
                    type="email"
                    value={draft.usuario.email}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        usuario: { ...draft.usuario, email: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Telefone</label>
                  <input
                    type="text"
                    value={draft.usuario.telefone}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        usuario: { ...draft.usuario, telefone: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'equipe' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Usuários e permissões</h2>
                  <p className="text-slate-500 mt-0.5">
                    Gerencie perfis de acesso demonstrativos da equipe comercial e financeira.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setNewUserOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Adicionar usuário</span>
                </button>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                      <th className="py-2.5 px-4 font-semibold">Nome</th>
                      <th className="py-2.5 px-4 font-semibold">E-mail</th>
                      <th className="py-2.5 px-4 font-semibold">Perfil</th>
                      <th className="py-2.5 px-4 font-semibold text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {draft.usuariosEquipe.map((usr, idx) => (
                      <tr key={usr.id}>
                        <td className="py-2.5 px-4 font-semibold text-slate-900">{usr.nome}</td>
                        <td className="py-2.5 px-4 text-slate-600">{usr.email}</td>
                        <td className="py-2.5 px-4">
                          <select
                            value={usr.papel}
                            onChange={(e) => {
                              const nextUsers = [...draft.usuariosEquipe];
                              nextUsers[idx] = {
                                ...usr,
                                papel: e.target.value as UsuarioEquipe['papel'],
                              };
                              setDraft({ ...draft, usuariosEquipe: nextUsers });
                            }}
                            className="px-2 py-1 border border-slate-200 rounded bg-white"
                          >
                            <option value="Administrador">Administrador</option>
                            <option value="Financeiro">Financeiro</option>
                            <option value="Vendedor">Vendedor</option>
                          </select>
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              const nextUsers = [...draft.usuariosEquipe];
                              nextUsers[idx] = { ...usr, ativo: !usr.ativo };
                              setDraft({ ...draft, usuariosEquipe: nextUsers });
                            }}
                            className="inline-flex"
                          >
                            <StatusBadge
                              label={usr.ativo ? 'Ativo' : 'Inativo'}
                              variant={usr.ativo ? 'success' : 'neutral'}
                            />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'notificacoes' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Notificações</h2>
                <p className="text-slate-500 mt-0.5">
                  Configure alertas preventivos de vencimentos e acompanhamento de atrasos.
                </p>
              </div>
              <div className="space-y-3">
                <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 cursor-pointer">
                  <div>
                    <p className="font-semibold text-slate-900">
                      Alertar antes do vencimento das cobranças
                    </p>
                    <p className="text-slate-500 mt-0.5">
                      Destaca cobranças próximas do vencimento na central de alertas.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={draft.notificacoes.lembreteAntesVencimento}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        notificacoes: {
                          ...draft.notificacoes,
                          lembreteAntesVencimento: e.target.checked,
                        },
                      })
                    }
                    className="w-4 h-4 accent-teal-700"
                  />
                </label>

                <div className="p-3.5 rounded-xl border border-slate-200 flex items-center justify-between gap-4">
                  <span className="font-semibold text-slate-900">
                    Antecedência do lembrete (dias)
                  </span>
                  <input
                    type="number"
                    min="1"
                    max="15"
                    value={draft.notificacoes.diasAntes}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        notificacoes: {
                          ...draft.notificacoes,
                          diasAntes: Number(e.target.value) || 3,
                        },
                      })
                    }
                    className="w-20 px-3 py-1.5 border border-slate-200 rounded-lg text-right tabular-nums"
                  />
                </div>

                <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 cursor-pointer">
                  <div>
                    <p className="font-semibold text-slate-900">Alertas de inadimplência</p>
                    <p className="text-slate-500 mt-0.5">
                      Exibir contador de cobranças vencidas no menu lateral.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={draft.notificacoes.alertaAtraso}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        notificacoes: {
                          ...draft.notificacoes,
                          alertaAtraso: e.target.checked,
                        },
                      })
                    }
                    className="w-4 h-4 accent-teal-700"
                  />
                </label>

                <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 cursor-pointer">
                  <div>
                    <p className="font-semibold text-slate-900">Resumo diário por e-mail (planejado)</p>
                    <p className="text-slate-500 mt-0.5">
                      Preferência visual para envio consolidado quando conectado a backend.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={draft.notificacoes.resumoDiarioEmail}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        notificacoes: {
                          ...draft.notificacoes,
                          resumoDiarioEmail: e.target.checked,
                        },
                      })
                    }
                    className="w-4 h-4 accent-teal-700"
                  />
                </label>
              </div>
            </div>
          )}

          {activeTab === 'mensagens' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Modelos de mensagens</h2>
                <p className="text-slate-500 mt-0.5">
                  Variáveis disponíveis: {'{nome}'}, {'{referencia}'}, {'{valor}'} e {'{vencimento}'}.
                </p>
              </div>
              <div className="space-y-3">
                {draft.modelosMensagem.map((m, idx) => (
                  <div key={m.id} className="border border-slate-200 rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900">{m.titulo}</span>
                      <span className="text-[11px] text-slate-500 capitalize">{m.tipo}</span>
                    </div>
                    <textarea
                      rows={3}
                      value={m.texto}
                      onChange={(e) => {
                        const next = [...draft.modelosMensagem];
                        next[idx] = { ...m, texto: e.target.value };
                        setDraft({ ...draft, modelosMensagem: next });
                      }}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'integracoes' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Integrações conectadas</h2>
                <p className="text-slate-500 mt-0.5">
                  Resumo da conexão simulada com o provedor externo de pagamentos.
                </p>
              </div>
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-3">
                    <AsaasLogo className="h-6" />
                    <StatusBadge
                      label={state.asaas.conectado ? 'Conectado (Simulado)' : 'Desconectado'}
                      variant={state.asaas.conectado ? 'success' : 'neutral'}
                    />
                  </div>
                  <p className="text-slate-600">
                    Ambiente atual: <span className="font-semibold uppercase">{state.asaas.ambiente}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('integracoes')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold self-start sm:self-auto"
                >
                  <span>Gerenciar integração</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {activeTab === 'financeiro' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Preferências financeiras</h2>
                <p className="text-slate-500 mt-0.5">
                  Parâmetros padrão usados ao criar vendas e cobranças no sistema.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Multa por atraso padrão (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={draft.financeiro.multaAtrasoPercent}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        financeiro: {
                          ...draft.financeiro,
                          multaAtrasoPercent: Number(e.target.value) || 0,
                        },
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Juros ao mês padrão (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={draft.financeiro.jurosMesPercent}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        financeiro: {
                          ...draft.financeiro,
                          jurosMesPercent: Number(e.target.value) || 0,
                        },
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Dias de tolerância após vencimento
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={draft.financeiro.diasTolerancia}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        financeiro: {
                          ...draft.financeiro,
                          diasTolerancia: Number(e.target.value) || 0,
                        },
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Forma de recebimento padrão
                  </label>
                  <select
                    value={draft.financeiro.formaPadrao}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        financeiro: {
                          ...draft.financeiro,
                          formaPadrao: e.target.value as FormaPagamento,
                        },
                      })
                    }
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
            </div>
          )}

          {activeTab !== 'integracoes' && (
            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-semibold transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Salvar alterações</span>
              </button>
            </div>
          )}
        </form>
      </div>

      {/* Modal Adicionar Usuário da Equipe */}
      <Modal
        open={newUserOpen}
        onClose={() => setNewUserOpen(false)}
        title="Adicionar membro à equipe"
        subtitle="Cadastro demonstrativo de usuário operacional."
        size="sm"
      >
        <form onSubmit={handleAddMember} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Nome *</label>
            <input
              type="text"
              required
              value={uNome}
              onChange={(e) => setUNome(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">E-mail *</label>
            <input
              type="email"
              required
              value={uEmail}
              onChange={(e) => setUEmail(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Perfil de acesso</label>
            <select
              value={uPapel}
              onChange={(e) => setUPapel(e.target.value as UsuarioEquipe['papel'])}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
            >
              <option value="Administrador">Administrador</option>
              <option value="Financeiro">Financeiro</option>
              <option value="Vendedor">Vendedor</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setNewUserOpen(false)}
              className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-semibold"
            >
              Adicionar
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
