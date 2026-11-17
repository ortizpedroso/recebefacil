import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { and, asc, count, eq, ilike, ne, or, sql } from "drizzle-orm";
import { NewClientButton } from "@/components/client-dialog";
import { Avatar, Empty, money, Pill, smallButtonClass, smallPrimaryClass, Title } from "@/components/ui";
import { todayIn, whatsAppHref } from "@/lib/dates";
import { clientBadge } from "@/lib/labels";
import { firstName } from "@/lib/messages";
import { clientSummaries } from "@/lib/receivables";
import { clients, sales } from "@/lib/schema";
import { requireSession } from "@/lib/session";

const PAGE = 30;

export default async function ClientesPage({ searchParams }: { searchParams: Promise<{ q?: string; mostrar?: string }> }) {
  const params = await searchParams;
  const { db, org } = await requireSession();
  const today = todayIn(org.timezone);
  const q = (params.q ?? "").trim();
  const limit = Math.min(Math.max(Number(params.mostrar) || PAGE, PAGE), 600);
  const like = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
  const filter = and(eq(clients.organizationId, org.id), q ? or(ilike(clients.name, like), ilike(clients.whatsapp, like), ilike(clients.document, like)) : undefined);
  const [rows, [totalRow], [everyone], summaries, purchases] = await Promise.all([
    db.select().from(clients).where(filter).orderBy(asc(clients.name)).limit(limit),
    db.select({ total: count() }).from(clients).where(filter),
    db.select({ total: count() }).from(clients).where(eq(clients.organizationId, org.id)),
    clientSummaries(db, org.id, today),
    db
      .select({ clientId: sales.clientId, total: sql<number>`count(*)`.mapWith(Number) })
      .from(sales)
      .where(and(eq(sales.organizationId, org.id), ne(sales.status, "cancelada")))
      .groupBy(sales.clientId),
  ]);
  const total = Number(totalRow?.total ?? 0);
  const bought = new Map(purchases.map((row) => [row.clientId, row.total]));
  return (
    <div className="space-y-4">
      <Title hint={Number(everyone?.total ?? 0) === 0 ? "Nenhum cliente ainda." : `${everyone?.total} cliente${Number(everyone?.total) === 1 ? "" : "s"}`} action={<NewClientButton />}>
        Clientes
      </Title>
      {Number(everyone?.total ?? 0) > 0 ? (
        <form className="flex gap-2" action="/clientes">
          <input name="q" defaultValue={q} placeholder="Buscar pelo nome ou telefone" aria-label="Buscar cliente" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-700 sm:w-80" />
          <button className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">Buscar</button>
          {q ? (
            <Link href="/clientes" className="flex items-center px-2 text-sm font-semibold text-teal-700">
              Limpar
            </Link>
          ) : null}
        </form>
      ) : null}
      {Number(everyone?.total ?? 0) === 0 ? (
        <Empty title="Você ainda não tem clientes" action={<NewClientButton first />}>
          Cadastre quem compra de você. Só o nome e o WhatsApp são necessários, e você consegue cobrar e vender por aqui.
        </Empty>
      ) : rows.length === 0 ? (
        <Empty>Ninguém com “{q}”.</Empty>
      ) : (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-sm">
          {rows.map((client) => {
            const summary = summaries.get(client.id) ?? { openCents: 0, lateCount: 0, paidCents: 0 };
            const phone = client.whatsapp || client.phone;
            const purchasesCount = bought.get(client.id) ?? 0;
            const whatsapp = phone.replace(/\D/g, "").length >= 10 ? whatsAppHref(phone, `Olá, ${firstName(client.name)}!`) : null;
            return (
              <div key={client.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:flex-nowrap">
                <Avatar name={client.name} className="h-9 w-9 text-xs sm:h-10 sm:w-10 sm:text-sm" />
                <div className="min-w-0 flex-1 basis-[calc(100%-3.5rem)] sm:basis-auto">
                  <Link href={`/clientes/${client.id}`} className="block truncate font-semibold text-slate-900 hover:text-teal-700">
                    {client.name}
                  </Link>
                  <span className="block truncate text-[13px] text-slate-500">
                    {phone || "Sem telefone"} · {purchasesCount} compra{purchasesCount === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto sm:flex-nowrap sm:justify-end">
                  <Pill badge={clientBadge(summary)} />
                  <span className="min-w-24 text-right text-sm font-semibold tabular-nums text-slate-900">{summary.openCents > 0 ? money(summary.openCents) : "R$ 0,00"}</span>
                  <span className="flex gap-1.5">
                    {whatsapp ? (
                      <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={smallButtonClass}>
                        <MessageCircle className="h-3.5 w-3.5" />
                        WhatsApp
                      </a>
                    ) : null}
                    <Link href={`/vendas/nova?cliente=${client.id}`} className={smallPrimaryClass}>
                      Vender
                    </Link>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {total > rows.length ? (
        <div className="flex flex-col items-center gap-1 pt-1">
          <p className="text-sm text-slate-500">
            Mostrando {rows.length} de {total}
          </p>
          <Link href={`/clientes?${new URLSearchParams({ ...(q ? { q } : {}), mostrar: String(limit + PAGE) }).toString()}`} scroll={false} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">
            Carregar mais
          </Link>
        </div>
      ) : null}
    </div>
  );
}
