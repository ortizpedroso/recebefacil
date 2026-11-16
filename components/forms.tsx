"use client";

import { useState } from "react";
import { roles, roleLabel } from "@/lib/access";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { clientSchema, catalogSchema, formResolver } from "@/lib/schemas";
import { lookupCep } from "@/lib/cep";
import { maskCep, maskCnpj, maskDocument, maskMoney, maskPhone, maskUf } from "@/lib/masks";
import { companyAction, createCatalogAction, createClientAction, inviteAction, payAction, supportAction, updateCatalogAction, updateClientAction } from "@/app/actions";
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
  const [cepNote, setCepNote] = useState("");
  const form = useForm({
    resolver: formResolver(clientSchema),
    defaultValues: initial
      ? {
          ...initial,
          kind: initial.kind,
          document: maskDocument(initial.document, initial.kind),
          phone: maskPhone(initial.phone),
          whatsapp: maskPhone(initial.whatsapp),
          zip: maskCep(initial.zip),
          state: maskUf(initial.state),
        }
      : { kind: "pf" as const, name: "", document: "", email: "", phone: "", whatsapp: "", zip: "", state: "", city: "", district: "", street: "", number: "", complement: "", notes: "" },
  });
  const kind = form.watch("kind");

  async function fillCep(value: string) {
    const masked = maskCep(value);
    form.setValue("zip", masked, { shouldValidate: true });
    if (masked.replace(/\D/g, "").length !== 8) {
      setCepNote("");
      return;
    }
    setCepNote("Buscando CEP...");
    try {
      const address = await lookupCep(masked);
      if (!address) {
        setCepNote("CEP não encontrado.");
        return;
      }
      form.setValue("street", address.street);
      form.setValue("district", address.district);
      form.setValue("city", address.city);
      form.setValue("state", address.state);
      if (address.complement) form.setValue("complement", address.complement);
      setCepNote("Endereço preenchido pelo CEP.");
    } catch {
      setCepNote("Não foi possível consultar o CEP.");
    }
  }
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
        <select
          className={inputClass}
          {...form.register("kind")}
          onChange={(event) => {
            const next = event.target.value === "pj" ? "pj" : "pf";
            form.setValue("kind", next);
            form.setValue("document", maskDocument(form.getValues("document"), next));
          }}
        >
          <option value="pf">Pessoa física</option>
          <option value="pj">Pessoa jurídica</option>
        </select>
      </Field>
      <Field label="Nome"><input className={inputClass} {...form.register("name")} /></Field>
      <Field label="CPF ou CNPJ">
        <input className={inputClass} inputMode="numeric" placeholder={kind === "pj" ? "00.000.000/0000-00" : "000.000.000-00"} {...form.register("document")} onChange={(event) => form.setValue("document", maskDocument(event.target.value, kind), { shouldValidate: true })} />
      </Field>
      <Field label="Telefone">
        <input className={inputClass} inputMode="numeric" placeholder="(00) 00000-0000" {...form.register("phone")} onChange={(event) => form.setValue("phone", maskPhone(event.target.value), { shouldValidate: true })} />
      </Field>
      <Field label="WhatsApp">
        <input className={inputClass} inputMode="numeric" placeholder="(00) 00000-0000" {...form.register("whatsapp")} onChange={(event) => form.setValue("whatsapp", maskPhone(event.target.value), { shouldValidate: true })} />
      </Field>
      <Field label="E-mail"><input className={inputClass} {...form.register("email")} /></Field>
      <Field label="CEP">
        <input className={inputClass} inputMode="numeric" placeholder="00000-000" {...form.register("zip")} onChange={(event) => void fillCep(event.target.value)} />
      </Field>
      <Field label="UF">
        <input className={inputClass} maxLength={2} placeholder="AM" {...form.register("state")} onChange={(event) => form.setValue("state", maskUf(event.target.value), { shouldValidate: true })} />
      </Field>
      <Field label="Cidade"><input className={inputClass} {...form.register("city")} /></Field>
      <Field label="Bairro"><input className={inputClass} {...form.register("district")} /></Field>
      <Field label="Rua"><input className={inputClass} {...form.register("street")} /></Field>
      <Field label="Número"><input className={inputClass} {...form.register("number")} /></Field>
      <div className="md:col-span-2 flex items-center gap-3">
        <button className={buttonClass} type="submit">{clientId ? "Salvar cliente" : "Cadastrar cliente"}</button>
        {message ? <span className="text-sm text-[#64748B]">{message}</span> : null}
        {form.formState.errors.email?.message ? <span className="text-sm text-[#EF4444]">{form.formState.errors.email.message}</span> : null}
        {form.formState.errors.document?.message ? <span className="text-sm text-[#EF4444]">{form.formState.errors.document.message}</span> : null}
        {form.formState.errors.root?.message ? <span className="text-sm text-[#EF4444]">{form.formState.errors.root.message}</span> : null}
        {cepNote ? <span className="text-sm text-[#64748B]">{cepNote}</span> : null}
      </div>
    </form>
  );
}

