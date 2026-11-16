import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  Package,
  ShoppingCart,
  FileText,
  CalendarClock,
  Repeat,
  Receipt,
  AlertTriangle,
  BarChart3,
  Plug,
  Settings,
  HelpCircle,
  Search,
  Bell,
  Menu,
  X,
  RotateCcw,
  ChevronDown,
  LogOut,
  UserCheck,
} from 'lucide-react';
import { MenuRoute } from '../../types/recebefacil';
import { useRecebeFacil } from '../../context/RecebeFacilContext';
import { RecebeFacilLogo } from '../ui/BrandLogos';
import { ConfirmModal } from '../ui/ConfirmModal';
import { formatBRL, formatDateBR } from '../../utils/formatters';
import avatarUserImg from '../../assets/images/avatar_recebefacil_user_1794841800339.jpg';

interface AppShellProps {
  activeRoute: MenuRoute;
  onNavigate: (route: MenuRoute, entityId?: string) => void;
  children: React.ReactNode;
}

interface NavItem {
  id: MenuRoute;
  label: string;
  icon: React.FC<{ className?: string }>;
  badgeCount?: number;
}

export const AppShell: React.FC<AppShellProps> = ({
  activeRoute,
  onNavigate,
  children,
}) => {
  const { state, resetDemoData } = useRecebeFacil();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const overdueCobrancas = useMemo(
    () => state.cobrancas.filter((c) => c.status === 'vencida'),
    [state.cobrancas]
  );

  const pendingCobrancas = useMemo(
    () => state.cobrancas.filter((c) => c.status === 'pendente'),
    [state.cobrancas]
  );

  const mainNavItems: NavItem[] = [
    { id: 'visao-geral', label: 'Visão geral', icon: LayoutDashboard },
    { id: 'clientes', label: 'Clientes', icon: Users },
    { id: 'produtos-servicos', label: 'Produtos e serviços', icon: Package },
    { id: 'vendas', label: 'Vendas', icon: ShoppingCart },
    { id: 'contratos', label: 'Contratos', icon: FileText },
    { id: 'parcelas', label: 'Parcelas', icon: CalendarClock },
    { id: 'recorrencias', label: 'Recorrências', icon: Repeat },
    { id: 'cobrancas', label: 'Cobranças e recebimentos', icon: Receipt },
    {
      id: 'inadimplencia',
      label: 'Inadimplência',
      icon: AlertTriangle,
      badgeCount: overdueCobrancas.length,
    },
    { id: 'relatorios', label: 'Relatórios', icon: BarChart3 },
  ];

  const footerNavItems: NavItem[] = [
    { id: 'integracoes', label: 'Integrações', icon: Plug },
    { id: 'configuracoes', label: 'Configurações', icon: Settings },
    { id: 'ajuda', label: 'Ajuda e suporte', icon: HelpCircle },
  ];

  const routeLabelMap: Record<MenuRoute, string> = {
    'visao-geral': 'Visão geral',
    clientes: 'Clientes',
    'produtos-servicos': 'Produtos e serviços',
    vendas: 'Vendas',
    contratos: 'Contratos',
    parcelas: 'Parcelas',
    recorrencias: 'Recorrências',
    cobrancas: 'Cobranças e recebimentos',
    inadimplencia: 'Inadimplência',
    relatorios: 'Relatórios',
    integracoes: 'Integrações',
    configuracoes: 'Configurações',
    ajuda: 'Ajuda e suporte',
  };

  // Busca global em clientes, vendas e cobranças
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const results: { type: string; title: string; subtitle: string; route: MenuRoute; entityId?: string }[] = [];

    state.clientes
      .filter((c) => c.nome.toLowerCase().includes(q) || c.cpfCnpj.includes(q))
      .slice(0, 3)
      .forEach((c) => {
        results.push({
          type: 'Cliente',
          title: c.nome,
          subtitle: c.cpfCnpj,
          route: 'clientes',
          entityId: c.id,
        });
      });

    state.vendas
      .filter(
        (v) =>
          v.codigo.toLowerCase().includes(q) ||
          v.itens.some((i) => i.descricao.toLowerCase().includes(q))
      )
      .slice(0, 3)
      .forEach((v) => {
        results.push({
          type: 'Venda',
          title: v.codigo,
          subtitle: `${formatBRL(v.valorTotal)} · ${formatDateBR(v.data)}`,
          route: 'vendas',
        });
      });

    state.cobrancas
      .filter(
        (c) =>
          c.identificador.toLowerCase().includes(q) ||
          c.referencia.toLowerCase().includes(q)
      )
      .slice(0, 3)
      .forEach((c) => {
        results.push({
          type: 'Cobrança',
          title: c.identificador,
          subtitle: `${formatBRL(c.valor)} · ${c.referencia}`,
          route: 'cobrancas',
        });
      });

    return results;
  }, [searchQuery, state.clientes, state.vendas, state.cobrancas]);

  const handleSelectNav = (id: MenuRoute) => {
    onNavigate(id);
    setMobileMenuOpen(false);
  };

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      <div className="h-16 px-5 flex items-center justify-between border-b border-slate-200 shrink-0">
        <button
          type="button"
          onClick={() => handleSelectNav('visao-geral')}
          className="text-left focus:outline-none"
        >
          <RecebeFacilLogo />
        </button>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          aria-label="Fechar menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="Menu principal">
        {mainNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeRoute === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelectNav(item.id)}
              className={`w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-teal-50 text-teal-800 font-semibold'
                  : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 font-medium'
              }`}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-teal-700' : 'text-slate-400'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </span>
              {typeof item.badgeCount === 'number' && item.badgeCount > 0 && (
                <span className="px-1.5 py-0.5 text-[11px] font-semibold rounded bg-rose-50 text-rose-700 border border-rose-200 tabular-nums shrink-0">
                  {item.badgeCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="px-3 py-3 border-t border-slate-200 space-y-1 shrink-0 bg-slate-50/50">
        {footerNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeRoute === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelectNav(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-teal-50 text-teal-800 font-semibold'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
              }`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 ${
                  isActive ? 'text-teal-700' : 'text-slate-400'
                }`}
              />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}

        <div className="pt-2 px-3 flex items-center justify-between text-[11px] text-slate-400">
          <span>Ambiente demonstrativo</span>
          <button
            type="button"
            onClick={() => setConfirmResetOpen(true)}
            className="text-slate-500 hover:text-teal-700 font-medium inline-flex items-center gap-1 transition-colors"
            title="Restaurar dados iniciais de demonstração"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Resetar</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Sidebar fixa no Desktop */}
      <aside className="hidden lg:block w-[260px] shrink-0 sticky top-0 h-screen">
        {renderSidebarContent()}
      </aside>

      {/* Drawer Mobile */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px]"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-[270px] max-w-[82vw] h-full z-10">
            {renderSidebarContent()}
          </div>
        </div>
      )}

      {/* Área Principal */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-30 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
              aria-label="Abrir menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="hidden sm:inline">{state.configuracoes.empresa.nomeFantasia}</span>
                <span className="hidden sm:inline" aria-hidden="true">/</span>
                <span className="font-semibold text-slate-900 truncate">
                  {routeLabelMap[activeRoute]}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Protótipo navegável · Dados financeiros demonstrativos
              </p>
            </div>
          </div>

          {/* Pesquisa, Notificações e Perfil */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Busca Global */}
            <div className="relative hidden md:block w-64 lg:w-80" ref={searchRef}>
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onFocus={() => setSearchOpen(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSearchOpen(true);
                }}
                placeholder="Buscar cliente, venda ou cobrança..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-teal-600 transition-colors"
              />

              {searchOpen && searchQuery.trim() && (
                <div className="absolute left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-40">
                  {searchResults.length === 0 ? (
                    <div className="p-4 text-xs text-slate-500 text-center">
                      Nenhum resultado encontrado para "{searchQuery}".
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                      {searchResults.map((res, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            onNavigate(res.route, res.entityId);
                            setSearchOpen(false);
                            setSearchQuery('');
                          }}
                          className="w-full text-left px-3.5 py-2.5 hover:bg-slate-50 flex items-center justify-between gap-2 transition-colors"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-900 truncate">{res.title}</p>
                            <p className="text-[11px] text-slate-500 truncate">{res.subtitle}</p>
                          </div>
                          <span className="text-[11px] font-medium text-teal-700 shrink-0">
                            {res.type}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Notificações */}
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={() => setNotifOpen(!notifOpen)}
                className="relative p-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                aria-label="Notificações"
              >
                <Bell className="w-4 h-4" />
                {overdueCobrancas.length + pendingCobrancas.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-600 ring-2 ring-white" />
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-40">
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-900">Alertas de recebimento</span>
                    <span className="text-[11px] text-slate-500 tabular-nums">
                      {overdueCobrancas.length} atraso(s)
                    </span>
                  </div>
                  <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                    {overdueCobrancas.map((c) => {
                      const cli = state.clientes.find((cl) => cl.id === c.clienteId);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            onNavigate('inadimplencia');
                            setNotifOpen(false);
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-rose-50/40 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-rose-700">Cobrança vencida</span>
                            <span className="text-xs font-semibold text-slate-900 tabular-nums">
                              {formatBRL(c.valor)}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-0.5 truncate">
                            {cli?.nome || 'Cliente'} · Venc. {formatDateBR(c.vencimento)}
                          </p>
                        </button>
                      );
                    })}
                    {pendingCobrancas.slice(0, 3).map((c) => {
                      const cli = state.clientes.find((cl) => cl.id === c.clienteId);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            onNavigate('cobrancas');
                            setNotifOpen(false);
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-amber-700">Vencimento próximo</span>
                            <span className="text-xs font-semibold text-slate-900 tabular-nums">
                              {formatBRL(c.valor)}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-0.5 truncate">
                            {cli?.nome || 'Cliente'} · Venc. {formatDateBR(c.vencimento)}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Perfil do Usuário */}
            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2.5 pl-1.5 pr-2 py-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <img
                  src={avatarUserImg}
                  alt={state.configuracoes.usuario.nome}
                  referrerPolicy="no-referrer"
                  className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
                />
                <div className="hidden sm:block text-left">
                  <div className="text-xs font-semibold text-slate-900 leading-tight whitespace-nowrap">
                    {state.configuracoes.usuario.nome}
                  </div>
                  <div className="text-[11px] text-slate-500 leading-tight whitespace-nowrap">
                    {state.configuracoes.usuario.cargo}
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
              </button>

              {profileOpen && (
                <div className="absolute right-0 mt-2 w-60 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-40 py-1">
                  <div className="px-4 py-2.5 border-b border-slate-100">
                    <p className="text-xs font-semibold text-slate-900">{state.configuracoes.usuario.nome}</p>
                    <p className="text-[11px] text-slate-500 truncate">{state.configuracoes.usuario.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onNavigate('configuracoes');
                      setProfileOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                    <span>Perfil e empresa</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onNavigate('integracoes');
                      setProfileOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <Plug className="w-3.5 h-3.5 text-slate-400" />
                    <span>Integração Asaas (Demo)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      setConfirmResetOpen(true);
                    }}
                    className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 border-t border-slate-100 mt-1 pt-2"
                  >
                    <LogOut className="w-3.5 h-3.5 text-slate-400" />
                    <span>Restaurar dados iniciais</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Conteúdo da Página */}
        <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto">
          {children}
        </main>
      </div>

      <ConfirmModal
        open={confirmResetOpen}
        onClose={() => setConfirmResetOpen(false)}
        onConfirm={resetDemoData}
        title="Restaurar dados demonstrativos"
        description="Esta ação redefine clientes, vendas, parcelas, contratos e cobranças para o conjunto de demonstração original. Deseja continuar?"
        confirmLabel="Restaurar dados"
        danger={false}
      />
    </div>
  );
};
