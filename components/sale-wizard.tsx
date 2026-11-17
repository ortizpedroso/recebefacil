"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSaleAction, updateSaleAction } from "@/app/actions";
import { parseReais, formatBRL, cents, formatPercentBp, parsePercentBp, MAX_INSTALLMENTS } from "@/lib/money";
import { maskMoney } from "@/lib/masks";
import { buttonClass, Field, inputClass } from "./ui";

type ClientOption = { id: string; name: string };
type ItemOption = { id: string; name: string; priceCents: number; kind: "produto" | "servico" };

type Line = { catalogItemId: string | null; description: string; kind: "produto" | "servico"; quantity: number; unitCents: number };

type SaleForEdit = {
  id: string;
  clientId: string;
  soldOn: string;
  notes: string;
  discountCents: number;
  mode: "avista" | "parcelado" | "recorrente";
  entryCents: number;
  installmentCount: number;
  interestMonthlyBp: number;
  adjustYearlyBp: number;
  periodicity: "semanal" | "quinzenal" | "mensal" | "trimestral" | "semestral" | "anual";
  makeContract: boolean;
  firstDue: string;
  method: string;
  lines: Line[];
};

function moneyInput(value: number) {
  return formatBRL(cents(value)).replace(/^R\$\s?/, "");
}

