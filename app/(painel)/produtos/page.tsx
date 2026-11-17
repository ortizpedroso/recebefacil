import { asc, eq } from "drizzle-orm";
import { NewProductButton, ProductMenu } from "@/components/product-dialog";
import { Empty, money, ProductPhoto, Title } from "@/components/ui";
import { isCatalogKind, kindLabel, tracksStock } from "@/lib/labels";
import { photoIds } from "@/lib/receivables";
import { catalogItems } from "@/lib/schema";
import { requireSession } from "@/lib/session";

export default async function ProdutosPage() {
  const { db, org } = await requireSession();
  const [items, photos] = await Promise.all([
    db.select().from(catalogItems).where(eq(catalogItems.organizationId, org.id)).orderBy(asc(catalogItems.name)),
    photoIds(db, org.id),
  ]);
  const active = items.filter((item) => item.active).length;
  return (
    <div className="space-y-4">
      <Title hint={items.length === 0 ? "Nenhum item ainda." : `${active} ${active === 1 ? "item" : "itens"}${active < items.length ? `, ${items.length - active} inativo${items.length - active === 1 ? "" : "s"}` : ""}`} action={<NewProductButton />}>
        Produtos e serviços
      </Title>
      {items.length === 0 ? (
        <Empty title="Você ainda não cadastrou nada para vender" action={<NewProductButton first />}>
          Cadastre o que você vende, com foto e preço. Os itens aparecem na hora de fazer uma venda e na página de pagamento do cliente.
        </Empty>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => {
            const kind = isCatalogKind(item.kind) ? item.kind : "produto";
            const photoId = photos.get(item.id) ?? null;
            return (
              <article key={item.id} className={`relative flex flex-col overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-sm ${item.active ? "" : "opacity-60"}`}>
                <ProductPhoto name={item.name} photoId={photoId} />
                <div className="absolute right-2 top-2">
                  <ProductMenu
                    active={item.active}
                    product={{ id: item.id, name: item.name, kind, price: `${Math.floor(item.priceCents / 100)},${String(item.priceCents % 100).padStart(2, "0")}`, category: item.category, sku: item.sku, stock: item.stockQuantity === null ? "" : String(item.stockQuantity), photoId }}
                  />
                </div>
                <div className="flex flex-col gap-0.5 px-3 py-2.5">
                  <span className="truncate font-semibold text-slate-900">{item.name}</span>
                  <span className="text-sm font-semibold tabular-nums text-slate-900">{money(item.priceCents)}</span>
                  <span className="text-[13px] text-slate-500">
                    {kindLabel(kind)}
                    {tracksStock(kind) && item.stockQuantity !== null ? ` · ${item.stockQuantity} em estoque` : ""}
                    {item.active ? "" : " · Inativo"}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
