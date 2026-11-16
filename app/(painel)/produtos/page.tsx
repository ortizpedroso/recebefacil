import { CatalogForm } from "@/components/forms";
import { Card, money, Status, Table, Title } from "@/components/ui";
import { toggleCatalogAction } from "@/app/actions";
import { loadBook } from "@/lib/read";
import { requireSession } from "@/lib/session";

export default async function ProdutosPage() {
  const session = await requireSession();
  const book = await loadBook(session.db, session.org.id, session.org.timezone);
  return (
    <div className="space-y-4">
      <Title hint="Catálogo único. Estoque fica de fora.">Produtos e serviços</Title>
      <Card><CatalogForm /></Card>
      <Table>
        <thead className="bg-slate-50 text-xs text-[#64748B]"><tr><th className="p-3">Nome</th><th>Tipo</th><th>Preço</th><th>Situação</th><th></th></tr></thead>
        <tbody>
          {book.catalog.map((item) => (
            <tr key={item.id} className="border-t border-[#E2E8F0]">
              <td className="p-3">{item.name}<p className="text-xs text-[#64748B]">{item.category}</p></td>
              <td>{item.kind}</td>
              <td>{money(item.priceCents)}</td>
              <td><Status value={item.active ? "ativo" : "inativo"} /></td>
              <td>
                <form action={async () => { "use server"; await toggleCatalogAction(item.id, !item.active); }}>
                  <button className="text-sm text-[#2563EB]">{item.active ? "Inativar" : "Reativar"}</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
