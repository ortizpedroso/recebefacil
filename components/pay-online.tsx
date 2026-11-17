"use client";

import { Barcode, CheckCircle2, CreditCard, QrCode } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { startPaymentAction } from "@/app/pagar/[token]/actions";
import type { CheckoutView } from "@/lib/asaas-checkout";
import { formatDateBR } from "@/lib/dates";
import { documentKind } from "@/lib/documents";
import { maskCpfOrCnpj } from "@/lib/masks";
import { CopyButton } from "./copy-button";
import { FormError } from "./dialog";
import { Field, inputClass, money, secondaryButtonClass } from "./ui";

type Method = "pix" | "boleto" | "cartao";
type Screen = { kind: "choose" } | { kind: "loading"; method: Method } | CheckoutView;

const POLL_MS = 4000;

export function PayOnline({ token, valueCents, needsDocument }: { token: string; valueCents: number; needsDocument: boolean }) {
  const [screen, setScreen] = useState<Screen>({ kind: "choose" });
  const [document, setDocument] = useState("");
  const [askDocument, setAskDocument] = useState(needsDocument);
  const [error, setError] = useState("");

  const choose = useCallback(
    async (method: Method) => {
      setError("");
      if (askDocument && !documentKind(document)) {
        setError("Informe um CPF ou CNPJ válido para gerar o pagamento.");
        return;
      }
      setScreen({ kind: "loading", method });
      const result = await startPaymentAction(token, method, document);
      if (!result.ok) {
        if (result.needsDocument) setAskDocument(true);
        setError(result.error);
        setScreen({ kind: "choose" });
        return;
      }
      if (result.view.kind === "card") {
        window.location.assign(result.view.url);
        return;
      }
      setScreen(result.view);
    },
    [askDocument, document, token],
  );

  if (screen.kind === "paid") return <Paid />;
  if (screen.kind === "pix") return <PixPanel token={token} view={screen} onNew={() => choose("pix")} onBack={() => setScreen({ kind: "choose" })} onPaid={() => setScreen({ kind: "paid" })} />;
  if (screen.kind === "boleto") return <BoletoPanel view={screen} onBack={() => setScreen({ kind: "choose" })} />;

  const busy = screen.kind === "loading" || screen.kind === "card";
  const options: { method: Method; label: string; hint: string; icon: typeof QrCode }[] = [
    { method: "pix", label: "Pix", hint: "Cai na hora", icon: QrCode },
    { method: "boleto", label: "Boleto", hint: "Confirma em até 2 dias úteis", icon: Barcode },
    { method: "cartao", label: "Cartão", hint: "Você digita o cartão no site do Asaas", icon: CreditCard },
  ];
  return (
    <section className="space-y-3 rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
      <h2 className="font-bold text-slate-900">Como pagar {money(valueCents)}</h2>
      {askDocument ? (
        <Field label="Seu CPF ou CNPJ" hint="o Asaas pede para gerar o pagamento">
          <input className={inputClass} inputMode="numeric" autoComplete="off" value={document} onChange={(event) => setDocument(maskCpfOrCnpj(event.target.value))} placeholder="000.000.000-00" />
        </Field>
      ) : null}
      <div className="grid gap-2">
        {options.map(({ method, label, hint, icon: Icon }) => (
          <button
            key={method}
            type="button"
            disabled={busy}
            onClick={() => choose(method)}
            className="flex items-center gap-3 rounded-xl border-[1.5px] border-[#E2E8F0] px-4 py-3 text-left hover:border-teal-700 hover:bg-teal-50 disabled:cursor-wait disabled:opacity-60"
          >
            <Icon className="h-5 w-5 shrink-0 text-teal-700" />
            <span>
              <span className="block font-semibold text-slate-900">{screen.kind === "loading" && screen.method === method ? "Gerando..." : label}</span>
              <span className="block text-[13px] text-slate-500">{hint}</span>
            </span>
          </button>
        ))}
      </div>
      <FormError message={error} />
    </section>
  );
}

function Paid() {
  return (
    <section role="status" className="space-y-1 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center text-emerald-800">
      <CheckCircle2 className="mx-auto h-8 w-8" />
      <p className="text-lg font-bold">Pagamento confirmado</p>
      <p className="text-sm">Obrigado! Já avisamos quem vendeu para você.</p>
    </section>
  );
}

