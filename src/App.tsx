import React, { useState } from 'react';
import { RecebeFacilProvider } from './context/RecebeFacilContext';
import { MenuRoute } from './types/recebefacil';
import { AppShell } from './components/layout/AppShell';
import { ToastContainer } from './components/ui/ToastContainer';
import { VisaoGeralPage } from './pages/VisaoGeralPage';
import { ClientesPage } from './pages/ClientesPage';
import { ProdutosServicosPage } from './pages/ProdutosServicosPage';
import { VendasPage } from './pages/VendasPage';
import { ContratosPage } from './pages/ContratosPage';
import { ParcelasPage } from './pages/ParcelasPage';
import { RecorrenciasPage } from './pages/RecorrenciasPage';
import { CobrancasPage } from './pages/CobrancasPage';
import { InadimplenciaPage } from './pages/InadimplenciaPage';
import { RelatoriosPage } from './pages/RelatoriosPage';
import { IntegracoesPage } from './pages/IntegracoesPage';
import { ConfiguracoesPage } from './pages/ConfiguracoesPage';
import { AjudaSuportePage } from './pages/AjudaSuportePage';

function RecebeFacilAppContent() {
  const [activeRoute, setActiveRoute] = useState<MenuRoute>('visao-geral');
  const [selectedClienteId, setSelectedClienteId] = useState<string | null>(null);
  const [openClienteSignal, setOpenClienteSignal] = useState(0);
  const [openVendaSignal, setOpenVendaSignal] = useState(0);
  const [openCobrancaSignal, setOpenCobrancaSignal] = useState(0);

  const handleNavigate = (route: MenuRoute, entityId?: string) => {
    setActiveRoute(route);
    if (route === 'clientes') {
      setSelectedClienteId(entityId || null);
    } else {
      setSelectedClienteId(null);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleQuickAction = (action: 'novo-cliente' | 'nova-venda' | 'nova-cobranca') => {
    if (action === 'novo-cliente') {
      setSelectedClienteId(null);
      setActiveRoute('clientes');
      setOpenClienteSignal((n) => n + 1);
    } else if (action === 'nova-venda') {
      setActiveRoute('vendas');
      setOpenVendaSignal((n) => n + 1);
    } else if (action === 'nova-cobranca') {
      setActiveRoute('cobrancas');
      setOpenCobrancaSignal((n) => n + 1);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderPage = () => {
    switch (activeRoute) {
      case 'visao-geral':
        return (
          <VisaoGeralPage
            onNavigate={handleNavigate}
            onQuickAction={handleQuickAction}
          />
        );
      case 'clientes':
        return (
          <ClientesPage
            initialSelectedClienteId={selectedClienteId}
            openCreateModalSignal={openClienteSignal}
          />
        );
      case 'produtos-servicos':
        return <ProdutosServicosPage />;
      case 'vendas':
        return <VendasPage openWizardSignal={openVendaSignal} />;
      case 'contratos':
        return <ContratosPage />;
      case 'parcelas':
        return <ParcelasPage />;
      case 'recorrencias':
        return <RecorrenciasPage />;
      case 'cobrancas':
        return <CobrancasPage openCreateModalSignal={openCobrancaSignal} />;
      case 'inadimplencia':
        return <InadimplenciaPage />;
      case 'relatorios':
        return <RelatoriosPage />;
      case 'integracoes':
        return <IntegracoesPage />;
      case 'configuracoes':
        return <ConfiguracoesPage onNavigate={(r) => handleNavigate(r)} />;
      case 'ajuda':
        return <AjudaSuportePage />;
      default:
        return (
          <VisaoGeralPage
            onNavigate={handleNavigate}
            onQuickAction={handleQuickAction}
          />
        );
    }
  };

  return (
    <AppShell activeRoute={activeRoute} onNavigate={handleNavigate}>
      {renderPage()}
    </AppShell>
  );
}

export default function App() {
  return (
    <RecebeFacilProvider>
      <RecebeFacilAppContent />
      <ToastContainer />
    </RecebeFacilProvider>
  );
}
