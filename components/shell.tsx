"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  CalendarClock,
  ChevronDown,
  CreditCard,
  FileText,
  HelpCircle,
  MessageSquare,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Plug,
  Receipt,
  Repeat,
  RotateCcw,
  Search,
  Settings,
  ShoppingCart,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { resetDemoAction } from "@/app/actions";

const mainNav = [
  { href: "/", label: "Visão geral", icon: LayoutDashboard },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/produtos", label: "Produtos e serviços", icon: Package },
  { href: "/vendas", label: "Vendas", icon: ShoppingCart },
  { href: "/contratos", label: "Contratos", icon: FileText },
  { href: "/parcelas", label: "Parcelas", icon: CalendarClock },
  { href: "/recorrencias", label: "Recorrências", icon: Repeat },
  { href: "/cobrancas", label: "Cobranças e recebimentos", icon: Receipt },
  { href: "/inadimplencia", label: "Inadimplência", icon: AlertTriangle },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { href: "/fiscal", label: "Notas fiscais", icon: FileText },
  { href: "/mensagens", label: "Mensagens", icon: MessageSquare },
];

const footerNav = [
  { href: "/integracoes", label: "Integrações", icon: Plug },
  { href: "/assinatura", label: "Assinatura", icon: CreditCard },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
  { href: "/ajuda", label: "Ajuda e suporte", icon: HelpCircle },
];

export type ShellSearch = { kind: string; title: string; subtitle: string; href: string; haystack: string };
export type ShellAlert = { id: string; tone: "late" | "soon" | "erro"; label: string; amount: string; detail: string; href: string };