export function CatalogForm({
  itemId,
  initial,
}: {
  itemId?: string;
  initial?: { kind: "produto" | "servico"; name: string; description: string; category: string; sku: string; price: string; billing: "pontual" | "recorrente"; stock: string };
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const form = useForm({
    resolver: formResolver(catalogSchema),
    defaultValues: initial
      ? { ...initial, price: maskMoney(initial.price), stock: initial.stock }
      : { kind: "produto" as const, name: "", description: "", category: "", sku: "", price: "", billing: "pontual" as const, stock: "" },
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
      <Field label="Preço">
        <input className={inputClass} inputMode="numeric" placeholder="0,00" {...form.register("price")} onChange={(event) => form.setValue("price", maskMoney(event.target.value), { shouldValidate: true })} />
      </Field>
      <Field label="Cobrança">
        <select className={inputClass} {...form.register("billing")}>
          <option value="pontual">Pontual</option>
          <option value="recorrente">Recorrente</option>
        </select>
      </Field>
      <Field label="Referência"><input className={inputClass} {...form.register("sku")} /></Field>
      <Field label="Estoque"><input className={inputClass} inputMode="numeric" placeholder="Só produto" {...form.register("stock")} /></Field>
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
  const [amount, setAmount] = useState("");
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const result = await payAction({
          chargeId,
          amount,
          paidOn: String(data.get("paidOn") || today),
          method: String(data.get("method") || "Pix"),
          note: "Pagamento demonstrativo.",
        });
        setMessage(result.ok ? "Pagamento registrado." : result.error);
        if (result.ok) router.refresh();
      }}
    >
      <input name="amount" required placeholder="0,00" inputMode="numeric" className={`${inputClass} w-28`} value={amount} onChange={(event) => setAmount(maskMoney(event.target.value))} />
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

export function CompanyForm({
  tradeName,
  legalName,
  document,
  email,
  phone,
  timezone,
  address,
}: {
  tradeName: string;
  legalName: string;
  document: string;
  email: string;
  phone: string;
  timezone: string;
  address: string;
}) {
  const [doc, setDoc] = useState(maskCnpj(document));
  const [tel, setTel] = useState(maskPhone(phone));
  const [message, setMessage] = useState("");
  return (
    <form
      className="grid gap-3 md:grid-cols-2"
      onSubmit={async (event) => {
        event.preventDefault();
        const result = await companyAction(new FormData(event.currentTarget));
        setMessage(result.ok ? "Empresa salva." : result.error);
      }}
    >
      <input name="tradeName" defaultValue={tradeName} className={inputClass} aria-label="Nome fantasia" />
      <input name="legalName" defaultValue={legalName} className={inputClass} aria-label="Razão social" />
      <input name="document" value={doc} onChange={(event) => setDoc(maskCnpj(event.target.value))} className={inputClass} aria-label="CNPJ" inputMode="numeric" placeholder="00.000.000/0000-00" />
      <input name="email" defaultValue={email} className={inputClass} aria-label="E-mail" />
      <input name="phone" value={tel} onChange={(event) => setTel(maskPhone(event.target.value))} className={inputClass} aria-label="Telefone" inputMode="numeric" placeholder="(00) 0000-0000" />
      <input name="timezone" defaultValue={timezone} className={inputClass} aria-label="Fuso" />
      <input name="address" defaultValue={address} className={`${inputClass} md:col-span-2`} aria-label="Endereço" />
      <button className={buttonClass}>Salvar empresa</button>
      {message ? <span className="text-sm text-[#64748B]">{message}</span> : null}
    </form>
  );
}

export function InviteForm() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  return (
    <form
      className="grid gap-3 md:grid-cols-4"
      onSubmit={async (event) => {
        event.preventDefault();
        const result = await inviteAction(new FormData(event.currentTarget));
        setMessage(result.ok ? "Pessoa gravada na equipe." : result.error);
        if (result.ok) {
          event.currentTarget.reset();
          router.refresh();
        }
      }}
    >
      <input name="name" required placeholder="Nome" className={inputClass} aria-label="Nome do convite" />
      <input name="email" required type="email" placeholder="email@empresa.com" className={inputClass} aria-label="E-mail do convite" />
      <select name="role" className={inputClass} aria-label="Papel" defaultValue="operador">
        {roles.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}
      </select>
      <button className={buttonClass} type="submit">Convidar</button>
      {message ? <span className="text-sm text-[#64748B] md:col-span-4">{message}</span> : null}
    </form>
  );
}

export function SupportForm() {
  const [message, setMessage] = useState("");
  return (
    <form
      className="grid gap-3"
      onSubmit={async (event) => {
        event.preventDefault();
        const result = await supportAction(new FormData(event.currentTarget));
        setMessage(result.ok ? "Chamado gravado. O canal de resposta é este formulário e o e-mail suporte@recebefacil.app." : result.error);
        if (result.ok) event.currentTarget.reset();
      }}
    >
      <input name="contact" required placeholder="Seu e-mail ou telefone" className={inputClass} aria-label="Contato" />
      <textarea name="message" required minLength={5} placeholder="Como podemos ajudar" className={inputClass} aria-label="Mensagem" />
      <button className={buttonClass} type="submit">Enviar chamado</button>
      {message ? <p className="text-sm text-[#64748B]">{message}</p> : null}
    </form>
  );
}
