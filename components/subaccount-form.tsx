"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { openSubaccountAction } from "@/app/actions";
import { documentKind } from "@/lib/documents";
import { maskCpfOrCnpj, maskPhone } from "@/lib/masks";
import { FormError, Modal } from "./dialog";
import { toast } from "./toast";
import { buttonClass, Field, inputClass, secondaryButtonClass } from "./ui";

const COMPANY_TYPES = [
  { value: "MEI", label: "MEI" },
  { value: "LIMITED", label: "Limitada (Ltda)" },
  { value: "INDIVIDUAL", label: "Empresário individual" },
  { value: "ASSOCIATION", label: "Associação" },
];

export function SubaccountForm({ defaults }: { defaults: { document: string; name: string; email: string; phone: string } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [document, setDocument] = useState(maskCpfOrCnpj(defaults.document));
  const [phone, setPhone] = useState(maskPhone(defaults.phone));
  const [data, setData] = useState<FormData | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const kind = documentKind(document);

  async function confirm() {
    if (!data) return;
    setPending(true);
    setError("");
    const result = await openSubaccountAction(data);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      setData(null);
      return;
    }
    setOpen(false);
    toast("Conta aberta no Asaas. Agora é aguardar a análise.");
    router.refresh();
  }

  return (
    <>
      <button type="button" className={buttonClass} onClick={() => setOpen(true)}>
        Abrir minha conta de recebimento
      </button>
      <Modal open={open} onOpenChange={setOpen} title="Abrir conta de recebimento no Asaas" description="O Asaas pede estes dados para abrir a conta onde seu dinheiro cai. Ele pode pedir documentos por e-mail." wide>
        {data ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-700">
              Confirmar a abertura da conta no Asaas em nome de <strong>{String(data.get("name"))}</strong>, {kind === "pj" ? "CNPJ" : "CPF"} {document}? O acesso à conta chega no e-mail {String(data.get("email"))}.
            </p>
            <FormError message={error} />
            <div className="flex justify-end gap-2">
              <button type="button" className={secondaryButtonClass} onClick={() => setData(null)} disabled={pending}>
                Voltar
              </button>
              <button type="button" className={buttonClass} onClick={confirm} disabled={pending}>
                {pending ? "Abrindo conta..." : "Confirmar abertura"}
              </button>
            </div>
          </div>
        ) : (
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(event) => {
              // O modal mora dentro do formulário de Recebimentos na árvore do React: sem isto o envio subiria até ele.
              event.preventDefault();
              event.stopPropagation();
              setError("");
              setData(new FormData(event.currentTarget));
            }}
          >
            <Field label="CPF ou CNPJ do titular">
              <input name="document" className={inputClass} value={document} onChange={(event) => setDocument(maskCpfOrCnpj(event.target.value))} required />
            </Field>
            <Field label="Nome do titular" hint="pessoa ou razão social">
              <input name="name" className={inputClass} defaultValue={defaults.name} required minLength={2} />
            </Field>
            <Field label="E-mail">
              <input name="email" type="email" className={inputClass} defaultValue={defaults.email} required />
            </Field>
            <Field label="Celular">
              <input name="phone" className={inputClass} value={phone} onChange={(event) => setPhone(maskPhone(event.target.value))} required />
            </Field>
            {kind === "pj" ? (
              <Field label="Tipo de empresa">
                <select name="companyType" className={inputClass} defaultValue="MEI">
                  {COMPANY_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <Field label="Data de nascimento">
                <input name="birthDate" type="date" className={inputClass} required />
              </Field>
            )}
            <Field label="Faturamento mensal" hint="estimativa, em reais">
              <input name="income" inputMode="decimal" className={inputClass} placeholder="5.000,00" required />
            </Field>
            <Field label="CEP">
              <input name="zip" inputMode="numeric" className={inputClass} placeholder="00000-000" required />
            </Field>
            <Field label="Rua">
              <input name="street" className={inputClass} required />
            </Field>
            <Field label="Número">
              <input name="number" className={inputClass} required />
            </Field>
            <Field label="Complemento" hint="opcional">
              <input name="complement" className={inputClass} />
            </Field>
            <Field label="Bairro">
              <input name="district" className={inputClass} required />
            </Field>
            <div className="flex justify-end gap-2 sm:col-span-2">
              <button type="button" className={secondaryButtonClass} onClick={() => setOpen(false)}>
                Cancelar
              </button>
              <button type="submit" className={buttonClass}>
                Continuar
              </button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