function clock(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(rest)}` : `${minutes}:${pad(rest)}`;
}

function PixPanel({ token, view, onNew, onBack, onPaid }: { token: string; view: Extract<CheckoutView, { kind: "pix" }>; onNew: () => void; onBack: () => void; onPaid: () => void }) {
  const expiresAt = view.expiresAt ? Date.parse(view.expiresAt) : null;
  const [left, setLeft] = useState<number | null>(() => (expiresAt === null ? null : Math.max(0, Math.round((expiresAt - Date.now()) / 1000))));

  useEffect(() => {
    if (expiresAt === null) return;
    const tick = () => setLeft(Math.max(0, Math.round((expiresAt - Date.now()) / 1000)));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);

  useEffect(() => {
    let stopped = false;
    const poll = async () => {
      try {
        const response = await fetch(`/api/pagar/${encodeURIComponent(token)}/status`, { cache: "no-store" });
        const body = (await response.json()) as { state?: string };
        if (!stopped && body.state === "paid") onPaid();
      } catch {
        // sem rede por um instante: a próxima volta tenta de novo
      }
    };
    const timer = window.setInterval(poll, POLL_MS);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [token, onPaid]);

  const expired = left === 0;
  return (
    <section className="space-y-3 rounded-xl border border-[#E2E8F0] bg-white p-5 text-center shadow-sm">
      <h2 className="font-bold text-slate-900">Pague {money(view.valueCents)} com Pix</h2>
      {expired ? (
        <div className="space-y-2">
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Este QR Code venceu.</p>
          <button type="button" className={secondaryButtonClass} onClick={onNew}>
            Gerar um QR Code novo
          </button>
        </div>
      ) : (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`data:image/png;base64,${view.image}`} alt="QR Code do Pix" className="mx-auto h-52 w-52 rounded-lg border border-slate-200 bg-white p-2" />
          <p className="text-sm text-slate-600">Abra o app do seu banco, escolha pagar com Pix e leia o QR Code. Ou use o Pix copia e cola:</p>
          <div className="flex gap-2 text-left">
            <input readOnly value={view.payload} aria-label="Pix copia e cola" className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800" />
            <CopyButton text={view.payload} className={secondaryButtonClass} doneMessage="Pix copiado">
              Copiar
            </CopyButton>
          </div>
          {left !== null ? <p className="text-sm font-semibold tabular-nums text-slate-700">Expira em {clock(left)}</p> : null}
          <p className="text-sm text-slate-500">Assim que o pagamento cair, esta tela avisa.</p>
        </>
      )}
      <button type="button" className="text-sm font-semibold text-teal-700 hover:underline" onClick={onBack}>
        Escolher outra forma de pagar
      </button>
    </section>
  );
}

function BoletoPanel({ view, onBack }: { view: Extract<CheckoutView, { kind: "boleto" }>; onBack: () => void }) {
  return (
    <section className="space-y-3 rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
      <h2 className="font-bold text-slate-900">Boleto de {money(view.valueCents)}</h2>
      {view.dueOn ? <p className="text-sm text-slate-600">Vence em {formatDateBR(view.dueOn)}. A confirmação pode levar até 2 dias úteis.</p> : null}
      {view.identificationField ? (
        <div className="space-y-1.5">
          <p className="text-sm text-slate-600">Linha digitável:</p>
          <div className="flex gap-2">
            <input readOnly value={view.identificationField} aria-label="Linha digitável do boleto" className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800" />
            <CopyButton text={view.identificationField} className={secondaryButtonClass} doneMessage="Linha digitável copiada">
              Copiar
            </CopyButton>
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-600">A linha digitável ainda está sendo gerada. Abra o boleto em PDF para pagar.</p>
      )}
      {view.bankSlipUrl ? (
        <a href={view.bankSlipUrl} target="_blank" rel="noopener noreferrer" className={`${secondaryButtonClass} w-full`}>
          Abrir o boleto em PDF
        </a>
      ) : null}
      <button type="button" className="text-sm font-semibold text-teal-700 hover:underline" onClick={onBack}>
        Escolher outra forma de pagar
      </button>
    </section>
  );
}
