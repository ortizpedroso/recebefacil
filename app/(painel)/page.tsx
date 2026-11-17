import Link from "next/link";
import { Check } from "lucide-react";
import { count, eq } from "drizzle-orm";
import { ReceivableList } from "@/components/receivable-row";
import { Card, Empty, money, Title, buttonClass } from "@/components/ui";
import { formatDateBR, todayIn } from "@/lib/dates";
import { allDone, onboardingSteps } from "@/lib/onboarding";
import { rowContext } from "@/lib/pay-link";
import { homeKpis, listReceivables } from "@/lib/receivables";
import { catalogItems, sales } from "@/lib/schema";
import { requireSession } from "@/lib/session";

const plural = (total: number, one: string, many: string) => `${total} ${total === 1 ? one : many}`;

export default async function InicioPage() {
  const session = await requireSession();
  const { db, org } = session;
  const today = todayIn(org.timezone);
  const settings = { lateFineBp: org.lateFineBp, lateInterestMonthlyBp: org.lateInterestMonthlyBp };
  const [context, kpis, late, week, [products], [salesCount]] = await Promise.all([
    rowContext(session),
    homeKpis(db, org.id, today),
    listReceivables(db, org.id, today, settings, { bucket: "atrasadas", limit: 5 }),
    listReceivables(db, org.id, today, settings, { bucket: "semana", limit: 8 }),
    db.select({ total: count() }).from(catalogItems).where(eq(catalogItems.organizationId, org.id)),
    db.select({ total: count() }).from(sales).where(eq(sales.organizationId, org.id)),
  ]);
  const steps = onboardingSteps({ tradeName: org.tradeName, pixKey: org.pixKey, products: Number(products?.total ?? 0), sales: Number(salesCount?.total ?? 0) });
  const month = kpis.monthLabel;
  const cards = [
    { href: "/receber?filtro=mes", label: `A receber em ${month}`, value: money(kpis.toReceive.cents), note: `${plural(kpis.toReceive.count, "pagamento previsto", "pagamentos previstos")}`, tone: "" },
    { href: "/receber?filtro=recebidas", label: `Recebido em ${month}`, value: money(kpis.received.cents), note: `${plural(kpis.received.count, "recebimento", "recebimentos")} no mês`, tone: "" },
    { href: "/receber?filtro=atrasadas", label: "Atrasado", value: money(kpis.late.cents), note: `${plural(kpis.late.count, "pagamento", "pagamentos")} de ${plural(kpis.late.clients, "cliente", "clientes")}`, tone: kpis.late.cents > 0 ? "text-rose-700" : "" },
  ];
  return (
    <div className="space-y-5">
      <Title hint={`${month.charAt(0).toUpperCase()}${month.slice(1)} de ${today.slice(0, 4)} · hoje é ${formatDateBR(today)}`} action={<span className="hidden md:inline-flex"><Link href="/vendas/nova" className={buttonClass}>+ Nova venda</Link></span>}>
        Olá, {org.tradeName}
      </Title>

      {allDone(steps) ? null : (
        <Card className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-bold text-slate-900">Primeiros passos</h2>
            <span className="text-sm text-slate-500">{steps.filter((step) => step.done).length} de {steps.length}</span>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {steps.map((step) => (
              <li key={step.key}>
                <Link href={step.href} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${step.done ? "border-teal-700 bg-teal-700 text-white" : "border-slate-300"}`}>{step.done ? <Check className="h-3 w-3" strokeWidth={3} /> : null}</span>
                  <span className={step.done ? "text-slate-400 line-through" : "font-medium text-slate-900"}>{step.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {cards.map((card) => (
          <Link key={card.href} href={card.href} className="flex flex-col gap-1 rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm hover:border-slate-300">
            <span className="text-sm font-medium text-slate-500">{card.label}</span>
            <strong className={`text-2xl font-bold tabular-nums sm:text-[26px] ${card.tone}`}>{card.value}</strong>
            <span className="text-[13px] text-slate-500">{card.note}</span>
          </Link>
        ))}
      </div>

      <section>
        <div className="mb-2.5 flex items-baseline justify-between gap-3">
          <h2 className="text-[17px] font-bold text-slate-900">Precisa de atenção</h2>
          {kpis.late.count > late.length ? (
            <Link href="/receber?filtro=atrasadas" className="text-sm font-semibold text-teal-700">
              Ver todos os {kpis.late.count}
            </Link>
          ) : null}
        </div>
        <ReceivableList rows={late} context={context} empty={<Empty>Ninguém está atrasado. Bom trabalho.</Empty>} />
      </section>

      <section>
        <div className="mb-2.5 flex items-baseline justify-between gap-3">
          <h2 className="text-[17px] font-bold text-slate-900">Vence nos próximos 7 dias</h2>
          <Link href="/receber?filtro=mes" className="text-sm font-semibold text-teal-700">
            Ver o mês
          </Link>
        </div>
        <ReceivableList rows={week} context={context} empty={<Empty>Nada vence nos próximos 7 dias.</Empty>} />
      </section>
    </div>
  );
}
