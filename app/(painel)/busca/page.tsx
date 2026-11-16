import Link from "next/link";
import { Title } from "@/components/ui";
import { loadBook } from "@/lib/read";
import { requireSession } from "@/lib/session";

export default async function BuscaPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const params = await searchParams;
  const query = (params.q ?? "").trim().toLowerCase();
  const session = await requireSession();
  const book = await loadBook(session.db, session.org.id, session.org.timezone);
  const rows = book.clients.filter((client) => query && (client.name.toLowerCase().includes(query) || client.document.includes(query)));
  return (
    <div>
      <Title hint="A busca fica dentro da empresa autenticada.">Busca</Title>
      <form className="mb-4">
        <input name="q" defaultValue={params.q} className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm md:w-80" />
      </form>
      {rows.map((client) => <p key={client.id}><Link className="text-[#2563EB]" href={`/clientes/${client.id}`}>{client.name}</Link></p>)}
      {query && rows.length === 0 ? <p className="text-sm text-[#64748B]">Nenhum cliente com esse texto.</p> : null}
    </div>
  );
}
