import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/copy-button";
import { PayOnline } from "@/components/pay-online";
import { Toaster } from "@/components/toast";
import { ProductPhoto, secondaryButtonClass } from "@/components/ui";
import { money } from "@/components/ui";
import { formatDateBR } from "@/lib/dates";
import { getDb } from "@/lib/db";
import { loadPayPage, photoPath } from "@/lib/pay-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Seu pagamento", robots: { index: false, follow: false } };

export default async function PagarPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const page = await loadPayPage(await getDb(), token);
  if (!page) notFound();
  const { company } = page;
  const contact = [company.phone, company.email].filter(Boolean).join(" · ");
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-4 px-4 py-8">
      <header className="space-y-1 rounded-xl border border-[#E2E8F0] bg-white p-5 text-center shadow-sm">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-teal-700 text-lg font-bold text-white">{company.name.charAt(0).toUpperCase()}</span>
        <h1 className="text-xl font-bold text-slate-900">{company.name}</h1>
        <p className="text-sm text-slate-500">{page.clientFirstName ? `Olá, ${page.clientFirstName}. ` : ""}Este é o seu pagamento.</p>
      </header>

      <section className="space-y-3 rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
        {page.items.map((item) => (
          <div key={`${item.description}-${item.unitCents}`} className="flex items-center gap-3">
            <span className="h-[52px] w-[52px] shrink-0 overflow-hidden rounded-[10px]">
              <ProductPhoto name={item.description} src={item.photoId ? photoPath(item.photoId) : undefined} className="h-[52px] w-[52px] text-base" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold text-slate-900">{item.description}</span>
              <span className="block text-[13px] tabular-nums text-slate-500">
                {item.quantity} × {money(item.unitCents)}
              </span>
            </span>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-3 border-t border-slate-100 pt-3">
          <span className="text-sm text-slate-700">
            {page.title} · vence {formatDateBR(page.dueOn)}
          </span>
          {page.state === "open" ? <span className="text-2xl font-bold tabular-nums text-slate-900">{money(page.totalCents)}</span> : null}
        </div>
        {page.state === "open" && page.feeCents > 0 ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Este pagamento está atrasado. O valor de {money(page.openCents)} inclui {money(page.feeCents)} de multa e juros.
          </p>
        ) : null}
      </section>

      {page.state === "paid" ? (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center text-sm font-semibold text-emerald-800">Este pagamento já foi recebido. Obrigado!</section>
      ) : null}
      {page.state === "cancelled" ? (
        <section className="rounded-xl border border-[#E2E8F0] bg-white p-5 text-center text-sm text-slate-600">Esta cobrança foi cancelada. Não é preciso pagar.</section>
      ) : null}

      {page.state === "open" && page.online ? <PayOnline token={token} valueCents={page.totalCents} needsDocument={page.online.needsDocument} /> : null}
      {page.state === "open" && page.online && company.instructions ? <p className="whitespace-pre-line px-1 text-sm text-slate-600">{company.instructions}</p> : null}

      {page.state === "open" && !page.online ? (
        <section className="space-y-3 rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
          <h2 className="font-bold text-slate-900">Como pagar</h2>
          {company.pixKey ? (
            <div className="space-y-1.5">
              <p className="text-sm text-slate-600">Pague por Pix usando esta chave:</p>
              <div className="flex gap-2">
                <input readOnly value={company.pixKey} aria-label="Chave Pix" className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800" />
                <CopyButton text={company.pixKey} className={secondaryButtonClass} doneMessage="Chave Pix copiada">
                  Copiar
                </CopyButton>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-600">Peça a chave Pix para {company.name}{contact ? `: ${contact}` : ""}.</p>
          )}
          {company.instructions ? <p className="whitespace-pre-line text-sm text-slate-700">{company.instructions}</p> : null}
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">Depois de pagar, envie o comprovante para {company.name}.</p>
        </section>
      ) : null}

      <footer className="pt-2 text-center text-xs text-slate-400">{contact || company.name}</footer>
      <Toaster />
    </main>
  );
}
