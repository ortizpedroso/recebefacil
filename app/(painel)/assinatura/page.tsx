import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { cancelPlanAction } from "@/app/actions";
import { ConfirmAction } from "@/components/confirm-action";
import { PlanCards } from "@/components/plan-cards";
import { PlanCheckout, type CheckoutMode } from "@/components/plan-checkout";
import { buttonClass, Card, dangerButtonClass, money, secondaryButtonClass, Title } from "@/components/ui";
import { can } from "@/lib/access";
import { isAsaasUrl } from "@/lib/asaas";
import { isPlan, loadAccess, PLAN_LABEL, planPriceCents, type Access, type PlanCode, type SubscriptionRow } from "@/lib/billing";
import { formatDateBR } from "@/lib/dates";
import { documentKind } from "@/lib/documents";
import { logWarning } from "@/lib/log";
import { formatPercent } from "@/lib/money";
import { loadPlatformSettings, platformReady } from "@/lib/platform-settings";
import { platformInvoices, type InvoiceStatus } from "@/lib/schema";
import { requireSession } from "@/lib/session";
import { syncSubscription } from "@/lib/subscription";

export const dynamic = "force-dynamic";

const INVOICE_LABEL: Record<InvoiceStatus, string> = { aberta: "Em aberto", vencida: "Vencida", paga: "Paga", estornada: "Estornada", cancelada: "Cancelada" };
const INVOICE_TONE: Record<InvoiceStatus, string> = {
  aberta: "bg-amber-50 text-amber-700",
  vencida: "bg-rose-50 text-rose-700",
  paga: "bg-emerald-50 text-emerald-700",
  estornada: "bg-slate-100 text-slate-600",
  cancelada: "bg-slate-100 text-slate-600",
};

function daysText(days: number) {
  if (days === 0) return "termina hoje";
  return days === 1 ? "falta 1 dia" : `faltam ${days} dias`;
}

function situationOf(subscription: SubscriptionRow, access: Access): { title: string; text: string } {
  const label = PLAN_LABEL[subscription.planCode];
  const until = formatDateBR(subscription.periodEndsOn > subscription.trialEndsOn ? subscription.periodEndsOn : subscription.trialEndsOn);
  switch (access.state) {
    case "teste":
      return { title: "Teste grátis", text: `${daysText(access.daysLeft ?? 0).replace(/^./, (letter) => letter.toUpperCase())} (até ${formatDateBR(subscription.trialEndsOn)}). Escolha um plano para continuar criando vendas depois disso.` };
    case "expirada":
      return { title: "Teste grátis encerrado", text: "Seus dados estão guardados. Você ainda vê tudo e dá baixa nos pagamentos, mas para criar novas vendas escolha um plano." };
    case "ativa":
      return { title: `Plano ${label} ativo`, text: `Próximo vencimento em ${formatDateBR(subscription.periodEndsOn)}.` };
    case "aguardando":
      return { title: `Plano ${label}: falta pagar a primeira mensalidade`, text: "Assim que o pagamento for confirmado, o plano fica ativo." };
    case "inadimplente":
      return { title: `Plano ${label}: mensalidade em atraso`, text: access.canSell ? `Pague até ${until} para continuar criando vendas.` : "Enquanto não pagar, novas vendas e cobranças ficam pausadas. Você continua vendo tudo e dando baixa." };
    case "cancelada":
      return { title: "Plano cancelado", text: access.canSell ? `Você pode usar até ${until}. Depois disso, para criar novas vendas é preciso contratar de novo.` : "Para criar novas vendas, contrate um plano de novo." };
  }
}

