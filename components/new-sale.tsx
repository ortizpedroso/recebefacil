"use client";

import { Minus, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSaleAction, updateSaleAction } from "@/app/actions";
import { addPeriod, formatDateBR, type Periodicity } from "@/lib/dates";
import { PAYMENT_METHODS, PERIODS } from "@/lib/labels";
import { maskCpfOrCnpj, maskMoney, maskPhone } from "@/lib/masks";
import { cents, formatBRL, formatPercentBp, MAX_INSTALLMENTS, parsePercentBp, parseReais } from "@/lib/money";
import { itemsTotal, previewDraft, toSaleInput, trimmedRows, type Draft, type DraftLine, type PlanKind } from "@/lib/sale-draft";
import { FormError } from "./dialog";
import { buttonClass, Field, inputClass, ProductPhoto, secondaryButtonClass } from "./ui";

export type PickerClient = { id: string; name: string; phone: string };
export type PickerItem = { id: string; name: string; priceCents: number; kind: "produto" | "servico" | "mensalidade"; photoId: string | null; stock: number | null };

export type SaleToEdit = {
  id: string;
  clientId: string;
  soldOn: string;
  discountCents: number;
  plan: PlanKind;
  entryCents: number;
  count: number;
  interestBp: number;
  adjustBp: number;
  periodicity: Periodicity;
  firstDue: string;
  method: string;
  lines: DraftLine[];
};

const reais = (value: number) => (value > 0 ? formatBRL(cents(value)).replace(/^R\$\s?/, "") : "");

function moneyOrZero(text: string) {
  try {
    return text.trim() ? parseReais(text) : 0;
  } catch {
    return 0;
  }
}

function percentBp(text: string): number | null {
  try {
    return text.trim() ? parsePercentBp(text) : 0;
  } catch {
    return null;
  }
}

const PLANS: { id: PlanKind; title: string; hint: string }[] = [
  { id: "avista", title: "À vista", hint: "Um pagamento só" },
  { id: "parcelado", title: "Parcelado", hint: "Em várias vezes, com entrada se quiser" },
  { id: "mensalidade", title: "Mensalidade", hint: "Todo mês, até você encerrar" },
];


let customCounter = 0;