export function SaleWizard({ clients, catalog, today, sale }: { clients: ClientOption[]; catalog: ItemOption[]; today: string; sale?: SaleForEdit }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [clientId, setClientId] = useState(sale?.clientId ?? clients[0]?.id ?? "");
  const [lines, setLines] = useState<Line[]>(sale?.lines ?? []);
  const [discount, setDiscount] = useState(sale ? moneyInput(sale.discountCents) : "0,00");
  const [mode, setMode] = useState<"avista" | "parcelado" | "recorrente">(sale?.mode ?? "parcelado");
  const [entry, setEntry] = useState(sale ? moneyInput(sale.entryCents) : "0,00");
  const [count, setCount] = useState(sale?.installmentCount ?? 4);
  const [interest, setInterest] = useState(formatPercentBp(sale?.interestMonthlyBp ?? 0));
  const [adjust, setAdjust] = useState(formatPercentBp(sale?.adjustYearlyBp ?? 0));
  const [makeContract, setMakeContract] = useState(sale?.makeContract ?? false);
  const [firstDue, setFirstDue] = useState(sale?.firstDue ?? today);
  const [method, setMethod] = useState(sale?.method ?? "Pix");
  const [custom, setCustom] = useState({ description: "", quantity: 1, price: "" });

  const total = useMemo(() => lines.reduce((sum, line) => sum + line.quantity * line.unitCents, 0), [lines]);

  function addCatalog(id: string) {
    const item = catalog.find((row) => row.id === id);
    if (!item) return;
    setLines((current) => [...current, { catalogItemId: item.id, description: item.name, kind: item.kind, quantity: 1, unitCents: item.priceCents }]);
  }

  function addCustom() {
    try {
      const unitCents = parseReais(custom.price);
      if (!custom.description.trim()) return;
      setLines((current) => [...current, { catalogItemId: null, description: custom.description.trim(), kind: "servico", quantity: custom.quantity, unitCents }]);
      setCustom({ description: "", quantity: 1, price: "" });
    } catch {
      setError("Informe o valor do item avulso.");
    }
  }

  async function confirm() {
    setError("");
    let interestMonthlyBp = 0;
    let adjustYearlyBp = 0;
    try {
      interestMonthlyBp = mode === "parcelado" ? parsePercentBp(interest || "0") : 0;
      adjustYearlyBp = mode === "parcelado" ? parsePercentBp(adjust || "0") : 0;
    } catch {
      setError("Informe juros e reajuste como percentual, por exemplo 1,5.");
      return;
    }
    const payload = {
      clientId,
      soldOn: sale?.soldOn ?? today,
      discount: discount || "0",
      notes: sale?.notes ?? "",
      mode,
      entry: mode === "parcelado" ? entry || "0" : "0",
      installmentCount: mode === "avista" ? 1 : count,
      firstDue,
      periodicity: sale?.periodicity ?? "mensal",
      interestMonthlyBp,
      adjustYearlyBp,
      method,
      makeContract,
      items: lines,
    };
    const result = sale ? await updateSaleAction(sale.id, payload) : await createSaleAction(payload);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/vendas");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[#64748B]">Etapa {step} de 4</p>
      {step === 1 ? (
        <Field label="Cliente">
          <select className={inputClass} value={clientId} onChange={(event) => setClientId(event.target.value)}>
            {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
          </select>
        </Field>
      ) : null}
      {step === 2 ? (
        <div className="space-y-3">
          <Field label="Catálogo">
            <select className={inputClass} defaultValue="" onChange={(event) => addCatalog(event.target.value)}>
              <option value="">Adicionar item cadastrado</option>
              {catalog.filter((item) => item).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </Field>
          <div className="grid gap-2 md:grid-cols-3">
            <input className={inputClass} placeholder="Item avulso" value={custom.description} onChange={(event) => setCustom({ ...custom, description: event.target.value })} />
            <input className={inputClass} type="number" min={1} value={custom.quantity} onChange={(event) => setCustom({ ...custom, quantity: Number(event.target.value) })} />
            <input className={inputClass} inputMode="numeric" placeholder="0,00" value={custom.price} onChange={(event) => setCustom({ ...custom, price: maskMoney(event.target.value) })} />
          </div>
          <button type="button" className={buttonClass} onClick={addCustom}>Adicionar avulso</button>
          <ul className="text-sm">
            {lines.map((line, index) => (
              <li key={`${line.description}-${index}`} className="flex justify-between border-b border-[#E2E8F0] py-2">
                <span>{line.quantity} × {line.description}</span>
                <span className="flex items-center gap-3">
                  <span>{formatBRL(cents(line.quantity * line.unitCents))}</span>
                  <button type="button" className="text-xs text-[#EF4444]" onClick={() => setLines((current) => current.filter((_, i) => i !== index))}>remover</button>
                </span>
              </li>
            ))}
          </ul>
          <p className="font-medium">Itens {formatBRL(cents(total))}</p>
        </div>
      ) : null}
      {step === 3 ? (
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Recebimento">
            <select className={inputClass} value={mode} onChange={(event) => setMode(event.target.value as typeof mode)}>
              <option value="avista">À vista</option>
              <option value="parcelado">Parcelado</option>
              <option value="recorrente">Recorrente</option>
            </select>
          </Field>
          <Field label="Forma">
            <select className={inputClass} value={method} onChange={(event) => setMethod(event.target.value)}>
              <option>Pix</option>
              <option>Boleto</option>
              <option>Cartão de crédito</option>
              <option>Transferência</option>
            </select>
          </Field>
          <Field label="Desconto"><input className={inputClass} inputMode="numeric" placeholder="0,00" value={discount} onChange={(event) => setDiscount(maskMoney(event.target.value) || "0,00")} /></Field>
          {mode === "parcelado" ? <Field label="Entrada"><input className={inputClass} inputMode="numeric" placeholder="0,00" value={entry} onChange={(event) => setEntry(maskMoney(event.target.value) || "0,00")} /></Field> : null}
          {mode !== "avista" ? <Field label="Parcelas ou ciclos"><input className={inputClass} type="number" min={1} max={MAX_INSTALLMENTS} value={count} onChange={(event) => setCount(Number(event.target.value))} /></Field> : null}
          {mode === "parcelado" ? <Field label="Juros do financiamento (% ao mês)"><input className={inputClass} inputMode="decimal" placeholder="0,00" value={interest} onChange={(event) => setInterest(event.target.value)} /></Field> : null}
          {mode === "parcelado" ? <Field label="Reajuste anual das parcelas (%)"><input className={inputClass} inputMode="decimal" placeholder="0,00" value={adjust} onChange={(event) => setAdjust(event.target.value)} /></Field> : null}
          <Field label="Primeiro vencimento"><input className={inputClass} type="date" value={firstDue} onChange={(event) => setFirstDue(event.target.value)} /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={makeContract} onChange={(event) => setMakeContract(event.target.checked)} />Gerar contrato</label>
        </div>
      ) : null}
      {step === 4 ? (
        <div className="text-sm">
          <p>Cliente selecionado e {lines.length} item(ns).</p>
          <p className="mt-2">Sem juros nem reajuste, o centavo que sobra entra na primeira parcela e a soma fecha o total. Com juros, as parcelas seguem a tabela Price.</p>
        </div>
      ) : null}
      {error ? <p className="text-sm text-[#EF4444]">{error}</p> : null}
      <div className="flex gap-2">
        {step > 1 ? <button type="button" className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-sm" onClick={() => setStep(step - 1)}>Voltar</button> : null}
        {step < 4 ? <button type="button" className={buttonClass} onClick={() => setStep(step + 1)} disabled={step === 2 && lines.length === 0}>Avançar</button> : null}
        {step === 4 ? <button type="button" className={buttonClass} onClick={confirm}>{sale ? "Salvar alterações" : "Confirmar venda"}</button> : null}
      </div>
    </div>
  );
}
