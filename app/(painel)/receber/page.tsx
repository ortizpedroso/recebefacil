import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { ChargeMenu } from "@/components/charge-menu";
import { ReceivableList } from "@/components/receivable-row";
import { buttonClass, Empty, money, Title } from "@/components/ui";
import { can } from "@/lib/access";
import { todayIn } from "@/lib/dates";
import { rowContext } from "@/lib/pay-link";
import { BUCKET_LABELS, BUCKETS, bucketCounts, bucketTotal, isBucket, listReceivables, type Bucket } from "@/lib/receivables";
import { clients } from "@/lib/schema";
import { requireSession } from "@/lib/session";

const PAGE = 20;

const EMPTY: Record<Bucket, string> = {
  atrasadas: "Ninguém está atrasado. Bom trabalho.",
  mes: "Nada para receber no resto deste mês.",
  proximas: "Nenhum pagamento previsto para os próximos meses.",
  recebidas: "Os pagamentos que você marcar como recebidos aparecem aqui.",
};

export default async function ReceberPage({ searchParams }: { searchParams: Promise<{ filtro?: string; q?: string; mostrar?: string }> }) {
  const params = await searchParams;
  const session = await requireSession();
  const { db, org } = session;
  const today = todayIn(org.timezone);
  const q = (params.q ?? "").trim();
  const [context, counts] = await Promise.all([rowContext(session), bucketCounts(db, org.id, today, q)]);
  const active: Bucket = isBucket(params.filtro) ? params.filtro : counts.atrasadas > 0 ? "atrasadas" : "mes";
  const limit = Math.min(Math.max(Number(params.mostrar) || PAGE, PAGE), 400);
  const canCreate = can(session.role, "cobrancas.gravar");
  const [rows, total, people] = await Promise.all([
    listReceivables(db, org.id, today, { lateFineBp: org.lateFineBp, lateInterestMonthlyBp: org.lateInterestMonthlyBp }, { bucket: active, q, limit }),
    bucketTotal(db, org.id, today, active, q),
    canCreate ? db.select({ id: clients.id, name: clients.name }).from(clients).where(eq(clients.organizationId, org.id)).orderBy(asc(clients.name)) : [],
  ]);
  const href = (filtro: Bucket, more = 0) => {
    const query = new URLSearchParams({ filtro });
    if (q) query.set("q", q);
    if (more) query.set("mostrar", String(more));
    return `/receber?${query.toString()}`;
  };
  const everything = counts.atrasadas + counts.mes + counts.proximas + counts.recebidas;
  const nothingYet = everything === 0 && !q;
  return (
    <div className="space-y-4">
      <Title
        hint="Tudo o que seus clientes pagam, num lugar só."
        action={
          <>
            <span className="hidden md:inline-flex">
              <Link href="/vendas/nova" className={buttonClass}>
                + Nova venda
              </Link>
            </span>
            {canCreate ? <ChargeMenu clients={people} today={today} /> : null}
          </>
        }
      >
        A receber
      </Title>

      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Filtro">
        {BUCKETS.map((bucket) => (
          <Link key={bucket} href={href(bucket)} role="tab" aria-selected={bucket === active} className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold ${bucket === active ? "border-slate-900 bg-slate-900 text-white" : "border-[#E2E8F0] bg-white text-slate-800 hover:border-slate-300"}`}>
            {BUCKET_LABELS[bucket]}
            <span className="ml-1.5 opacity-70">{counts[bucket]}</span>
          </Link>
        ))}
      </div>

      <form className="flex gap-2" action="/receber">
        <input type="hidden" name="filtro" value={active} />
        <input name="q" defaultValue={q} placeholder="Buscar pelo nome do cliente" aria-label="Buscar pelo nome do cliente" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-700 sm:w-80" />
        <button className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">Buscar</button>
        {q ? (
          <Link href={href(active)} className="flex items-center px-2 text-sm font-semibold text-teal-700">
            Limpar
          </Link>
        ) : null}
      </form>

      {nothingYet ? (
        <Empty title="Você ainda não tem nada para receber" action={{ href: "/vendas/nova", label: "Fazer a primeira venda" }}>
          Cada parcela, mensalidade ou cobrança que você criar aparece aqui, com o botão Recebi e o botão Cobrar.
        </Empty>
      ) : (
        <>
          <p className="text-sm tabular-nums text-slate-500">
            {counts[active]} pagamento{counts[active] === 1 ? "" : "s"} · {money(total)}
            {active === "recebidas" ? " recebidos" : " em aberto"}
          </p>
          <ReceivableList rows={rows} context={context} empty={<Empty>{q ? `Ninguém com o nome “${q}” neste filtro.` : EMPTY[active]}</Empty>} />
          {counts[active] > rows.length ? (
            <div className="flex flex-col items-center gap-1 pt-1">
              <p className="text-sm text-slate-500">
                Mostrando {rows.length} de {counts[active]}
              </p>
              <Link href={href(active, limit + PAGE)} scroll={false} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">
                Carregar mais
              </Link>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