export function Shell({
  company,
  profileName,
  profileRole,
  profileEmail,
  showAvatar,
  lateCount,
  search,
  alerts,
  children,
}: {
  company: string;
  profileName: string;
  profileRole: string;
  profileEmail: string;
  showAvatar: boolean;
  lateCount: number;
  search: ShellSearch[];
  alerts: ShellAlert[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const current = [...mainNav, ...footerNav].find((item) => (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href))) ?? mainNav[0];
  const results = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return [];
    return search.filter((item) => item.haystack.includes(text)).slice(0, 8);
  }, [query, search]);

  function active(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  function itemClass(href: string) {
    return active(href)
      ? "bg-teal-50 text-teal-800 font-semibold"
      : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 font-medium";
  }

  const nav = (
    <div className="flex h-full flex-col border-r border-slate-200 bg-white">
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 px-5">
        <Link href="/" onClick={() => setOpen(false)} className="flex items-center gap-2.5">
          <Logo />
          <span>
            <span className="block text-base font-bold tracking-tight text-slate-900">RecebeFácil</span>
            <span className="block text-[11px] font-medium text-slate-500">Venda. Receba. Acompanhe.</span>
          </span>
        </Link>
        <button type="button" className="rounded-lg p-1.5 text-slate-400 lg:hidden" aria-label="Fechar menu" onClick={() => setOpen(false)}>
          <X className="h-5 w-5" />
        </button>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Menu principal">
        {mainNav.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm ${itemClass(item.href)}`}>
              <span className="flex min-w-0 items-center gap-2.5">
                <Icon className={`h-4 w-4 shrink-0 ${active(item.href) ? "text-teal-700" : "text-slate-400"}`} />
                <span className="truncate">{item.label}</span>
              </span>
              {item.href === "/inadimplencia" && lateCount > 0 ? (
                <span className="shrink-0 rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[11px] font-semibold text-rose-700">{lateCount}</span>
              ) : null}
            </Link>
          );
        })}
      </nav>
      <div className="shrink-0 space-y-1 border-t border-slate-200 bg-slate-50/50 px-3 py-3">
        {footerNav.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm ${itemClass(item.href)}`}>
              <Icon className={`h-4 w-4 shrink-0 ${active(item.href) ? "text-teal-700" : "text-slate-400"}`} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
        <div className="flex items-center justify-between px-3 pt-2 text-[11px] text-slate-400">
          <span>Ambiente demonstrativo</span>
          <button type="button" className="inline-flex items-center gap-1 font-medium text-slate-500 hover:text-teal-700" onClick={() => setConfirmReset(true)}>
            <RotateCcw className="h-3 w-3" />
            Resetar
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <aside className="sticky top-0 hidden h-screen w-[260px] shrink-0 lg:block">{nav}</aside>
      {open ? (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <button className="absolute inset-0 bg-slate-900/40" aria-label="Fechar menu" onClick={() => setOpen(false)} />
          <div className="relative z-10 h-full w-[270px] max-w-[82vw]">{nav}</div>
        </div>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" aria-label="Abrir menu" onClick={() => setOpen(true)}>
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="hidden truncate sm:inline">{company}</span>
                <span className="hidden sm:inline" aria-hidden="true">/</span>
                <span className="truncate font-semibold text-slate-900">{current.label}</span>
              </div>
              <p className="hidden text-[11px] text-slate-400 sm:block">Protótipo navegável · Dados financeiros demonstrativos</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="relative hidden w-64 md:block lg:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
                placeholder="Buscar cliente, venda ou cobrança..."
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-9 pr-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-teal-600 focus:bg-white focus:outline-none"
              />
              {searchOpen && query.trim() ? (
                <div className="absolute left-0 right-0 z-40 mt-1.5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                  {results.length === 0 ? (
                    <p className="p-4 text-center text-xs text-slate-500">Nenhum resultado encontrado para “{query}”.</p>
                  ) : (
                    results.map((item) => (
                      <Link key={`${item.kind}-${item.href}-${item.title}`} href={item.href} onClick={() => { setSearchOpen(false); setQuery(""); }} className="flex items-center justify-between gap-2 px-3.5 py-2.5 hover:bg-slate-50">
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-semibold text-slate-900">{item.title}</span>
                          <span className="block truncate text-[11px] text-slate-500">{item.subtitle}</span>
                        </span>
                        <span className="shrink-0 text-[11px] font-medium text-teal-700">{item.kind}</span>
                      </Link>
                    ))
                  )}
                </div>
              ) : null}
            </div>
            <div className="relative">
              <button type="button" className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100" aria-label="Notificações" onClick={() => setNotifOpen((value) => !value)}>
                <Bell className="h-4 w-4" />
                {alerts.length > 0 ? <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-600 ring-2 ring-white" /> : null}
              </button>
              {notifOpen ? (
                <div className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                    <span className="text-xs font-semibold text-slate-900">Alertas de recebimento</span>
                    <span className="text-[11px] text-slate-500">{lateCount} atraso(s)</span>
                  </div>
                  <div className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
                    {alerts.map((alert) => (
                      <Link key={alert.id} href={alert.href} onClick={() => setNotifOpen(false)} className={`block px-4 py-3 ${alert.tone === "soon" ? "hover:bg-slate-50" : "hover:bg-rose-50/40"}`}>
                        <span className="flex items-center justify-between gap-2">
                          <span className={`text-xs font-semibold ${alert.tone === "soon" ? "text-amber-700" : "text-rose-700"}`}>{alert.label}</span>
                          <span className="text-xs font-semibold text-slate-900">{alert.amount}</span>
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-slate-600">{alert.detail}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="relative">
              <button type="button" className="flex items-center gap-2.5 rounded-lg py-1 pl-1.5 pr-2 hover:bg-slate-100" onClick={() => setProfileOpen((value) => !value)}>
                <Avatar name={profileName} showPhoto={showAvatar} />
                <span className="hidden text-left sm:block">
                  <span className="block text-xs font-semibold leading-tight text-slate-900">{profileName}</span>
                  <span className="block text-[11px] leading-tight text-slate-500">{profileRole}</span>
                </span>
                <ChevronDown className="hidden h-3.5 w-3.5 text-slate-400 sm:block" />
              </button>
              {profileOpen ? (
                <div className="absolute right-0 z-40 mt-2 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                  <div className="border-b border-slate-100 px-4 py-2.5">
                    <p className="text-xs font-semibold text-slate-900">{profileName}</p>
                    <p className="truncate text-[11px] text-slate-500">{profileEmail}</p>
                  </div>
                  <Link href="/configuracoes" onClick={() => setProfileOpen(false)} className="flex items-center gap-2 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50">
                    <UserCheck className="h-3.5 w-3.5 text-slate-400" /> Perfil e empresa
                  </Link>
                  <Link href="/integracoes" onClick={() => setProfileOpen(false)} className="flex items-center gap-2 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50">
                    <Plug className="h-3.5 w-3.5 text-slate-400" /> Integração Asaas (Demo)
                  </Link>
                  <button type="button" className="mt-1 flex w-full items-center gap-2 border-t border-slate-100 px-4 py-2 pt-2 text-left text-xs text-slate-700 hover:bg-slate-50" onClick={() => { setProfileOpen(false); setConfirmReset(true); }}>
                    <LogOut className="h-3.5 w-3.5 text-slate-400" /> Restaurar dados iniciais
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1440px] flex-1 p-4 sm:p-6">{children}</main>
      </div>
      {confirmReset ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button className="absolute inset-0 bg-slate-900/40" aria-label="Fechar" onClick={() => setConfirmReset(false)} />
          <div className="relative w-full max-w-md rounded-xl bg-white p-5 shadow-lg">
            <h2 className="text-sm font-bold text-slate-900">Restaurar dados demonstrativos</h2>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">Esta ação redefine clientes, vendas, parcelas, contratos e cobranças para o conjunto de demonstração original.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium" onClick={() => setConfirmReset(false)}>Cancelar</button>
              <button
                type="button"
                className="rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white"
                onClick={async () => {
                  await resetDemoAction();
                  setConfirmReset(false);
                  router.refresh();
                }}
              >
                Restaurar dados
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Logo() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true" className="shrink-0">
      <rect width="32" height="32" rx="8" fill="#0F766E" />
      <path d="M9 17.5L13.5 22L23 11.5" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 11.5H16" stroke="#99F6E4" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function Avatar({ name, showPhoto }: { name: string; showPhoto: boolean }) {
  if (showPhoto) {
    return <img src="/camila.jpg" alt={name} className="h-8 w-8 shrink-0 rounded-full border border-slate-200 object-cover" />;
  }
  const initials = name.split(" ").slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-[11px] font-semibold text-slate-700">{initials}</span>;
}
