import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { NewSale, type SaleToEdit } from "@/components/new-sale";
import { Card, secondaryButtonClass, Title } from "@/components/ui";
import { todayIn } from "@/lib/dates";
import { isCatalogKind } from "@/lib/labels";
import { photoIds } from "@/lib/receivables";
import { catalogItems, charges, clients, saleItems, sales } from "@/lib/schema";
import { requireSession } from "@/lib/session";

export default async function EditarVendaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, org } = await requireSession();
  const [sale] = await db.select().from(sales).where(and(eq(sales.organizationId, org.id), eq(sales.id, id)));
  if (!sale) notFound();
  const [items, chargeRows, people, catalog, photos] = await Promise.all([
    db.select().from(saleItems).where(and(eq(saleItems.organizationId, org.id), eq(saleItems.saleId, id))),
    db.select().from(charges).where(and(eq(charges.organizationId, org.id), eq(charges.saleId, id))),
    db.select({ id: clients.id, name: clients.name, phone: clients.whatsapp }).from(clients).where(eq(clients.organizationId, org.id)).orderBy(asc(clients.name)),
    db.select().from(catalogItems).where(and(eq(catalogItems.organizationId, org.id), eq(catalogItems.active, true))).orderBy(asc(catalogItems.name)),
    photoIds(db, org.id),
  ]);
  if (sale.status === "cancelada" || chargeRows.some((row) => row.paidCents > 0)) {
    return (
      <div>
        <Title>Editar venda</Title>
        <Card>
          <p className="text-sm text-slate-600">Esta venda já tem recebimento ou foi cancelada, então não dá para editar. Desfaça os recebimentos na página da venda para poder mudar.</p>
          <div className="mt-4">
            <Link href={`/vendas/${id}`} className={secondaryButtonClass}>
              Voltar para a venda
            </Link>
          </div>
        </Card>
      </div>
    );
  }
  const first = chargeRows.filter((row) => row.label !== "Entrada").sort((a, b) => a.dueOn.localeCompare(b.dueOn))[0];
  const start: SaleToEdit = {
    id: sale.id,
    clientId: sale.clientId,
    soldOn: sale.soldOn,
    discountCents: sale.discountCents,
    plan: sale.mode === "avista" ? "avista" : sale.mode === "recorrente" ? "mensalidade" : "parcelado",
    entryCents: sale.entryCents,
    count: sale.installmentCount ?? 2,
    interestBp: sale.interestMonthlyBp,
    adjustBp: sale.adjustYearlyBp,
    periodicity: (sale.periodicity ?? "mensal") as SaleToEdit["periodicity"],
    firstDue: first?.dueOn ?? sale.soldOn,
    method: chargeRows[0]?.method ?? "Pix",
    lines: items.map((item) => ({ key: item.id, catalogItemId: item.catalogItemId, description: item.description, kind: item.kind === "produto" ? "produto" : "servico", quantity: item.quantity, unitCents: item.unitCents })),
  };
  return (
    <div>
      <Title hint="Só vendas sem recebimento podem ser editadas. As parcelas são refeitas ao salvar.">Editar venda</Title>
      <NewSale
        sale={start}
        today={todayIn(org.timezone)}
        clients={people}
        catalog={catalog.map((item) => ({ id: item.id, name: item.name, priceCents: item.priceCents, kind: isCatalogKind(item.kind) ? item.kind : "produto", photoId: photos.get(item.id) ?? null, stock: item.stockQuantity }))}
      />
    </div>
  );
}
