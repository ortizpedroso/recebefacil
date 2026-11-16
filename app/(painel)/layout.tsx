import { Shell } from "@/components/shell";
import { loadBook, overdueCount } from "@/lib/read";
import { requireSession } from "@/lib/session";

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const book = await loadBook(session.db, session.org.id, session.org.timezone);
  return (
    <Shell company={session.org.tradeName} userName={session.userName} alerts={overdueCount(book)}>
      <p className="mb-4 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs text-[#64748B]">
        Valores fictícios. O Asaas desta tela não cobra de verdade.
      </p>
      {children}
    </Shell>
  );
}
