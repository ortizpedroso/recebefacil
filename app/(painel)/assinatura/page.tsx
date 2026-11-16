import { eq } from "drizzle-orm";
import { payPlatformAction, subscribeAction } from "@/app/actions";
import { buttonClass, Card, money, Title } from "@/components/ui";
import { ensureSubscription, plans, type PlanCode } from "@/lib/billing";
import { formatDateBR, todayIn } from "@/lib/dates";
import { platformInvoices } from "@/lib/schema";
import { requireSession } from "@/lib/session";

export default async function AssinaturaPage() {
  const session = await requireSession();
  const today = todayIn(session.org.timezone);
  const subscription = await ensureSubscription(session.db, session.org.id, today);
  const invoices = await session.db.select().from(platformInvoices).where(eq(platformInvoices.organizationId, session.org.id));
  const plan = plans[subscription.planCode as PlanCode] ?? plans.essencial;
  return (
    <div className="space-y-4">
      <Title hint="A fatura é do RecebeFácil, não das cobranças dos seus clientes.">Assinatura</Title>
      <Card>
        <p className="font-medium">{plan.label}</p>
        <p className="text-sm text-[#64748B]">Situação {subscription.status}. Trial até {formatDateBR(subscription.trialEndsOn)}. Período até {formatDateBR(subscription.periodEndsOn)}. Valor {money(plan.priceCents)}.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(Object.keys(plans) as PlanCode[]).map((code) => (
            <form key={code} action={async () => { "use server"; await subscribeAction(code); }}>
              <button className={buttonClass}>Assinar {plans[code].label}</button>
            </form>
          ))}
        </div>
      </Card>
      <Card>
        <p className="mb-2 font-medium">Faturas da plataforma</p>
        {invoices.length === 0 ? <p className="text-sm text-[#64748B]">Nenhuma fatura. O trial não gera cobrança.</p> : null}
        {invoices.map((invoice) => (
          <div key={invoice.id} className="flex flex-wrap items-center gap-3 border-t border-[#E2E8F0] py-2 text-sm">
            <span>{formatDateBR(invoice.dueOn)}</span>
            <span>{money(invoice.amountCents)}</span>
            <span>{invoice.status}</span>
            {invoice.status === "aberta" ? (
              <form action={async () => { "use server"; await payPlatformAction(invoice.id); }}>
                <button className="text-teal-700">Registrar pagamento</button>
              </form>
            ) : null}
          </div>
        ))}
      </Card>
    </div>
  );
}
