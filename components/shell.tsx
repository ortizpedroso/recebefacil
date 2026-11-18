"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AlertTriangle, BadgeCheck, BarChart3, Bell, ChevronDown, Home, Package, Plus, RotateCcw, Search, Settings, ShoppingCart, UserCheck, Users, Wallet, X } from "lucide-react";
import { resetDemoAction } from "@/app/actions";
import { normalize } from "@/lib/text";
import { Modal } from "./dialog";
import { Toaster } from "./toast";
import { buttonClass, secondaryButtonClass } from "./ui";

const mainNav = [
  { href: "/", label: "Início", icon: Home },
  { href: "/receber", label: "A receber", icon: Wallet },
  { href: "/vendas", label: "Vendas", icon: ShoppingCart },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/produtos", label: "Produtos e serviços", icon: Package },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { href: "/assinatura", label: "Plano", icon: BadgeCheck },
];

// No computador, Configurações abre direto nas abas. No celular, a barra de baixo leva a /mais, que também guarda Clientes, Produtos e Plano.
const moreNav = { href: "/configuracoes", label: "Configurações", icon: Settings };

// Páginas que moram dentro de "Configurações" acendem esse item do menu.
const MORE_PAGES = ["/mais", "/recebimentos", "/plataforma", "/configuracoes", "/equipe", "/ajuda", "/termos", "/privacidade"];

const ROUTE_LABELS: [string, string][] = [
  ["/vendas/nova", "Nova venda"],
  ["/recibo", "Recibo"],
  ["/contratos", "Contrato"],
  ["/configuracoes", "Minha empresa"],
  ["/assinatura", "Plano"],
  ["/receber", "A receber"],
  ["/vendas", "Vendas"],
  ["/clientes", "Clientes"],
  ["/produtos", "Produtos e serviços"],
  ["/relatorios", "Relatórios"],
  ["/recebimentos", "Recebimentos"],
  ["/equipe", "Equipe"],
  ["/ajuda", "Ajuda"],
  ["/mais", "Configurações"],
  ["/termos", "Termos de uso"],
  ["/privacidade", "Privacidade"],
  ["/busca", "Busca"],
  ["/fiscal", "Notas fiscais"],
  ["/mensagens", "Mensagens"],
  ["/plataforma", "Plataforma"],
];

export type ShellSearch = { kind: string; title: string; subtitle: string; href: string; haystack: string };
// Quando o plano não deixa criar venda, o botão Nova venda leva ao plano e o aviso fica no topo.
export type ShellPlan = { banner: string | null; blocked: boolean };
export type ShellAlert = { id: string; tone: "late" | "soon"; label: string; amount: string; detail: string; href: string };