export default async function AssinaturaPage({ searchParams }: { searchParams: Promise<{ plano?: string }> }) {
  const session = await requireSession();
  const { db, org } = session;
  const { plano } = await searchParams;
  const settings = await loadPlatformSettings(db);
  let { subscription, access } = await loadAccess(db, org);
  if (subscription && (subscription.status === "aguardando_pagamento" || subscription.status === "inadimplente") && subscription.asaasSubscriptionId) {
    try {
      if (await syncSubscription(db, org.id)) ({ subscription, access } = await loadAccess(db, org));
    } catch (error) {
      logWarning("assinatura.conferir", error);
    }
  }
  const invoices = subscription ? await db.select().from(platformInvoices).where(eq(platformInvoices.subscriptionId, subscription.id)).orderBy(desc(platformInvoices.dueOn)).limit(24) : [];
  const payable = invoices.find((invoice) => (invoice.status === "vencida" || invoice.status === "aberta") && invoice.invoiceUrl && isAsaasUrl(invoice.invoiceUrl));
  const live = Boolean(subscription?.asaasSubscriptionId) && subscription?.status !== "cancelada" && subscription?.status !== "teste";
  const paying = subscription?.status === "aguardando_pagamento" || subscription?.status === "inadimplente";
  const chosen: PlanCode | null = plano && isPlan(plano) ? plano : null;
  const mayManage = can(session.role, "assinatura.gerir");
  const ready = platformReady(settings);

  const modeFor = (code: PlanCode): CheckoutMode => {
    if (!live) return "new";
    return subscription?.planCode === code ? "resume" : "change";
  };

  return (
    <div className="space-y-4">
      <Title hint="O plano e a mensalidade do RecebeFácil. Não tem relação com as cobranças dos seus clientes.">Plano</Title>

      {subscription ? (
        <Card className="space-y-3">
          <div>
            <p className="font-semibold text-slate-900">{situationOf(subscription, access).title}</p>
            <p className="mt-0.5 text-sm text-slate-600">{situationOf(subscription, access).text}</p>
          </div>
          {payable && paying ? (
            <div>
              <a href={payable.invoiceUrl ?? "#"} className={buttonClass}>
                Pagar a mensalidade de {money(payable.amountCents)}
              </a>
            </div>
          ) : null}
        </Card>
      ) : (
        <Card>
          <p className="font-semibold text-slate-900">Demonstração</p>
          <p className="mt-0.5 text-sm text-slate-600">A demonstração não tem plano. Entre com a sua conta para testar grátis e contratar.</p>
        </Card>
      )}

      <PlanCards
        prices={settings}
        feeBp={settings.platformFeeBp}
        current={live ? subscription?.planCode : null}
        cta={(code) => {
          if (!subscription) return null;
          if (live && subscription.planCode === code && !paying) return <span className="block rounded-lg bg-slate-100 px-4 py-2 text-center text-sm font-semibold text-slate-500">Seu plano atual</span>;
          const label = live ? (subscription.planCode === code ? "Continuar para o pagamento" : "Trocar para este plano") : "Contratar";
          return (
            <Link href={`/assinatura?plano=${code}#confirmar`} className={`${chosen === code ? buttonClass : secondaryButtonClass} w-full`}>
              {label}
            </Link>
          );
        }}
      />

      {subscription && chosen ? (
        <Card className="scroll-mt-20 space-y-3">
          <div id="confirmar">
            <h2 className="font-bold text-slate-900">Plano {PLAN_LABEL[chosen]}</h2>
            <p className="text-sm text-slate-600">
              {money(planPriceCents(settings, chosen))} por mês{chosen === "integrado" ? `, mais ${formatPercent(settings.platformFeeBp)}% por pagamento recebido pelo sistema` : ""}.
            </p>
          </div>
          {!mayManage ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Só quem gerencia a assinatura pode contratar. Peça para o administrador da empresa.</p>
          ) : !ready ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Pagamento da assinatura ainda indisponível. Fale com o suporte.</p>
          ) : live && subscription.planCode === chosen && !paying ? (
            <p className="text-sm text-slate-600">Você já está neste plano.</p>
          ) : (
            <PlanCheckout key={chosen} plan={chosen} mode={modeFor(chosen)} needsDocument={!documentKind(org.document)} />
          )}
        </Card>
      ) : null}

      {live && mayManage ? (
        <Card className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">Quer parar de pagar? Você continua usando até o fim do período que já pagou.</p>
          <ConfirmAction
            label="Cancelar assinatura"
            confirmLabel="Cancelar assinatura"
            message={`Você segue usando até ${formatDateBR(subscription?.periodEndsOn ?? "")}. Depois disso não é cobrado mais nada, e para criar novas vendas será preciso contratar de novo.`}
            action={cancelPlanAction}
            className={dangerButtonClass}
            danger
          />
        </Card>
      ) : null}

      {subscription ? (
        <Card>
          <p className="mb-2 font-semibold text-slate-900">Mensalidades</p>
          {invoices.length === 0 ? <p className="text-sm text-slate-500">Nenhuma mensalidade ainda. O teste grátis não gera cobrança.</p> : null}
          <ul className="divide-y divide-slate-100">
            {invoices.map((invoice) => (
              <li key={invoice.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <span className="flex flex-wrap items-center gap-3">
                  <span className="tabular-nums text-slate-700">{formatDateBR(invoice.dueOn)}</span>
                  <span className="font-semibold tabular-nums text-slate-900">{money(invoice.amountCents)}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${INVOICE_TONE[invoice.status]}`}>{INVOICE_LABEL[invoice.status]}</span>
                </span>
                {invoice.invoiceUrl && isAsaasUrl(invoice.invoiceUrl) ? (
                  <a href={invoice.invoiceUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-teal-700 hover:underline">
                    Ver fatura
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <p className="text-sm text-slate-500">
        <Link href="/planos" className="font-semibold text-teal-700 hover:underline">
          Veja tudo o que o RecebeFácil faz e as perguntas frequentes
        </Link>
      </p>
    </div>
  );
}
