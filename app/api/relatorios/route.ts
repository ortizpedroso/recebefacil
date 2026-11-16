import { NextResponse } from "next/server";
import { formatDateBR } from "@/lib/dates";
import { formatBRL, cents } from "@/lib/money";
import { pdfDocument } from "@/lib/pdf";
import { clientName, loadBook } from "@/lib/read";
import { requireSession } from "@/lib/session";

export async function GET(request: Request) {
  const session = await requireSession();
  const book = await loadBook(session.db, session.org.id, session.org.timezone);
  const url = new URL(request.url);
  const format = url.searchParams.get("formato");
  const from = url.searchParams.get("de") || "0000-01-01";
  const to = url.searchParams.get("ate") || "9999-12-31";
  const clientId = url.searchParams.get("cliente") || "";
  const status = url.searchParams.get("status") || "";
  const sales = book.sales.filter((sale) => {
    if (sale.soldOn < from || sale.soldOn > to) return false;
    if (clientId && sale.clientId !== clientId) return false;
    if (status && sale.status !== status) return false;
    return true;
  });
  const lines = ["RecebeFacil - relatorio", `Empresa ${session.org.tradeName}`, `Periodo ${from} a ${to}`];
  for (const sale of sales) {
    lines.push(`${sale.code} ${formatDateBR(sale.soldOn)} ${clientName(book, sale.clientId)} ${formatBRL(cents(sale.totalCents))} ${sale.status}`);
  }
  if (format === "pdf") {
    return new NextResponse(pdfDocument(lines.slice(0, 40)), {
      headers: { "content-type": "application/pdf", "content-disposition": "attachment; filename=relatorio.pdf" },
    });
  }
  const csv = ["codigo,data,cliente,total_centavos,status", ...sales.map((sale) => `${sale.code},${sale.soldOn},"${clientName(book, sale.clientId)}",${sale.totalCents},${sale.status}`)].join("\n");
  return new NextResponse(csv, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": "attachment; filename=relatorio.csv" },
  });
}
