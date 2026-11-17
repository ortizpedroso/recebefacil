import { eq } from "drizzle-orm";
import { cancelFiscalAction, issueFiscalAction } from "@/app/actions";
import { ConfirmAction } from "@/components/confirm-action";
import { buttonClass, Card, money, Title } from "@/components/ui";
import { fiscalDocuments, sales } from "@/lib/schema";
import { requireSession } from "@/lib/session";

export default async function FiscalPage() {
  const session = await requireSession();
  const saleRows = await session.db.select().from(sales).where(eq(sales.organizationId, session.org.id));
  const documents = await session.db.select().from(fiscalDocuments).where(eq(fiscalDocuments.organizationId, session.org.id));
  return (
    <div className="space-y-4">
      <Title hint="Documento interno da empresa. Esta versão não transmite a nota à SEFAZ.">Notas fiscais</Title>
      <Card>
        <p className="mb-2 font-medium">Emitir a partir da venda</p>
        <div className="space-y-2">
          {saleRows.filter((sale) => sale.status !== "cancelada").map((sale) => (
            <div key={sale.id} className="flex flex-wrap items-center gap-3 text-sm">
              <span>{sale.code}</span>
              <span>{money(sale.totalCents)}</span>
              <ConfirmAction label="Emitir" confirmLabel="Emitir nota" message="A nota fiscal interna será emitida para esta venda." action={issueFiscalAction.bind(null, sale.id)} className={buttonClass} />
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <p className="mb-2 font-medium">Documentos</p>
        {documents.length === 0 ? <p className="text-sm text-[#64748B]">Nenhuma nota emitida.</p> : null}
        {documents.map((document) => (
          <div key={document.id} className="flex flex-wrap items-center gap-3 border-t border-[#E2E8F0] py-2 text-sm">
            <span>Série {document.series} número {document.number}</span>
            <span>{money(document.totalCents)}</span>
            <span>{document.status}</span>
            <span className="text-xs text-[#64748B]">{document.accessKey}</span>
            {document.status === "emitida" ? (
              <ConfirmAction label="Cancelar" confirmLabel="Cancelar nota" message="A nota fiscal será cancelada." action={cancelFiscalAction.bind(null, document.id)} className="text-[#EF4444]" danger />
            ) : null}
          </div>
        ))}
      </Card>
    </div>
  );
}
