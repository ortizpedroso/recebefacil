import { Check } from "lucide-react";
import { PLAN_CODES, PLAN_LABEL, planPriceCents, type PlanCode, type PlanPrices } from "@/lib/billing";
import { cents, formatBRL, formatPercent } from "@/lib/money";

const TAGLINE: Record<PlanCode, string> = {
  gestao: "Você recebe do seu jeito e marca quando o cliente pagou.",
  integrado: "O cliente paga pelo link e o sistema dá a baixa sozinho.",
};

const INCLUDES: Record<PlanCode, string[]> = {
  gestao: [
    "Produtos e serviços com foto",
    "Venda à vista, parcelada em até 240 vezes ou por mensalidade",
    "Link de pagamento para mandar pelo WhatsApp",
    "Você marca Recebi quando o cliente paga",
    "Lista de quem está atrasado, com cobrança em um toque",
    "Multa e juros de atraso dentro da lei",
    "Recibo e contrato prontos",
    "Relatórios com Excel e PDF",
    "Equipe com permissões",
    "Nenhuma taxa por pagamento recebido",
  ],
  integrado: [
    "Tudo do plano Gestão",
    "O cliente paga por Pix, boleto ou cartão no próprio link",
    "Baixa automática assim que o pagamento cai",
    "O dinheiro vai direto para a sua conta Asaas",
    "Você ainda pode marcar Recebi quando receber de outro jeito",
  ],
};

export function PlanCards({ prices, feeBp, cta, current }: { prices: PlanPrices; feeBp: number; cta: (code: PlanCode) => React.ReactNode; current?: PlanCode | null }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {PLAN_CODES.map((code) => {
        const highlighted = code === "integrado";
        return (
          <section key={code} className={`flex flex-col rounded-2xl border bg-white p-5 shadow-sm ${highlighted ? "border-teal-700 ring-1 ring-teal-700" : "border-slate-200"}`}>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-bold text-slate-900">{PLAN_LABEL[code]}</h3>
              {current === code ? <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-semibold text-teal-800">Seu plano</span> : null}
            </div>
            <p className="mt-1 text-sm text-slate-600">{TAGLINE[code]}</p>
            <p className="mt-4 flex items-baseline gap-1">
              <span className="text-3xl font-bold tabular-nums text-slate-900">{formatBRL(cents(planPriceCents(prices, code)))}</span>
              <span className="text-sm text-slate-500">por mês</span>
            </p>
            <p className="mt-1 min-h-5 text-sm font-medium text-teal-800">{code === "integrado" ? `+ ${formatPercent(feeBp)}% por pagamento recebido pelo sistema` : "Sem taxa por pagamento"}</p>
            <ul className="mt-4 flex-1 space-y-2">
              {INCLUDES[code].map((line) => (
                <li key={line} className="flex items-start gap-2 text-sm text-slate-700">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" aria-hidden="true" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5">{cta(code)}</div>
          </section>
        );
      })}
    </div>
  );
}
