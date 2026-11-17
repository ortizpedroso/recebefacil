import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Title } from "@/components/ui";
import { isPlatformOwner } from "@/lib/platform-owner";
import { requireSession } from "@/lib/session";

const LINKS = [
  { href: "/clientes", title: "Clientes", hint: "Quem compra de você", phoneOnly: true },
  { href: "/produtos", title: "Produtos", hint: "O que você vende, com foto e preço", phoneOnly: true },
  { href: "/relatorios", title: "Relatórios", hint: "Vendas e recebimentos, gráfico, exportar para Excel e PDF" },
  { href: "/recebimentos", title: "Recebimentos", hint: "Como você recebe: Gestão ou Integrado com Asaas, chave Pix e instruções" },
  { href: "/configuracoes", title: "Minha empresa", hint: "Nome, CNPJ, fuso horário, multa e juros por atraso" },
  { href: "/equipe", title: "Equipe", hint: "Convidar pessoas e definir o que cada uma pode fazer" },
  { href: "/assinatura", title: "Plano", hint: "Seu plano do RecebeFácil" },
  { href: "/ajuda", title: "Ajuda", hint: "Perguntas frequentes e fale com o suporte" },
];

const PLATFORM_LINK = { href: "/plataforma", title: "Plataforma", hint: "Credenciais do Asaas, taxa e planos (só o dono vê)" };

export default async function MaisPage() {
  const owner = isPlatformOwner(await requireSession());
  const links: ((typeof LINKS)[number] | typeof PLATFORM_LINK)[] = owner ? [...LINKS, PLATFORM_LINK] : LINKS;
  return (
    <div>
      <Title hint="O que você usa de vez em quando.">Mais</Title>
      <nav className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-sm" aria-label="Mais opções">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className={`items-center justify-between gap-3 px-4 py-3.5 hover:bg-slate-50 ${"phoneOnly" in link ? "flex md:hidden" : "flex"}`}>
            <span className="min-w-0">
              <span className="block font-semibold text-slate-900">{link.title}</span>
              <span className="block text-[13px] text-slate-500">{link.hint}</span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
          </Link>
        ))}
      </nav>
    </div>
  );
}
