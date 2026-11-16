import { SaleWizard } from "@/components/sale-wizard";
import { Card, Title } from "@/components/ui";
import { loadBook } from "@/lib/read";
import { requireSession } from "@/lib/session";

export default async function NovaVendaPage() {
  const session = await requireSession();
  const book = await loadBook(session.db, session.org.id, session.org.timezone);
  return (
    <div>
      <Title hint="O servidor recalcula as parcelas. A primeira parcela fica com o centavo restante.">Nova venda</Title>
      <Card>
        <SaleWizard
          today={book.today}
          clients={book.clients.filter((client) => client.active).map((client) => ({ id: client.id, name: client.name }))}
          catalog={book.catalog.filter((item) => item.active).map((item) => ({ id: item.id, name: item.name, priceCents: item.priceCents, kind: item.kind as "produto" | "servico" }))}
        />
      </Card>
    </div>
  );
}
