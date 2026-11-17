import { eq } from "drizzle-orm";
import { Shell, type ShellAlert, type ShellSearch } from "@/components/shell";
import { money } from "@/components/ui";
import { formatDateBR, todayIn } from "@/lib/dates";
import { advanceRecurrences } from "@/lib/ledger";
import { alertRows } from "@/lib/receivables";
import { clients, sales } from "@/lib/schema";
import { requireSession } from "@/lib/session";
import { normalize } from "@/lib/text";

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const { db, org } = session;
  const today = todayIn(org.timezone);
  await advanceRecurrences(db, org.id, today);
  const [people, saleRows, alertData] = await Promise.all([
    db.select({ id: clients.id, name: clients.name, document: clients.document, phone: clients.whatsapp }).from(clients).where(eq(clients.organizationId, org.id)),
    db.select({ id: sales.id, code: sales.code, clientId: sales.clientId, total: sales.totalCents }).from(sales).where(eq(sales.organizationId, org.id)),
    alertRows(db, org.id, today),
  ]);
  const names = new Map(people.map((client) => [client.id, client.name]));
  const search: ShellSearch[] = [
    ...people.map((client) => ({
      kind: "Cliente",
      title: client.name,
      subtitle: client.phone || client.document || "Sem telefone",
      href: `/clientes/${client.id}`,
      haystack: normalize(`${client.name} ${client.document} ${client.phone}`),
    })),
    ...saleRows.map((sale) => ({
      kind: "Venda",
      title: `${names.get(sale.clientId) ?? "Cliente"} · ${sale.code}`,
      subtitle: money(sale.total),
      href: `/vendas/${sale.id}`,
      haystack: normalize(`${sale.code} ${names.get(sale.clientId) ?? ""}`),
    })),
  ];
  const alerts: ShellAlert[] = [
    ...alertData.late.map((row) => ({
      id: row.id,
      tone: "late" as const,
      label: `Atrasada ${row.late} ${row.late === 1 ? "dia" : "dias"}`,
      amount: money(row.openCents),
      detail: `${row.clientName} · venceu ${formatDateBR(row.dueOn)}`,
      href: "/receber?filtro=atrasadas",
    })),
    ...alertData.soon.map((row) => ({
      id: row.id,
      tone: "soon" as const,
      label: "Vence logo",
      amount: money(row.openCents),
      detail: `${row.clientName} · vence ${formatDateBR(row.dueOn)}`,
      href: "/receber?filtro=mes",
    })),
  ];
  return (
    <Shell
      company={org.tradeName}
      profileName={session.profileName}
      profileRole={session.profileRole}
      profileEmail={session.profileEmail}
      showAvatar={session.showAvatar}
      publicDemo={session.publicDemo}
      lateCount={alertData.lateCount}
      search={search}
      alerts={alerts}
    >
      {children}
    </Shell>
  );
}
