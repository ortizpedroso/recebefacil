import { and, eq } from "drizzle-orm";
import { SaleWizard } from "@/components/sale-wizard";
import { Card, Title } from "@/components/ui";
import { loadBook } from "@/lib/read";
import { charges, saleItems, sales } from "@/lib/schema";
import { requireSession } from "@/lib/session";

export default async function EditarVendaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const book = await loadBook(session.db, session.org.id, session.org.timezone);
  const [sale] = await session.db.select().from(sales).where(and(eq(sales.organizationId, session.org.id), eq(sales.id, id)));
  if (!sale || sale.status !== "aguardando") {
    return <Card><p className="text-sm text-[#64748B]">Venda indisponível para edição. Só vendas sem recebimento podem ser editadas.</p></Card>;
  }
  const items = await session.db.select().from(saleItems).where(and(eq(saleItems.organizationId, session.org.id), eq(saleItems.saleId, id)));
  const chargeRows = await session.db.select().from(charges).where(and(eq(charges.organizationId, session.org.id), eq(charges.saleId, id)));
  const firstParcel = chargeRows.filter((row) => row.label !== "Entrada").sort((a, b) => a.dueOn.localeCompare(b.dueOn))[0];
  return (
    <div>
      <Title hint="Só vendas sem recebimento podem ser editadas. O servidor refaz as parcelas.">Editar venda</Title>
      <Card>
        <SaleWizard
          today={book.today}
          clients={book.clients.filter((client) => client.active).map((client) => ({ id: client.id, name: client.name }))}
          catalog={book.catalog.filter((item) => item.active).map((item) => ({ id: item.id, name: item.name, priceCents: item.priceCents, kind: item.kind as "produto" | "servico" }))}
          sale={{
            id: sale.id,
            clientId: sale.clientId,
            soldOn: sale.soldOn,
            notes: sale.notes,
            discountCents: sale.discountCents,
            mode: sale.mode as "avista" | "parcelado" | "recorrente",
            entryCents: sale.entryCents,
            installmentCount: sale.installmentCount ?? 1,
            interestMonthlyBp: sale.interestMonthlyBp,
            adjustYearlyBp: sale.adjustYearlyBp,
            periodicity: (sale.periodicity ?? "mensal") as "semanal" | "quinzenal" | "mensal" | "trimestral" | "semestral" | "anual",
            makeContract: book.contracts.some((contract) => contract.saleId === sale.id),
            firstDue: firstParcel?.dueOn ?? sale.soldOn,
            method: chargeRows[0]?.method ?? "Pix",
            lines: items.map((item) => ({ catalogItemId: item.catalogItemId, description: item.description, kind: item.kind as "produto" | "servico", quantity: item.quantity, unitCents: item.unitCents })),
          }}
        />
      </Card>
    </div>
  );
}
