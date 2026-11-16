"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSaleAction } from "@/app/actions";
import { parseReais, formatBRL, cents } from "@/lib/money";
import { buttonClass, Field, inputClass } from "./ui";

type ClientOption = { id: string; name: string };
type ItemOption = { id: string; name: string; priceCents: number; kind: "produto" | "servico" };

type Line = { catalogItemId: string | null; description: string; kind: "produto" | "servico"; quantity: number; unitCents: number };

export function SaleWizard({ clients, catalog, today }: { clients: ClientOption[]; catalog: ItemOption[]; today: string }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [lines, setLines] = useState<Line[]>([]);
  const [discount, setDiscount] = useState("0,00");
  const [mode, setMode] = useState<"avista" | "parcelado" | "recorrente">("parcelado");
  const [entry, setEntry] = useState("0,00");
  const [count, setCount] = useState(4);
  const [firstDue, setFirstDue] = useState(today);
  const [method, setMethod] = useState("Pix");
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
    const result = await createSaleAction({
      clientId,
      soldOn: today,
      discount: discount || "0",
      notes: "",
      mode,
      entry: mode === "parcelado" ? entry || "0" : "0",
      installmentCount: mode === "avista" ? 1 : count,
      firstDue,
      periodicity: "mensal",
      method,
      makeContract: mode !== "avista",
      items: lines,
    });
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
            <input className={inputClass} placeholder="Valor" value={custom.price} onChange={(event) => setCustom({ ...custom, price: event.target.value })} />
          </div>
          <button type="button" className={buttonClass} onClick={addCustom}>Adicionar avulso</button>
          <ul className="text-sm">
            {lines.map((line, index) => (
              <li key={`${line.description}-${index}`} className="flex justify-between border-b border-[#E2E8F0] py-2">
                <span>{line.quantity} × {line.description}</span>
                <span>{formatBRL(cents(line.quantity * line.unitCents))}</span>
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
          <Field label="Desconto"><input className={inputClass} value={discount} onChange={(event) => setDiscount(event.target.value)} /></Field>
          {mode === "parcelado" ? <Field label="Entrada"><input className={inputClass} value={entry} onChange={(event) => setEntry(event.target.value)} /></Field> : null}
          {mode !== "avista" ? <Field label="Parcelas ou ciclos"><input className={inputClass} type="number" min={1} max={60} value={count} onChange={(event) => setCount(Number(event.target.value))} /></Field> : null}
          <Field label="Primeiro vencimento"><input className={inputClass} type="date" value={firstDue} onChange={(event) => setFirstDue(event.target.value)} /></Field>
        </div>
      ) : null}
      {step === 4 ? (
        <div className="text-sm">
          <p>Cliente selecionado e {lines.length} item(ns).</p>
          <p className="mt-2">O centavo que sobra na divisão entra na primeira parcela. A soma fecha o total.</p>
        </div>
      ) : null}
      {error ? <p className="text-sm text-[#EF4444]">{error}</p> : null}
      <div className="flex gap-2">
        {step > 1 ? <button type="button" className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-sm" onClick={() => setStep(step - 1)}>Voltar</button> : null}
        {step < 4 ? <button type="button" className={buttonClass} onClick={() => setStep(step + 1)} disabled={step === 2 && lines.length === 0}>Avançar</button> : null}
        {step === 4 ? <button type="button" className={buttonClass} onClick={confirm}>Confirmar venda</button> : null}
      </div>
    </div>
  );
}
