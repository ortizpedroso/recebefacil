"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { clientSchema, catalogSchema } from "@/lib/schemas";
import { createCatalogAction, createClientAction, payAction, updateCatalogAction, updateClientAction } from "@/app/actions";
import { buttonClass, Field, inputClass } from "./ui";

export function ClientForm({
  clientId,
  initial,
}: {
  clientId?: string;
  initial?: {
    kind: "pf" | "pj";
    name: string;
    document: string;
    email: string;
    phone: string;
    whatsapp: string;
    zip: string;
    state: string;
    city: string;
    district: string;
    street: string;
    number: string;
    complement: string;
    notes: string;
  };
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const form = useForm({
    resolver: zodResolver(clientSchema),
    defaultValues: initial ?? { kind: "pf" as const, name: "", document: "", email: "", phone: "", whatsapp: "", zip: "", state: "", city: "", district: "", street: "", number: "", complement: "", notes: "" },
  });
  return (
    <form
      className="grid gap-3 md:grid-cols-2"
      onSubmit={form.handleSubmit(async (values) => {
        const result = clientId ? await updateClientAction({ ...values, id: clientId }) : await createClientAction(values);
        setMessage(result.ok ? (clientId ? "Cliente atualizado." : "Cliente cadastrado.") : result.error);
        if (result.ok) {
          if (!clientId) form.reset();
          router.refresh();
        }
      })}
    >
      <Field label="Tipo">
        <select className={inputClass} {...form.register("kind")}>
          <option value="pf">Pessoa física</option>
          <option value="pj">Pessoa jurídica</option>
        </select>
      </Field>
      <Field label="Nome"><input className={inputClass} {...form.register("name")} /></Field>
      <Field label="CPF ou CNPJ"><input className={inputClass} {...form.register("document")} /></Field>
      <Field label="Telefone"><input className={inputClass} {...form.register("phone")} /></Field>
      <Field label="WhatsApp"><input className={inputClass} {...form.register("whatsapp")} /></Field>
      <Field label="E-mail"><input className={inputClass} {...form.register("email")} /></Field>
      <Field label="CEP"><input className={inputClass} {...form.register("zip")} /></Field>
      <Field label="UF"><input className={inputClass} maxLength={2} {...form.register("state")} /></Field>
      <Field label="Cidade"><input className={inputClass} {...form.register("city")} /></Field>
      <Field label="Bairro"><input className={inputClass} {...form.register("district")} /></Field>
      <Field label="Rua"><input className={inputClass} {...form.register("street")} /></Field>
      <Field label="Número"><input className={inputClass} {...form.register("number")} /></Field>
      <div className="md:col-span-2 flex items-center gap-3">
        <button className={buttonClass} type="submit">{clientId ? "Salvar cliente" : "Cadastrar cliente"}</button>
        {message ? <span className="text-sm text-[#64748B]">{message}</span> : null}
        {form.formState.errors.email?.message ? <span className="text-sm text-[#EF4444]">{form.formState.errors.email.message}</span> : null}
        {form.formState.errors.document?.message ? <span className="text-sm text-[#EF4444]">{form.formState.errors.document.message}</span> : null}
      </div>
    </form>
  );
}

export function CatalogForm({
  itemId,
  initial,
}: {
  itemId?: string;
  initial?: { kind: "produto" | "servico"; name: string; description: string; category: string; sku: string; price: string; billing: "pontual" | "recorrente" };
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const form = useForm({
    resolver: zodResolver(catalogSchema),
    defaultValues: initial ?? { kind: "produto" as const, name: "", description: "", category: "", sku: "", price: "", billing: "pontual" as const },
  });
  return (
    <form
      className="grid gap-3 md:grid-cols-2"
      onSubmit={form.handleSubmit(async (values) => {
        const result = itemId ? await updateCatalogAction(itemId, values) : await createCatalogAction(values);
        setMessage(result.ok ? (itemId ? "Item atualizado." : "Item cadastrado.") : result.error);
        if (result.ok) {
          if (!itemId) form.reset();
          router.refresh();
        }
      })}
    >
      <Field label="Tipo">
        <select className={inputClass} {...form.register("kind")}>
          <option value="produto">Produto</option>
          <option value="servico">Serviço</option>
        </select>
      </Field>
      <Field label="Nome"><input className={inputClass} {...form.register("name")} /></Field>
      <Field label="Categoria"><input className={inputClass} {...form.register("category")} /></Field>
      <Field label="Preço"><input className={inputClass} placeholder="1500,00" {...form.register("price")} /></Field>
      <Field label="Cobrança">
        <select className={inputClass} {...form.register("billing")}>
          <option value="pontual">Pontual</option>
          <option value="recorrente">Recorrente</option>
        </select>
      </Field>
      <Field label="Referência"><input className={inputClass} {...form.register("sku")} /></Field>
      <div className="md:col-span-2">
        <Field label="Descrição"><input className={inputClass} {...form.register("description")} /></Field>
      </div>
      <div className="md:col-span-2 flex items-center gap-3">
        <button className={buttonClass} type="submit">{itemId ? "Atualizar item" : "Salvar item"}</button>
        {message ? <span className="text-sm text-[#64748B]">{message}</span> : null}
      </div>
    </form>
  );
}

export function PayForm({ chargeId, today }: { chargeId: string; today: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const result = await payAction({
          chargeId,
          amount: String(data.get("amount") || ""),
          paidOn: String(data.get("paidOn") || today),
          method: String(data.get("method") || "Pix"),
          note: "Pagamento demonstrativo.",
        });
        setMessage(result.ok ? "Pagamento registrado." : result.error);
        if (result.ok) router.refresh();
      }}
    >
      <input name="amount" required placeholder="0,00" className={`${inputClass} w-28`} />
      <input name="paidOn" type="date" defaultValue={today} className={inputClass} />
      <select name="method" className={inputClass}>
        <option>Pix</option>
        <option>Boleto</option>
        <option>Cartão de crédito</option>
        <option>Transferência</option>
      </select>
      <button className={buttonClass} type="submit">Registrar</button>
      {message ? <span className="text-xs text-[#64748B]">{message}</span> : null}
    </form>
  );
}