export function Shell({
  company,
  profileName,
  profileRole,
  profileEmail,
  showAvatar,
  publicDemo,
  lateCount,
  search,
  alerts,
  plan,
  children,
}: {
  company: string;
  profileName: string;
  profileRole: string;
  profileEmail: string;
  showAvatar: boolean;
  publicDemo: boolean;
  lateCount: number;
  search: ShellSearch[];
  alerts: ShellAlert[];
  plan: ShellPlan;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const current = ROUTE_LABELS.find(([href]) => pathname === href || pathname.startsWith(`${href}/`))?.[1] ?? "Início";
  const results = useMemo(() => {
    const text = normalize(query);
    if (!text) return [];
    return search.filter((item) => item.haystack.includes(text)).slice(0, 8);
  }, [query, search]);

  function active(href: string) {
    if (href === "/") return pathname === "/";
    if (href === "/mais" || href === moreNav.href) return MORE_PAGES.some((page) => pathname === page || pathname.startsWith(`${page}/`));
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const newSaleHref = plan.blocked ? "/assinatura" : "/vendas/nova";
  const showBanner = Boolean(plan.banner) && !pathname.startsWith("/assinatura");

  const itemClass = (href: string) =>
    active(href) ? "bg-teal-50 text-teal-800 font-semibold" : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 font-medium";

  const searchResults = (
    <div className="absolute left-0 right-0 z-40 mt-1.5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
      {results.length === 0 ? (
        <p className="p-4 text-center text-sm text-slate-500">Nada encontrado para “{query}”.</p>
      ) : (
        results.map((item) => (
          <Link
            key={`${item.kind}-${item.href}`}
            href={item.href}
            onClick={() => {
              setSearchOpen(false);
              setMobileSearch(false);
              setQuery("");
            }}
            className="flex items-center justify-between gap-2 px-3.5 py-2.5 hover:bg-slate-50"
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-slate-900">{item.title}</span>
              <span className="block truncate text-xs text-slate-500">{item.subtitle}</span>
            </span>
            <span className="shrink-0 text-xs font-medium text-teal-700">{item.kind}</span>
          </Link>
        ))
      )}
    </div>
  );

  const searchInput = (autoFocus: boolean) => (
    <div className="relative w-full">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        autoFocus={autoFocus}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setSearchOpen(true);
        }}
        onFocus={() => setSearchOpen(true)}
        placeholder="Buscar cliente ou venda"
        aria-label="Buscar cliente ou venda"
        className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-teal-600 focus:bg-white focus:outline-none"
      />
      {searchOpen && query.trim() ? searchResults : null}
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-50 text-[#0F172B]">
      <aside className="sticky top-0 hidden h-screen w-[232px] shrink-0 border-r border-slate-200 bg-white md:flex md:flex-col print:hidden">
        <div className="flex h-16 shrink-0 items-center px-5">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo />
            <span className="text-base font-bold tracking-tight text-slate-900">RecebeFácil</span>
          </Link>
        </div>
        <div className="px-3">
          <Link href={newSaleHref} className={`${buttonClass} w-full`}>
            <Plus className="h-4 w-4" />
            Nova venda
          </Link>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Menu principal">
          {mainNav.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} aria-current={active(item.href) ? "page" : undefined} className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm ${itemClass(item.href)}`}>
                <span className="flex min-w-0 items-center gap-2.5">
                  <Icon className={`h-[18px] w-[18px] shrink-0 ${active(item.href) ? "text-teal-700" : "text-slate-400"}`} />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.href === "/receber" && lateCount > 0 ? <span className="shrink-0 rounded-full bg-rose-700 px-2 py-0.5 text-xs font-semibold text-white">{lateCount}</span> : null}
              </Link>
            );
          })}
        </nav>
        <div className="shrink-0 border-t border-slate-200 px-3 py-3">
          <Link href={moreNav.href} aria-current={active(moreNav.href) ? "page" : undefined} className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm ${itemClass(moreNav.href)}`}>
            <moreNav.icon className={`h-[18px] w-[18px] shrink-0 ${active(moreNav.href) ? "text-teal-700" : "text-slate-400"}`} />
            {moreNav.label}
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 sm:h-16 sm:px-6 print:hidden">
          {mobileSearch ? (
            <div className="flex w-full items-center gap-2">
              {searchInput(true)}
              <button
                type="button"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Fechar busca"
                onClick={() => {
                  setMobileSearch(false);
                  setQuery("");
                }}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <>
              <div className="flex min-w-0 items-center gap-3">
                <Link href="/" className="md:hidden" aria-label="Início">
                  <Logo />
                </Link>
                <div className="flex min-w-0 items-center gap-2 text-sm text-slate-500">
                  <span className="hidden truncate sm:inline">{company}</span>
                  <span className="hidden sm:inline" aria-hidden="true">/</span>
                  <span className="truncate font-semibold text-slate-900">{current}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-3">
                <div className="hidden w-64 md:block lg:w-80">{searchInput(false)}</div>
                <button type="button" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden" aria-label="Buscar" onClick={() => setMobileSearch(true)}>
                  <Search className="h-5 w-5" />
                </button>
                <div className="relative">
                  <button type="button" className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100" aria-label="Avisos de pagamento" onClick={() => setNotifOpen((value) => !value)}>
                    <Bell className="h-5 w-5" />
                    {alerts.length > 0 ? <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-600 ring-2 ring-white" /> : null}
                  </button>
                  {notifOpen ? (
                    <div className="absolute right-0 z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                        <span className="text-sm font-semibold text-slate-900">Avisos de pagamento</span>
                        <span className="text-xs text-slate-500">{lateCount} atrasado{lateCount === 1 ? "" : "s"}</span>
                      </div>
                      <div className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
                        {alerts.length === 0 ? <p className="p-4 text-sm text-slate-500">Nenhum pagamento atrasado ou perto de vencer.</p> : null}
                        {alerts.map((alert) => (
                          <Link key={alert.id} href={alert.href} onClick={() => setNotifOpen(false)} className="block px-4 py-3 hover:bg-slate-50">
                            <span className="flex items-center justify-between gap-2">
                              <span className={`text-xs font-semibold ${alert.tone === "soon" ? "text-amber-700" : "text-rose-700"}`}>{alert.label}</span>
                              <span className="text-xs font-semibold text-slate-900">{alert.amount}</span>
                            </span>
                            <span className="mt-0.5 block truncate text-sm text-slate-600">{alert.detail}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
                <div className="relative">
                  <button type="button" className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-1.5 hover:bg-slate-100 sm:pr-2" aria-label="Conta" onClick={() => setProfileOpen((value) => !value)}>
                    <Avatar name={profileName} showPhoto={showAvatar} />
                    <span className="hidden text-left sm:block">
                      <span className="block text-xs font-semibold leading-tight text-slate-900">{profileName}</span>
                      <span className="block text-[11px] leading-tight text-slate-500">{profileRole}</span>
                    </span>
                    <ChevronDown className="hidden h-3.5 w-3.5 text-slate-400 sm:block" />
                  </button>
                  {profileOpen ? (
                    <div className="absolute right-0 z-40 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                      <div className="border-b border-slate-100 px-4 py-2.5">
                        <p className="text-sm font-semibold text-slate-900">{profileName}</p>
                        {profileEmail ? <p className="truncate text-xs text-slate-500">{profileEmail}</p> : null}
                      </div>
                      <Link href="/configuracoes" onClick={() => setProfileOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
                        <UserCheck className="h-4 w-4 text-slate-400" /> Minha empresa
                      </Link>
                      {publicDemo ? (
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 border-t border-slate-100 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                          onClick={() => {
                            setProfileOpen(false);
                            setConfirmReset(true);
                          }}
                        >
                          <RotateCcw className="h-4 w-4 text-slate-400" /> Restaurar dados de exemplo
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </>
          )}
        </header>
        {showBanner ? (
          <div role="status" className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-4 py-2.5 text-sm sm:px-6 print:hidden ${plan.blocked ? "border-rose-200 bg-rose-50 text-rose-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
            <span className="flex min-w-0 items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{plan.banner}</span>
            </span>
            <Link href="/assinatura" className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-[13px] font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50">
              Ver planos
            </Link>
          </div>
        ) : null}
        <main className="mx-auto w-full max-w-[1120px] flex-1 px-4 pb-28 pt-5 sm:px-6 sm:pt-6 md:pb-10 print:max-w-none print:p-0">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-slate-200 bg-white px-1 pb-[max(0.375rem,env(safe-area-inset-bottom))] pt-1.5 md:hidden print:hidden" aria-label="Menu">
        <BottomLink href="/" label="Início" icon={Home} on={active("/")} />
        <BottomLink href="/receber" label="A receber" icon={Wallet} on={active("/receber")} badge={lateCount} />
        <Link href={newSaleHref} className="relative flex flex-col items-center gap-0.5 text-[11px] font-semibold text-teal-800">
          <span className="-mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-teal-700 text-white shadow-lg">
            <Plus className="h-6 w-6" />
          </span>
          Vender
        </Link>
        <BottomLink href="/vendas" label="Vendas" icon={ShoppingCart} on={active("/vendas") && pathname !== "/vendas/nova"} />
        <BottomLink href="/mais" label="Configurações" icon={Settings} on={active("/mais")} />
      </nav>

      <Modal open={confirmReset} onOpenChange={setConfirmReset} title="Restaurar dados de exemplo" description="Clientes, vendas e cobranças voltam ao conjunto original da demonstração.">
        <div className="flex justify-end gap-2">
          <button type="button" className={secondaryButtonClass} onClick={() => setConfirmReset(false)}>
            Cancelar
          </button>
          <button
            type="button"
            className={buttonClass}
            disabled={resetting}
            onClick={async () => {
              setResetting(true);
              await resetDemoAction();
              setResetting(false);
              setConfirmReset(false);
              router.refresh();
            }}
          >
            {resetting ? "Restaurando..." : "Restaurar dados"}
          </button>
        </div>
      </Modal>
      <Toaster />
    </div>
  );
}

function BottomLink({ href, label, icon: Icon, on, badge = 0 }: { href: string; label: string; icon: typeof Home; on: boolean; badge?: number }) {
  return (
    <Link href={href} aria-current={on ? "page" : undefined} className={`relative flex flex-col items-center gap-0.5 py-1 text-[11px] font-semibold ${on ? "text-teal-700" : "text-slate-500"}`}>
      <Icon className="h-[22px] w-[22px]" />
      {label}
      {badge > 0 ? <span className="absolute right-[22%] top-0 rounded-full bg-rose-700 px-1.5 text-[10px] font-bold leading-4 text-white">{badge}</span> : null}
    </Link>
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
    // eslint-disable-next-line @next/next/no-img-element
    return <img src="/camila.jpg" alt="" className="h-8 w-8 shrink-0 rounded-full border border-slate-200 object-cover" />;
  }
  const initials = name.split(" ").slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-[11px] font-semibold text-slate-700">{initials}</span>;
}
