import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { PrintButton } from "@/components/print-button";
import { secondaryButtonClass } from "@/components/ui";
import { contractClauses, type ContractFacts } from "@/lib/contract-text";
import { formatDateBR } from "@/lib/dates";
import { charges, clients, contracts, saleItems, sales } from "@/lib/schema";
import { requireSession } from "@/lib/session";

function addressOf(row: { street: string; number: string; district: string; city: string; state: string; zip: string }) {
  const street = [row.street, row.number].filter(Boolean).join(", ");
  const place = [row.city, row.state].filter(Boolean).join(" - ");
  return [street, row.district, place, row.zip].filter(Boolean).join(", ");
}

export default async function ContratoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, org } = await requireSession();
  const [contract] = await db.select().from(contracts).where(and(eq(contracts.organizationId, org.id), eq(contracts.id, id)));
  if (!contract) notFound();
  const [client] = await db.select().from(clients).where(eq(clients.id, contract.clientId));
  const [sale] = contract.saleId ? await db.select().from(sales).where(eq(sales.id, contract.saleId)) : [];
  const items = contract.saleId ? await db.select().from(saleItems).where(and(eq(saleItems.organizationId, org.id), eq(saleItems.saleId, contract.saleId))) : [];
  const owned = await db
    .select()
    .from(charges)
    .where(and(eq(charges.organizationId, org.id), sale ? eq(charges.saleId, sale.id) : eq(charges.contractId, contract.id)))
    .orderBy(asc(charges.dueOn), asc(charges.number));
  const live = owned.filter((row) => row.status !== "cancelada");
  const facts: ContractFacts = {
    issuedOn: contract.startsOn,
    company: { name: org.legalName || org.tradeName, document: org.document, address: org.address },
    client: { name: client?.name ?? "Cliente", document: client?.document ?? "", address: client ? addressOf(client) : "" },
    items: items.length
      ? items.map((item) => ({ description: item.description, quantity: item.quantity, unitCents: item.unitCents }))
      : [{ description: contract.description, quantity: 1, unitCents: contract.totalCents }],
    discountCents: sale?.discountCents ?? 0,
    totalCents: contract.totalCents,
    mode: sale?.mode ?? "parcelado",
    entryCents: sale?.entryCents ?? 0,
    installmentCount: sale?.installmentCount ?? live.length,
    installments: live.map((row) => ({ dueOn: row.dueOn, amountCents: row.amountCents })),
    periodicity: sale?.periodicity ?? "mensal",
    interestMonthlyBp: sale?.interestMonthlyBp ?? 0,
    adjustYearlyBp: sale?.adjustYearlyBp ?? 0,
    lateFineBp: org.lateFineBp,
    lateInterestMonthlyBp: org.lateInterestMonthlyBp,
  };
  const clauses = contractClauses(facts);
  const incomplete = org.legalName === "" && org.document === "";
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href={sale ? `/vendas/${sale.id}` : "/receber"} className="text-sm text-slate-500 hover:text-slate-800">
          ← Voltar
        </Link>
        <PrintButton label="Imprimir contrato" />
      </div>
      {incomplete ? (
        <p className="flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 print:hidden">
          Os dados da sua empresa estão incompletos, e o contrato sai sem o documento do vendedor.
          <Link href="/configuracoes" className={secondaryButtonClass}>
            Completar agora
          </Link>
        </p>
      ) : null}
      <article className="space-y-5 rounded-xl border border-[#E2E8F0] bg-white p-8 text-[15px] leading-relaxed text-slate-900 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none">
        <header className="text-center">
          <h1 className="text-xl font-bold uppercase tracking-wide">Contrato de compra e venda</h1>
          <p className="mt-1 text-sm text-slate-500">
            Contrato {contract.number} · {formatDateBR(contract.startsOn)}
          </p>
        </header>
        {clauses.map((clause, index) => (
          <section key={clause.title} className="space-y-1.5">
            <h2 className="font-bold">
              Cláusula {index + 1}ª. {clause.title}
            </h2>
            {clause.paragraphs.map((text) => (
              <p key={text}>{text}</p>
            ))}
          </section>
        ))}
        <p className="pt-4">{formatDateBR(contract.startsOn)}.</p>
        <div className="grid gap-10 pt-12 sm:grid-cols-2">
          {[
            { label: "VENDEDOR", name: facts.company.name },
            { label: "COMPRADOR", name: facts.client.name },
          ].map((party) => (
            <div key={party.label} className="border-t border-slate-900 pt-1.5 text-center text-sm">
              <p className="font-semibold">{party.name}</p>
              <p className="text-slate-500">{party.label}</p>
            </div>
          ))}
        </div>
      </article>
    </div>
  );
}
