"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Bell,
  CircleHelp,
  FileText,
  Handshake,
  LayoutDashboard,
  Menu,
  Package,
  Receipt,
  RefreshCw,
  Settings,
  ShoppingBag,
  TriangleAlert,
  Users,
  Wallet,
  X,
} from "lucide-react";

const items = [
  { href: "/", label: "Visão geral", icon: LayoutDashboard },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/produtos", label: "Produtos e serviços", icon: Package },
  { href: "/vendas", label: "Vendas", icon: ShoppingBag },
  { href: "/contratos", label: "Contratos", icon: Handshake },
  { href: "/parcelas", label: "Parcelas", icon: Receipt },
  { href: "/recorrencias", label: "Recorrências", icon: RefreshCw },
  { href: "/cobrancas", label: "Cobranças e recebimentos", icon: Wallet },
  { href: "/inadimplencia", label: "Inadimplência", icon: TriangleAlert },
  { href: "/relatorios", label: "Relatórios", icon: FileText },
  { href: "/integracoes", label: "Integrações", icon: RefreshCw },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
  { href: "/ajuda", label: "Ajuda e suporte", icon: CircleHelp },
];

export function Shell({
  company,
  userName,
  alerts,
  children,
}: {
  company: string;
  userName: string;
  alerts: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const current = items.find((item) => item.href !== "/" && pathname.startsWith(item.href)) ?? items[0];

  const nav = (
    <nav className="flex h-full flex-col gap-1 p-3 text-sm text-white">
      <div className="mb-4 flex items-center justify-between px-2">
        <div className={collapsed ? "hidden" : ""}>
          <p className="text-base font-semibold">RecebeFácil</p>
          <p className="text-xs text-slate-300">Venda. Receba. Acompanhe.</p>
        </div>
        <button type="button" className="hidden rounded p-1 hover:bg-white/10 lg:block" onClick={() => setCollapsed((value) => !value)} aria-label="Recolher menu">
          <Menu className="h-4 w-4" />
        </button>
      </div>
      {items.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 ${active ? "bg-white/15" : "hover:bg-white/10"}`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className={collapsed ? "lg:hidden" : ""}>{item.label}</span>
            {item.href === "/inadimplencia" && alerts > 0 ? (
              <span className="ml-auto rounded-full bg-[#EF4444] px-2 text-xs">{alerts}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen lg:flex">
      <aside className={`hidden shrink-0 bg-[#102A43] lg:block ${collapsed ? "lg:w-20" : "lg:w-72"}`}>{nav}</aside>
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button className="absolute inset-0 bg-slate-900/40" aria-label="Fechar menu" onClick={() => setOpen(false)} />
          <aside className="relative h-full w-72 bg-[#102A43]">{nav}</aside>
        </div>
      ) : null}
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-[#E2E8F0] bg-white px-4 py-3">
          <button type="button" className="rounded p-2 lg:hidden" aria-label="Abrir menu" onClick={() => setOpen(true)}>
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <div className="min-w-0">
            <p className="truncate text-xs text-[#64748B]">{company} / {current.label}</p>
            <p className="truncate text-sm font-medium">{userName}</p>
          </div>
          <form action="/busca" className="ml-auto hidden md:block">
            <input name="q" placeholder="Buscar cliente" className="w-64 rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm" />
          </form>
          <Link href="/inadimplencia" className="relative rounded-lg p-2 text-[#64748B]" aria-label="Notificações">
            <Bell className="h-5 w-5" />
            {alerts > 0 ? <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[#EF4444]" /> : null}
          </Link>
        </header>
        <main className="p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
