import Link from "next/link";
import { CatalogForm } from "@/components/forms";
import { NewButton } from "@/components/new-button";
import { ConfirmAction } from "@/components/confirm-action";
import { Card, money, Status, Table, Title } from "@/components/ui";
import { adjustStockAction, toggleCatalogAction } from "@/app/actions";
import { loadBook } from "@/lib/read";
import { requireSession } from "@/lib/session";

export default async function ProdutosPage({ searchParams }: { searchParams: Promise<{ item?: string }> }) {
  const params = await searchParams;
  const session = await requireSession();
  const book = await loadBook(session.db, session.org.id, session.org.timezone);
  const editing = book.catalog.find((item) => item.id === params.item);
  const price = editing ? `${Math.floor(editing.priceCents / 100)},${String(editing.priceCents % 100).padStart(2, "0")}` : "";
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Title hint="Produto controla unidades. Serviço não baixa estoque.">Produtos e serviços</Title>
        <NewButton title="Novo produto ou serviço"><CatalogForm /></NewButton>
      </div>
      {editing ? (
        <Card>
          <CatalogForm
            itemId={editing.id}
            initial={{ kind: editing.kind === "servico" ? "servico" : "produto", name: editing.name, description: editing.description, category: editing.category, sku: editing.sku, price, billing: editing.billing === "recorrente" ? "recorrente" : "pontual", stock: editing.stockQuantity === null ? "" : String(editing.stockQuantity) }}
          />
        </Card>
      ) : null}
      <Table>
        <thead className="bg-slate-50 text-xs text-[#64748B]"><tr><th className="p-3">Nome</th><th>Tipo</th><th>Preço</th><th>Estoque</th><th>Situação</th><th></th></tr></thead>
        <tbody>
          {book.catalog.map((item) => (
            <tr key={item.id} className="border-t border-[#E2E8F0]">
              <td className="p-3">{item.name}<p className="text-xs text-[#64748B]">{item.category}</p></td>
              <td>{item.kind}</td>
              <td>{money(item.priceCents)}</td>
              <td>{item.stockQuantity === null ? "não controla" : item.stockQuantity}</td>
              <td><Status value={item.active ? "ativo" : "inativo"} /></td>
              <td className="space-x-3 p-3 text-sm">
                <Link className="text-teal-700" href={`/produtos?item=${item.id}`}>Editar</Link>
                {item.kind === "produto" ? (
                  <form className="inline" action={async (formData) => { "use server"; await adjustStockAction(item.id, Number(formData.get("quantity"))); }}>
                    <input name="quantity" type="number" min={0} defaultValue={item.stockQuantity ?? 0} className="w-16 rounded border border-[#E2E8F0] px-2 py-1 text-xs" aria-label={`Estoque de ${item.name}`} />
                    <button className="text-teal-700">Ajustar</button>
                  </form>
                ) : null}
                <ConfirmAction
                  label={item.active ? "Inativar" : "Reativar"}
                  confirmLabel={item.active ? "Inativar item" : "Reativar item"}
                  message={item.active ? "O item deixará de aparecer nas vendas." : "O item voltará a aparecer nas vendas."}
                  action={toggleCatalogAction.bind(null, item.id, !item.active)}
                  className="text-slate-600"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
