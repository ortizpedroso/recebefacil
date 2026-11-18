"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClientAction, updateClientAction } from "@/app/actions";
import { lookupCep } from "@/lib/cep";
import { maskCep, maskCpfOrCnpj, maskPhone, maskUf } from "@/lib/masks";
import { FormError, Modal } from "./dialog";
import { toast } from "./toast";
import { buttonClass, Field, inputClass, secondaryButtonClass, smallButtonClass } from "./ui";

export type ClientData = {
  id: string;
  name: string;
  whatsapp: string;
  document: string;
  email: string;
  zip: string;
  state: string;
  city: string;
  district: string;
  street: string;
  number: string;
  complement: string;
  notes: string;
};

const EMPTY: Omit<ClientData, "id"> = { name: "", whatsapp: "", document: "", email: "", zip: "", state: "", city: "", district: "", street: "", number: "", complement: "", notes: "" };

function ClientForm({ client, onDone }: { client?: ClientData; onDone: () => void }) {
  const router = useRouter();
  const [form, setForm] = useState<Omit<ClientData, "id">>(
    client ? { ...client, whatsapp: maskPhone(client.whatsapp), document: maskCpfOrCnpj(client.document), zip: maskCep(client.zip) } : EMPTY,
  );
  const [cepNote, setCepNote] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const set = (field: keyof typeof form, value: string) => setForm((current) => ({ ...current, [field]: value }));
  const hasMore = Boolean(client && (client.document || client.email || client.zip || client.street || client.notes));

  async function fillCep(value: string) {
    const masked = maskCep(value);
    set("zip", masked);
    if (masked.replace(/\D/g, "").length !== 8) {
      setCepNote("");
      return;
    }
    setCepNote("Buscando o endereço...");
    try {
      const address = await lookupCep(masked);
      if (!address) {
        setCepNote("CEP não encontrado. Preencha o endereço à mão.");
        return;
      }
      setForm((current) => ({ ...current, zip: masked, street: address.street, district: address.district, city: address.city, state: address.state, complement: address.complement || current.complement }));
      setCepNote("Endereço preenchido pelo CEP.");
    } catch {
      setCepNote("Não deu para consultar o CEP agora. Preencha o endereço à mão.");
    }
  }

  return (
    <form
      className="space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError("");
        const result = client ? await updateClientAction(client.id, form) : await createClientAction(form);
        setPending(false);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        toast(client ? "Cliente atualizado." : "Cliente cadastrado.");
        onDone();
        router.refresh();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome">
          <input className={inputClass} placeholder="Ex.: Ana Souza" value={form.name} onChange={(event) => set("name", event.target.value)} required autoComplete="off" />
        </Field>
        <Field label="WhatsApp">
          <input className={inputClass} inputMode="tel" placeholder="(11) 90000-0000" value={form.whatsapp} onChange={(event) => set("whatsapp", maskPhone(event.target.value))} required />
        </Field>
      </div>
      <details className="rounded-lg border border-slate-200" open={hasMore}>
        <summary className="cursor-pointer px-3 py-2.5 text-sm font-semibold text-slate-700">Mais dados (CPF ou CNPJ, e-mail, endereço)</summary>
        <div className="grid gap-3 border-t border-slate-100 p-3 sm:grid-cols-2">
          <Field label="CPF ou CNPJ" hint="opcional">
            <input className={inputClass} inputMode="numeric" value={form.document} onChange={(event) => set("document", maskCpfOrCnpj(event.target.value))} />
          </Field>
          <Field label="E-mail" hint="opcional">
            <input className={inputClass} type="email" value={form.email} onChange={(event) => set("email", event.target.value)} />
          </Field>
          <Field label="CEP" hint="preenche o endereço">
            <input className={inputClass} inputMode="numeric" placeholder="00000-000" value={form.zip} onChange={(event) => void fillCep(event.target.value)} />
          </Field>
          <p className="self-end pb-2 text-sm text-slate-500">{cepNote}</p>
          <Field label="Rua">
            <input className={inputClass} value={form.street} onChange={(event) => set("street", event.target.value)} />
          </Field>
          <Field label="Número">
            <input className={inputClass} value={form.number} onChange={(event) => set("number", event.target.value)} />
          </Field>
          <Field label="Bairro">
            <input className={inputClass} value={form.district} onChange={(event) => set("district", event.target.value)} />
          </Field>
          <Field label="Complemento">
            <input className={inputClass} value={form.complement} onChange={(event) => set("complement", event.target.value)} />
          </Field>
          <Field label="Cidade">
            <input className={inputClass} value={form.city} onChange={(event) => set("city", event.target.value)} />
          </Field>
          <Field label="UF">
            <input className={inputClass} maxLength={2} value={form.state} onChange={(event) => set("state", maskUf(event.target.value))} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Observações" hint="opcional">
              <textarea className={inputClass} rows={2} value={form.notes} onChange={(event) => set("notes", event.target.value)} />
            </Field>
          </div>
        </div>
      </details>
      <FormError message={error} />
      <div className="flex justify-end gap-2">
        <button type="button" className={secondaryButtonClass} onClick={onDone}>
          Cancelar
        </button>
        <button type="submit" className={buttonClass} disabled={pending}>
          {pending ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </form>
  );
}

export function NewClientButton({ first = false }: { first?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={buttonClass} onClick={() => setOpen(true)}>
        {first ? "Cadastrar o primeiro cliente" : "+ Novo cliente"}
      </button>
      <Modal open={open} onOpenChange={setOpen} title="Novo cliente" description="Só o nome e o WhatsApp são obrigatórios." wide>
        {open ? <ClientForm onDone={() => setOpen(false)} /> : null}
      </Modal>
    </>
  );
}

export function EditClientButton({ client }: { client: ClientData }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={smallButtonClass} onClick={() => setOpen(true)}>
        Editar
      </button>
      <Modal open={open} onOpenChange={setOpen} title="Editar cliente" wide>
        {open ? <ClientForm client={client} onDone={() => setOpen(false)} /> : null}
      </Modal>
    </>
  );
}
