import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Banknote, Camera, FileText, MessageCircle, QrCode, Receipt, ShoppingBag, Smartphone, TrendingUp, Users } from "lucide-react";
import { PlanCards } from "@/components/plan-cards";
import { buttonClass, Title } from "@/components/ui";
import { TRIAL_DAYS } from "@/lib/billing";
import { getDb } from "@/lib/db";
import { loadPlatformSettings } from "@/lib/platform-settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Planos",
  description: "Planos do RecebeFácil: venda, mande o link de pagamento e receba por Pix, boleto ou cartão. Teste grátis.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/planos" },
};

const FEATURES = [
  { icon: Camera, title: "Produtos e serviços com foto", text: "Cadastre o que você vende, com preço e foto, e escolha na hora de vender." },
  { icon: ShoppingBag, title: "Venda do seu jeito", text: "À vista, parcelado em até 240 vezes com juros e reajuste, ou por mensalidade." },
  { icon: MessageCircle, title: "Link de pagamento no WhatsApp", text: "Mande o link e o cliente vê o que comprou e como pagar." },
  { icon: QrCode, title: "Pix, boleto ou cartão", text: "No plano Integrado, o cliente paga pelo link sem você fazer nada." },
  { icon: BadgeCheck, title: "Baixa automática ou manual", text: "Automática no Integrado. No Gestão, você toca em Recebi." },
  { icon: TrendingUp, title: "Quem está atrasado", text: "Veja quem deve e cobre com um toque, direto no WhatsApp." },
  { icon: Banknote, title: "Multa e juros dentro da lei", text: "O atraso é calculado sozinho, respeitando o limite legal." },
  { icon: Receipt, title: "Recibo e contrato prontos", text: "Gere o recibo do pagamento e o contrato da venda em segundos." },
  { icon: FileText, title: "Relatórios e Excel/PDF", text: "Vendas e recebimentos do mês, com exportação para Excel e PDF." },
  { icon: Users, title: "Equipe com permissões", text: "Convide quem trabalha com você e escolha o que cada pessoa pode fazer." },
  { icon: Smartphone, title: "Funciona no celular", text: "Feito para usar no balcão, na rua ou em casa, sem instalar nada." },
];

const FAQ = [
  {
    question: "Como funciona o teste grátis?",
    answer: `Você usa tudo por ${TRIAL_DAYS} dias, sem pagar nada. Quando o teste acaba, você escolhe um plano para continuar criando vendas. Mesmo antes disso, tudo o que você já cadastrou fica guardado.`,
  },
  {
    question: "Posso trocar de plano?",
    answer: "Pode, quando quiser, na página Plano. O novo valor vale a partir da próxima mensalidade.",
  },
  {
    question: "Como recebo o dinheiro no plano Integrado?",
    answer: "Seu cliente paga por Pix, boleto ou cartão no link. O Asaas separa a parte da plataforma e manda o resto direto para a sua conta Asaas. O RecebeFácil dá a baixa sozinho.",
  },
  {
    question: "Preciso de CNPJ?",
    answer: "Para testar, não. Para contratar, pedimos o CPF ou o CNPJ de quem vai pagar a mensalidade, só para emitir a cobrança.",
  },
  {
    question: "Como cancelo?",
    answer: "Na página Plano, toque em Cancelar assinatura. Você segue usando até o fim do período que já pagou e não paga mais nada depois.",
  },
];

export default async function PlanosPage() {
  const settings = await loadPlatformSettings(await getDb());
  return (
    <div className="space-y-8">
      <Title hint={`O que o RecebeFácil faz por você. Os planos começam com ${TRIAL_DAYS} dias de teste grátis.`}>O que o RecebeFácil faz</Title>
      <section aria-labelledby="fazer">
        <h2 id="fazer" className="text-xl font-bold text-slate-900">
          O que você pode fazer
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <article key={title} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-3 font-semibold text-slate-900">{title}</h3>
              <p className="mt-1 text-sm text-slate-600">{text}</p>
            </article>
          ))}
        </div>
      </section>
      <section aria-labelledby="dois-jeitos">
        <h2 id="dois-jeitos" className="text-xl font-bold text-slate-900">
          Dois jeitos de usar
        </h2>
        <p className="mt-1 text-sm text-slate-600">Os dois começam com {TRIAL_DAYS} dias de teste grátis. Você escolhe depois.</p>
        <div className="mt-4">
          <PlanCards
            prices={settings}
            feeBp={settings.platformFeeBp}
            cta={(code) => (
              <Link href={`/assinatura?plano=${code}`} className={`${buttonClass} w-full`}>
                Contratar
              </Link>
            )}
          />
        </div>
      </section>
      <section aria-labelledby="duvidas">
        <h2 id="duvidas" className="text-xl font-bold text-slate-900">
          Perguntas frequentes
        </h2>
        <div className="mt-4 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {FAQ.map((item) => (
            <details key={item.question} className="group px-4 py-3.5">
              <summary className="cursor-pointer list-none font-semibold text-slate-900 marker:hidden">{item.question}</summary>
              <p className="mt-2 text-sm text-slate-600">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
