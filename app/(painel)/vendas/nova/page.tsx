import { and, asc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { NewSale } from "@/components/new-sale";
import { Title } from "@/components/ui";
import { loadAccess } from "@/lib/billing";
import { todayIn } from "@/lib/dates";
import { photoIds } from "@/lib/receivables";
import { catalogItems, clients } from "@/lib/schema";
import { requireSession } from "@/lib/session";
import { isCatalogKind } from "@/lib/labels";

export default async function NovaVendaPage({ searchParams }: { searchParams: Promise<{ cliente?: string }> }) {
  const { cliente } = await searchParams;
  const { db, org } = await requireSession();
  if (!(await loadAccess(db, org)).access.canSell) redirect("/assinatura");
  const [people, items, photos] = await Promise.all([
    db.select({ id: clients.id, name: clients.name, phone: clients.whatsapp }).from(clients).where(eq(clients.organizationId, org.id)).orderBy(asc(clients.name)),
    db.select().from(catalogItems).where(and(eq(catalogItems.organizationId, org.id), eq(catalogItems.active, true))).orderBy(asc(catalogItems.name)),
    photoIds(db, org.id),
  ]);
  return (
    <div>
      <Title hint="Uma tela só. Escolha o cliente, toque nos produtos e diga como vai receber.">Nova venda</Title>
      <NewSale
        today={todayIn(org.timezone)}
        initialClientId={cliente ?? ""}
        clients={people}
        catalog={items.map((item) => ({ id: item.id, name: item.name, priceCents: item.priceCents, kind: isCatalogKind(item.kind) ? item.kind : "produto", photoId: photos.get(item.id) ?? null, stock: item.stockQuantity }))}
      />
    </div>
  );
}
