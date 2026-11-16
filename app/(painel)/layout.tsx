import { desc, eq } from "drizzle-orm";
import { Shell, type ShellAlert, type ShellSearch } from "@/components/shell";
import { formatDateBR, todayIn } from "@/lib/dates";
import { money } from "@/components/ui";
import { advanceRecurrences } from "@/lib/ledger";
import { clientName, displayStatus, loadBook } from "@/lib/read";
import { errorEvents } from "@/lib/schema";
import { requireSession } from "@/lib/session";

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  await advanceRecurrences(session.db, session.org.id, todayIn(session.org.timezone));
  const book = await loadBook(session.db, session.org.id, session.org.timezone);
  const search: ShellSearch[] = [
    ...book.clients.map((client) => ({
      kind: "Cliente",
      title: client.name,
      subtitle: client.document,
      href: `/clientes/${client.id}`,
      haystack: `${client.name} ${client.document}`.toLowerCase(),
    })),
    ...book.sales.map((sale) => ({
      kind: "Venda",
      title: sale.code,
      subtitle: `${clientName(book, sale.clientId)} · ${money(sale.totalCents)}`,
      href: "/vendas",
      haystack: `${sale.code} ${clientName(book, sale.clientId)}`.toLowerCase(),
    })),
    ...book.charges.map((charge) => ({
      kind: "Cobrança",
      title: charge.code,
      subtitle: `${clientName(book, charge.clientId)} · ${money(charge.amountCents)}`,
      href: "/cobrancas",
      haystack: `${charge.code} ${clientName(book, charge.clientId)}`.toLowerCase(),
    })),
  ];
  const late = book.charges.filter((charge) => displayStatus(charge.status, charge.dueOn, book.today, charge.paidCents, charge.amountCents) === "vencida");
  const soon = book.charges
    .filter((charge) => displayStatus(charge.status, charge.dueOn, book.today, charge.paidCents, charge.amountCents) === "pendente")
    .slice(0, 3);
  const recentErrors = await session.db.select().from(errorEvents).where(eq(errorEvents.organizationId, session.org.id)).orderBy(desc(errorEvents.createdAt)).limit(5);
  const alerts: ShellAlert[] = [
    ...recentErrors.map((event) => ({
      id: event.id,
      tone: "erro" as const,
      label: "Erro registrado",
      amount: event.scope,
      detail: event.message,
      href: "/ajuda",
    })),
    ...late.map((charge) => ({
      id: charge.id,
      tone: "late" as const,
      label: "Cobrança vencida",
      amount: money(charge.amountCents - charge.paidCents),
      detail: `${clientName(book, charge.clientId)} · Venc. ${formatDateBR(charge.dueOn)}`,
      href: "/inadimplencia",
    })),
    ...soon.map((charge) => ({
      id: charge.id,
      tone: "soon" as const,
      label: "Vencimento próximo",
      amount: money(charge.amountCents - charge.paidCents),
      detail: `${clientName(book, charge.clientId)} · Venc. ${formatDateBR(charge.dueOn)}`,
      href: "/cobrancas",
    })),
  ];
  return (
    <Shell
      company={session.org.tradeName}
      profileName={session.profileName}
      profileRole={session.profileRole}
      profileEmail={session.profileEmail}
      showAvatar={session.showAvatar}
      lateCount={late.length}
      search={search}
      alerts={alerts}
    >
      {children}
    </Shell>
  );
}
