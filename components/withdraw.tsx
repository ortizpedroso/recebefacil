"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { withdrawAction } from "@/app/actions";
import { quoteFees, type PayMethod } from "@/lib/fees";
import { parseReais } from "@/lib/money";
import { FormError, Modal } from "./dialog";
import { toast } from "./toast";
import { buttonClass, Field, inputClass, money, secondaryButtonClass } from "./ui";

function centsOf(text: string): number | null {
  try {
    const value = parseReais(text);
    return value > 0 ? value : null;
  } catch {
    return null;
  }
}

export function WithdrawForm({ balanceCents, feeCents, defaultPixKey }: { balanceCents: number; feeCents: number; defaultPixKey: string }) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [pixKey, setPixKey] = useState(defaultPixKey);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const value = centsOf(amount);
  const fits = value !== null && value + feeCents <= balanceCents;

  async function send() {
    setPending(true);
    setError("");
    const result = await withdrawAction(amount, pixKey);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setConfirming(false);
    setAmount("");
    toast("Saque pedido. O Pix costuma cair em minutos.");
    router.refresh();
  }

  return (
    <form
      className="grid gap-3 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        setError("");
        setConfirming(true);
      }}
    >
      <Field label="Valor" hint={`até ${money(Math.max(0, balanceCents - feeCents))}`}>
        <input className={inputClass} inputMode="decimal" placeholder="150,00" value={amount} onChange={(event) => setAmount(event.target.value)} required />
      </Field>
      <Field label="Chave Pix de destino" hint="CPF, CNPJ, e-mail, celular ou aleatória">
        <input className={inputClass} value={pixKey} onChange={(event) => setPixKey(event.target.value)} required />
      </Field>
      <button type="submit" className={buttonClass} disabled={!fits || pixKey.trim().length < 5}>
        Sacar
      </button>
      {value !== null && !fits ? <p className="text-sm text-rose-700 sm:col-span-3">O valor com a tarifa passa do saldo disponível.</p> : null}
      <Modal open={confirming} onOpenChange={setConfirming} title="Confirmar saque">
        <div className="space-y-4">
          <dl className="divide-y divide-slate-100 rounded-xl border border-[#E2E8F0] text-sm">
            <div className="flex justify-between px-3 py-2">
              <dt className="text-slate-600">Você recebe por Pix</dt>
              <dd className="font-semibold tabular-nums text-slate-900">{money(value ?? 0)}</dd>
            </div>
            <div className="flex justify-between px-3 py-2">
              <dt className="text-slate-600">Tarifa do saque (Asaas)</dt>
              <dd className="tabular-nums text-slate-900">{feeCents === 0 ? "Grátis" : money(feeCents)}</dd>
            </div>
            <div className="flex justify-between px-3 py-2">
              <dt className="text-slate-600">Sai do seu saldo</dt>
              <dd className="font-semibold tabular-nums text-slate-900">{money((value ?? 0) + feeCents)}</dd>
            </div>
            <div className="flex justify-between gap-3 px-3 py-2">
              <dt className="text-slate-600">Destino</dt>
              <dd className="truncate text-slate-900">{pixKey}</dd>
            </div>
          </dl>
          <p className="text-[13px] text-slate-500">Confira a chave. Um Pix enviado não volta sozinho.</p>
          <FormError message={error} />
          <div className="flex justify-end gap-2">
            <button type="button" className={secondaryButtonClass} onClick={() => setConfirming(false)} disabled={pending}>
              Voltar
            </button>
            <button type="button" className={buttonClass} onClick={send} disabled={pending}>
              {pending ? "Enviando..." : "Confirmar saque"}
            </button>
          </div>
        </div>
      </Modal>
    </form>
  );
}

const METHODS: { value: PayMethod; label: string }[] = [
  { value: "pix", label: "Pix" },
  { value: "boleto", label: "Boleto" },
  { value: "cartao", label: "Cartão" },
];

// Simulador: quanto de cada venda chega na sua conta, com cada taxa numa linha.
export function FeeSimulator({ platformFeeBp }: { platformFeeBp: number }) {
  const [amount, setAmount] = useState("1.000,00");
  const [method, setMethod] = useState<PayMethod>("pix");
  const [installments, setInstallments] = useState(1);
  const [anticipate, setAnticipate] = useState(false);
  const gross = centsOf(amount);
  const quote = useMemo(() => (gross === null ? null : quoteFees({ grossCents: gross, method, installments, anticipate, platformFeeBp })), [gross, method, installments, anticipate, platformFeeBp]);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="grid gap-3">
        <Field label="Valor da venda">
          <input className={inputClass} inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
        </Field>
        <Field label="Como o cliente paga">
          <select className={inputClass} value={method} onChange={(event) => setMethod(event.target.value as PayMethod)}>
            {METHODS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        {method === "cartao" ? (
          <>
            <Field label="Parcelas no cartão">
              <select className={inputClass} value={installments} onChange={(event) => setInstallments(Number(event.target.value))}>
                {Array.from({ length: 21 }, (_, index) => index + 1).map((count) => (
                  <option key={count} value={count}>
                    {count === 1 ? "À vista" : `${count}x`}
                  </option>
                ))}
              </select>
            </Field>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" className="accent-teal-700" checked={anticipate} onChange={(event) => setAnticipate(event.target.checked)} />
              Antecipar (receber o valor todo de uma vez, em vez de parcela a parcela)
            </label>
          </>
        ) : null}
      </div>
      <dl className="divide-y divide-slate-100 self-start rounded-xl border border-[#E2E8F0] text-sm">
        <div className="flex justify-between px-3 py-2">
          <dt className="text-slate-600">Valor pago pelo cliente</dt>
          <dd className="tabular-nums text-slate-900">{money(quote?.grossCents ?? 0)}</dd>
        </div>
        {(quote?.lines ?? []).map((line) => (
          <div key={line.label} className="flex justify-between px-3 py-2">
            <dt className="text-slate-600">{line.label}</dt>
            <dd className="tabular-nums text-rose-700">− {money(line.cents)}</dd>
          </div>
        ))}
        <div className="flex justify-between bg-slate-50 px-3 py-2">
          <dt className="font-semibold text-slate-900">Chega na sua conta</dt>
          <dd className="font-bold tabular-nums text-slate-900">{money(quote?.netCents ?? 0)}</dd>
        </div>
      </dl>
    </div>
  );
}