export function NewSale({ clients, catalog, today, initialClientId = "", sale }: { clients: PickerClient[]; catalog: PickerItem[]; today: string; initialClientId?: string; sale?: SaleToEdit }) {
  const router = useRouter();
  const soldOn = sale?.soldOn ?? today;
  const [clientId, setClientId] = useState(sale?.clientId ?? (clients.some((client) => client.id === initialClientId) ? initialClientId : ""));
  const [creating, setCreating] = useState(false);
  const [person, setPerson] = useState({ name: "", phone: "", document: "" });
  const [pickerText, setPickerText] = useState("");
  const [lines, setLines] = useState<DraftLine[]>(sale?.lines ?? []);
  const [custom, setCustom] = useState({ open: false, description: "", price: "" });
  const [plan, setPlan] = useState<PlanKind>(sale?.plan ?? "parcelado");
  const [count, setCount] = useState(String(sale?.count ?? 3));
  const [entry, setEntry] = useState(reais(sale?.entryCents ?? 0));
  const [firstDue, setFirstDue] = useState(sale?.firstDue ?? addPeriod(today, "mensal", 1));
  const [periodicity, setPeriodicity] = useState<Periodicity>(sale?.periodicity ?? "mensal");
  const [interest, setInterest] = useState(sale?.interestBp ? formatPercentBp(sale.interestBp) : "");
  const [adjust, setAdjust] = useState(sale?.adjustBp ? formatPercentBp(sale.adjustBp) : "");
  const [discount, setDiscount] = useState(reais(sale?.discountCents ?? 0));
  const [paidNow, setPaidNow] = useState(false);
  const [method, setMethod] = useState(sale?.method ?? "Pix");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const chosen = clients.find((client) => client.id === clientId);
  const interestBp = percentBp(interest);
  const adjustBp = percentBp(adjust);
  const countNumber = Number(count);

  const draft: Draft = {
    lines,
    discountCents: moneyOrZero(discount),
    plan,
    count: Number.isInteger(countNumber) ? countNumber : 0,
    entryCents: moneyOrZero(entry),
    firstDue,
    periodicity,
    interestBp: interestBp ?? 0,
    adjustBp: adjustBp ?? 0,
    paidNow,
    method,
    today: soldOn,
  };
  const preview = useMemo(() => previewDraft(draft), [lines, discount, plan, count, entry, firstDue, periodicity, interest, adjust, paidNow, method, soldOn]); // eslint-disable-line react-hooks/exhaustive-deps
  const percentError = interestBp === null || adjustBp === null ? "Escreva os percentuais assim: 1,5." : "";
  const countError = plan === "parcelado" && (draft.count < 2 || draft.count > MAX_INSTALLMENTS) ? `Parcelado vai de 2 a ${MAX_INSTALLMENTS} parcelas. Para um pagamento só, escolha À vista.` : "";
  const clientReady = Boolean(clientId) || (creating && person.name.trim().length >= 2 && person.phone.replace(/\D/g, "").length >= 10);
  const missing = lines.length === 0 ? "Falta adicionar um produto ou serviço." : !clientReady ? (creating ? "Falta o nome e o WhatsApp do cliente." : "Falta escolher o cliente.") : "";
  const canFinish = !missing && preview.ok && !percentError && !countError && !pending;

  const matches = useMemo(() => {
    const text = pickerText.trim().toLowerCase();
    return clients.filter((client) => !text || client.name.toLowerCase().includes(text) || client.phone.includes(text)).slice(0, 6);
  }, [clients, pickerText]);

  function add(item: PickerItem) {
    setLines((current) => {
      const found = current.find((line) => line.catalogItemId === item.id);
      if (found) return current.map((line) => (line === found ? { ...line, quantity: Math.min(line.quantity + 1, 999) } : line));
      return [...current, { key: item.id, catalogItemId: item.id, description: item.name, kind: item.kind === "produto" ? "produto" : "servico", quantity: 1, unitCents: item.priceCents }];
    });
    if (item.kind === "mensalidade") setPlan("mensalidade");
  }

  function step(key: string, delta: number) {
    setLines((current) => current.flatMap((line) => (line.key !== key ? [line] : line.quantity + delta <= 0 ? [] : [{ ...line, quantity: Math.min(line.quantity + delta, 999) }])));
  }

  function addCustom() {
    const price = moneyOrZero(custom.price);
    if (custom.description.trim().length < 2 || price <= 0) {
      setError("Para outro item, escreva o que é e o preço.");
      return;
    }
    setError("");
    customCounter += 1;
    setLines((current) => [...current, { key: `livre-${customCounter}`, catalogItemId: null, description: custom.description.trim(), kind: "servico", quantity: 1, unitCents: price }]);
    setCustom({ open: false, description: "", price: "" });
  }

  async function finish() {
    setError("");
    setPending(true);
    const input = toSaleInput(draft, clientId);
    const { clientId: _clientId, ...rest } = input;
    const payload = { ...rest, ...(creating && !clientId ? { newClient: { name: person.name.trim(), whatsapp: person.phone, document: person.document } } : { clientId }) };
    const result = sale ? await updateSaleAction(sale.id, payload) : await createSaleAction(payload);
    if (!result.ok) {
      setPending(false);
      setError(result.error);
      return;
    }
    router.push(sale ? `/vendas/${sale.id}` : `/vendas/${result.saleId}?nova=1`);
  }

  const rows = preview.ok ? trimmedRows(preview.rows) : null;
  const longPlan = plan === "parcelado" && (draft.count > 12 || draft.interestBp > 0 || draft.adjustBp > 0);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-start">
      <div className="space-y-4">
        <section className="space-y-3 rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
          <h2 className="font-bold text-slate-900">1. Cliente</h2>
          {creating ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Nome">
                  <input className={inputClass} placeholder="Ex.: Ana Souza" value={person.name} onChange={(event) => setPerson({ ...person, name: event.target.value })} autoComplete="off" />
                </Field>
                <Field label="WhatsApp">
                  <input className={inputClass} inputMode="tel" placeholder="(11) 90000-0000" value={person.phone} onChange={(event) => setPerson({ ...person, phone: maskPhone(event.target.value) })} />
                </Field>
                <Field label="CPF ou CNPJ" hint="opcional">
                  <input className={inputClass} inputMode="numeric" value={person.document} onChange={(event) => setPerson({ ...person, document: maskCpfOrCnpj(event.target.value) })} />
                </Field>
              </div>
              {clients.length > 0 ? (
                <button type="button" className="text-sm font-semibold text-teal-700 hover:underline" onClick={() => setCreating(false)}>
                  Escolher cliente já cadastrado
                </button>
              ) : null}
            </>
          ) : chosen ? (
            <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2.5">
              <span className="min-w-0">
                <span className="block truncate font-semibold text-slate-900">{chosen.name}</span>
                <span className="block text-sm text-slate-500">{chosen.phone || "Sem telefone"}</span>
              </span>
              {sale ? null : (
                <button type="button" className="shrink-0 text-sm font-semibold text-teal-700 hover:underline" onClick={() => setClientId("")}>
                  Trocar
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input className={`${inputClass} pl-9`} placeholder="Buscar cliente pelo nome ou telefone" aria-label="Buscar cliente" value={pickerText} onChange={(event) => setPickerText(event.target.value)} autoComplete="off" />
              </div>
              {clients.length > 0 ? (
                <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">
                  {matches.length === 0 ? <li className="px-3 py-2.5 text-sm text-slate-500">Ninguém com esse nome.</li> : null}
                  {matches.map((client) => (
                    <li key={client.id}>
                      <button type="button" className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-slate-50" onClick={() => setClientId(client.id)}>
                        <span className="truncate font-medium text-slate-900">{client.name}</span>
                        <span className="shrink-0 text-xs text-slate-500">{client.phone}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">Você ainda não tem clientes. Cadastre o primeiro aqui mesmo.</p>
              )}
              <button type="button" className="text-sm font-semibold text-teal-700 hover:underline" onClick={() => setCreating(true)}>
                + Cliente novo
              </button>
            </>
          )}
        </section>

        <section className="space-y-3 rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
          <h2 className="font-bold text-slate-900">2. O que está vendendo</h2>
          {catalog.length === 0 ? <p className="text-sm text-slate-500">Você ainda não cadastrou produtos. Use &ldquo;Outro item&rdquo; abaixo ou cadastre em Produtos.</p> : null}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {catalog.map((item) => {
              const line = lines.find((row) => row.catalogItemId === item.id);
              return (
                <button key={item.id} type="button" onClick={() => add(item)} aria-pressed={Boolean(line)} className={`relative flex flex-col overflow-hidden rounded-xl border bg-white text-left shadow-sm hover:border-slate-300 ${line ? "border-teal-700 ring-2 ring-teal-700" : "border-[#E2E8F0]"}`}>
                  {line ? <span className="absolute right-2 top-2 z-10 rounded-full bg-teal-700 px-2 text-sm font-bold text-white">{line.quantity}</span> : null}
                  <ProductPhoto name={item.name} photoId={item.photoId} />
                  <span className="flex flex-col gap-0.5 px-3 py-2.5">
                    <span className="truncate text-sm font-semibold text-slate-900">{item.name}</span>
                    <span className="text-[13px] text-slate-500">{formatBRL(cents(item.priceCents))}</span>
                  </span>
                </button>
              );
            })}
          </div>
          {custom.open ? (
            <div className="grid gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-[1fr_9rem_auto] sm:items-end">
              <Field label="O que é">
                <input className={inputClass} value={custom.description} onChange={(event) => setCustom({ ...custom, description: event.target.value })} placeholder="Ex.: Taxa de instalação" />
              </Field>
              <Field label="Preço">
                <input className={inputClass} inputMode="numeric" value={custom.price} onChange={(event) => setCustom({ ...custom, price: maskMoney(event.target.value) })} placeholder="0,00" />
              </Field>
              <div className="flex gap-2">
                <button type="button" className={buttonClass} onClick={addCustom}>
                  Adicionar
                </button>
                <button type="button" className={secondaryButtonClass} onClick={() => setCustom({ open: false, description: "", price: "" })}>
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="text-sm font-semibold text-teal-700 hover:underline" onClick={() => setCustom({ ...custom, open: true })}>
              + Outro item (sem cadastro)
            </button>
          )}
        </section>

        <section className="space-y-4 rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
          <h2 className="font-bold text-slate-900">3. Como vai receber</h2>
          <div className="grid gap-2 sm:grid-cols-3">
            {PLANS.map((option) => (
              <button key={option.id} type="button" aria-pressed={plan === option.id} onClick={() => setPlan(option.id)} className={`flex flex-col gap-0.5 rounded-xl border-[1.5px] p-3 text-left ${plan === option.id ? "border-teal-700 bg-teal-50" : "border-[#E2E8F0] bg-white hover:border-slate-300"}`}>
                <span className="font-bold text-slate-900">{option.title}</span>
                <span className="text-[13px] text-slate-500">{option.hint}</span>
              </button>
            ))}
          </div>

          {plan === "avista" && !sale ? (
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
                <input type="checkbox" className="h-4 w-4 accent-teal-700" checked={paidNow} onChange={(event) => setPaidNow(event.target.checked)} />
                Já recebi agora
              </label>
              {paidNow ? (
                <Field label="Como recebeu">
                  <select className={`${inputClass} sm:w-60`} value={method} onChange={(event) => setMethod(event.target.value)}>
                    {PAYMENT_METHODS.map((name) => (
                      <option key={name}>{name}</option>
                    ))}
                  </select>
                </Field>
              ) : null}
            </div>
          ) : null}

          {plan === "parcelado" ? (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Parcelas" hint={`2 a ${MAX_INSTALLMENTS}`}>
                  <input className={inputClass} type="number" inputMode="numeric" min={2} max={MAX_INSTALLMENTS} value={count} onChange={(event) => setCount(event.target.value)} />
                </Field>
                <Field label="Entrada" hint="opcional">
                  <input className={inputClass} inputMode="numeric" placeholder="0,00" value={entry} onChange={(event) => setEntry(maskMoney(event.target.value))} />
                </Field>
                <Field label="1º vencimento">
                  <input className={inputClass} type="date" value={firstDue} onChange={(event) => setFirstDue(event.target.value)} />
                </Field>
              </div>
              <details className="rounded-lg border border-slate-200" open={longPlan}>
                <summary className="cursor-pointer px-3 py-2.5 text-sm font-semibold text-slate-700">Financiamento longo (terreno, imóvel)</summary>
                <div className="grid gap-3 border-t border-slate-100 p-3 sm:grid-cols-2">
                  <Field label="Juros ao mês (%)" hint="Tabela Price">
                    <input className={inputClass} inputMode="decimal" placeholder="0,00" value={interest} onChange={(event) => setInterest(event.target.value)} />
                  </Field>
                  <Field label="Reajuste anual (%)" hint="sobe as parcelas a cada 12">
                    <input className={inputClass} inputMode="decimal" placeholder="0,00" value={adjust} onChange={(event) => setAdjust(event.target.value)} />
                  </Field>
                </div>
              </details>
            </div>
          ) : null}

          {plan === "mensalidade" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Primeira cobrança">
                <input className={inputClass} type="date" value={firstDue} onChange={(event) => setFirstDue(event.target.value)} />
              </Field>
              <Field label="Repete">
                <select className={inputClass} value={periodicity} onChange={(event) => setPeriodicity(event.target.value as Periodicity)}>
                  {PERIODS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          ) : null}

          <details className="rounded-lg border border-slate-200" open={draft.discountCents > 0}>
            <summary className="cursor-pointer px-3 py-2.5 text-sm font-semibold text-slate-700">Dar desconto</summary>
            <div className="border-t border-slate-100 p-3 sm:max-w-xs">
              <Field label="Desconto em reais" hint="opcional">
                <input className={inputClass} inputMode="numeric" placeholder="0,00" value={discount} onChange={(event) => setDiscount(maskMoney(event.target.value))} />
              </Field>
            </div>
          </details>
        </section>
      </div>

      <aside className="space-y-3 rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm lg:sticky lg:top-20">
        <h2 className="font-bold text-slate-900">Resumo</h2>
        {lines.length === 0 ? <p className="text-sm text-slate-500">Toque nos produtos para adicionar.</p> : null}
        <ul className="space-y-2">
          {lines.map((line) => (
            <li key={line.key} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate">{line.description}</span>
              <span className="flex shrink-0 items-center gap-1.5">
                <button type="button" className="rounded-md border border-slate-200 p-1 hover:bg-slate-50" aria-label={`Menos ${line.description}`} onClick={() => step(line.key, -1)}>
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <b className="w-5 text-center tabular-nums">{line.quantity}</b>
                <button type="button" className="rounded-md border border-slate-200 p-1 hover:bg-slate-50" aria-label={`Mais ${line.description}`} onClick={() => step(line.key, 1)}>
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </span>
            </li>
          ))}
        </ul>
        <div>
          <span className="text-sm text-slate-500">Total</span>
          <p className="text-3xl font-bold tabular-nums text-slate-900">{formatBRL(cents(Math.max(itemsTotal(lines) - draft.discountCents, 0)))}</p>
          {draft.discountCents > 0 ? <p className="text-xs text-slate-500">Com desconto de {formatBRL(cents(draft.discountCents))}</p> : null}
        </div>

        {rows && preview.ok ? (
          <div className="space-y-1.5 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{preview.recurring ? "Cobranças" : plan === "avista" ? "Pagamento" : "Parcelas"}</p>
            {rows.shown.map((row) => (
              <div key={`${row.number}-${row.dueOn}`} className="flex justify-between gap-2 border-b border-dashed border-slate-200 pb-1.5">
                <span className="min-w-0 truncate">
                  {row.label} · {row.label === "Entrada" ? "hoje" : formatDateBR(row.dueOn)}
                </span>
                <b className="tabular-nums">{formatBRL(row.amountCents)}</b>
              </div>
            ))}
            {rows.hidden > 0 ? <p className="py-0.5 text-center text-xs text-slate-500">… mais {rows.hidden} parcelas …</p> : null}
            {rows.last ? (
              <div className="flex justify-between gap-2 border-b border-dashed border-slate-200 pb-1.5">
                <span className="min-w-0 truncate">
                  {rows.last.label} · {formatDateBR(rows.last.dueOn)}
                </span>
                <b className="tabular-nums">{formatBRL(rows.last.amountCents)}</b>
              </div>
            ) : null}
            {preview.recurring ? <p className="text-xs text-slate-500">E assim por diante, até você encerrar a mensalidade.</p> : null}
            {!preview.recurring && preview.payTotalCents !== preview.totalCents ? (
              <p className="flex justify-between gap-2 pt-1 font-semibold">
                <span>Total a pagar, com juros</span>
                <span className="tabular-nums">{formatBRL(cents(preview.payTotalCents))}</span>
              </p>
            ) : null}
          </div>
        ) : null}
        {!preview.ok && preview.error ? <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{preview.error}</p> : null}
        {percentError || countError ? <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{percentError || countError}</p> : null}
        <FormError message={error} />
        <button type="button" className={`${buttonClass} w-full py-3`} disabled={!canFinish} onClick={finish}>
          {pending ? "Salvando..." : sale ? "Salvar alterações" : "Concluir venda"}
        </button>
        {missing ? <p className="text-xs text-slate-500">{missing}</p> : null}
      </aside>
    </div>
  );
}
