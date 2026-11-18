"use client";

import { MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createChargeAction } from "@/app/actions";
import { PAYMENT_METHODS } from "@/lib/labels";
import { maskMoney } from "@/lib/masks";
import { FormError, Modal } from "./dialog";
import { Menu, MenuItem } from "./menu";
import { toast } from "./toast";
import { buttonClass, Field, inputClass, secondaryButtonClass } from "./ui";

function ChargeForm({ clients, today, onDone }: { clients: { id: string; name: string }[]; today: string; onDone: () => void }) {
  const router = useRouter();
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [dueOn, setDueOn] = useState(today);
  const [method, setMethod] = useState<string>("Pix");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  if (clients.length === 0) {
    return <p className="text-sm text-slate-600">Cadastre um cliente antes de criar uma cobrança.</p>;
  }
  return (
    <form
      className="space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        const result = await createChargeAction({ clientId, amount, dueOn, method });
        setPending(false);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        toast("Cobrança criada.");
        onDone();
        router.refresh();
      }}
    >
      <Field label="Cliente">
        <select className={inputClass} value={clientId} onChange={(event) => setClientId(event.target.value)}>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Valor">
          <input className={inputClass} inputMode="numeric" placeholder="0,00" value={amount} onChange={(event) => setAmount(maskMoney(event.target.value))} required />
        </Field>
        <Field label="Vencimento">
          <input className={inputClass} type="date" value={dueOn} onChange={(event) => setDueOn(event.target.value)} required />
        </Field>
      </div>
      <Field label="Forma de pagamento">
        <select className={inputClass} value={method} onChange={(event) => setMethod(event.target.value)}>
          {PAYMENT_METHODS.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
      </Field>
      <FormError message={error} />
      <div className="flex justify-end gap-2">
        <button type="button" className={secondaryButtonClass} onClick={onDone}>
          Cancelar
        </button>
        <button type="submit" className={buttonClass} disabled={pending}>
          Criar cobrança
        </button>
      </div>
    </form>
  );
}

export function ChargeMenu({ clients, today }: { clients: { id: string; name: string }[]; today: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Menu label="Mais ações" className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50" trigger={<MoreHorizontal className="h-4 w-4" />}>
        <MenuItem onSelect={() => setOpen(true)}>Nova cobrança avulsa</MenuItem>
      </Menu>
      <Modal open={open} onOpenChange={setOpen} title="Nova cobrança avulsa" description="Uma cobrança que não vem de uma venda.">
        <ChargeForm clients={clients} today={today} onDone={() => setOpen(false)} />
      </Modal>
    </>
  );
}
