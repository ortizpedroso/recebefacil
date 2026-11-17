"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { companyAction, inviteAction, receivingAction, roleAction, supportAction } from "@/app/actions";
import { roleLabel, roles } from "@/lib/access";
import { BRAZIL_ZONES, isBrazilZone } from "@/lib/zones";
import { maskCpfOrCnpj, maskPhone } from "@/lib/masks";
import { formatPercentBp } from "@/lib/money";
import { FormError } from "./dialog";
import { toast } from "./toast";
import { buttonClass, Field, inputClass, secondaryButtonClass } from "./ui";

export function CompanyForm({ company }: { company: { tradeName: string; legalName: string; document: string; email: string; phone: string; address: string; timezone: string; lateFineBp: number; lateInterestMonthlyBp: number } }) {
  const router = useRouter();
  const [document, setDocument] = useState(maskCpfOrCnpj(company.document));
  const [phone, setPhone] = useState(maskPhone(company.phone));
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError("");
        const result = await companyAction(new FormData(event.currentTarget));
        setPending(false);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        toast("Dados da empresa salvos.");
        router.refresh();
      }}
    >
      <Field label="Nome da empresa" hint="como seus clientes conhecem">
        <input name="tradeName" className={inputClass} defaultValue={company.tradeName} required />
      </Field>
      <Field label="Razão social" hint="opcional">
        <input name="legalName" className={inputClass} defaultValue={company.legalName} />
      </Field>
      <Field label="CNPJ" hint="opcional, vai no recibo e no contrato">
        <input name="document" className={inputClass} inputMode="numeric" value={document} onChange={(event) => setDocument(maskCpfOrCnpj(event.target.value))} />
      </Field>
      <Field label="Telefone" hint="opcional">
        <input name="phone" className={inputClass} inputMode="tel" value={phone} onChange={(event) => setPhone(maskPhone(event.target.value))} />
      </Field>
      <Field label="E-mail" hint="opcional">
        <input name="email" className={inputClass} type="email" defaultValue={company.email} />
      </Field>
      <Field label="Fuso horário" hint="define o que é hoje">
        <select name="timezone" className={inputClass} defaultValue={company.timezone}>
          {isBrazilZone(company.timezone) ? null : <option value={company.timezone}>{company.timezone}</option>}
          {BRAZIL_ZONES.map((zone) => (
            <option key={zone.id} value={zone.id}>
              {zone.label}
            </option>
          ))}
        </select>
      </Field>
      <div className="sm:col-span-2">
        <Field label="Endereço" hint="opcional">
          <input name="address" className={inputClass} defaultValue={company.address} />
        </Field>
      </div>
      <Field label="Multa por atraso (%)" hint="a lei limita a 2%">
        <input name="lateFine" className={inputClass} inputMode="decimal" defaultValue={formatPercentBp(company.lateFineBp)} />
      </Field>
      <Field label="Juros por atraso (% ao mês)" hint="cobrado por dia">
        <input name="lateInterest" className={inputClass} inputMode="decimal" defaultValue={formatPercentBp(company.lateInterestMonthlyBp)} />
      </Field>
      <div className="space-y-2 sm:col-span-2">
        <FormError message={error} />
        <button type="submit" className={buttonClass} disabled={pending}>
          {pending ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </form>
  );
}

export function ReceivingForm({ pixKey, instructions, asaasConnected }: { pixKey: string; instructions: string; asaasConnected: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <form
      className="space-y-5"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError("");
        const result = await receivingAction(new FormData(event.currentTarget));
        setPending(false);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        toast("Recebimentos salvos.");
        router.refresh();
      }}
    >
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-semibold text-slate-900">Como você recebe</legend>
        <label className={`flex cursor-pointer items-start gap-3 rounded-xl border-[1.5px] p-3 ${asaasConnected ? "border-[#E2E8F0]" : "border-teal-700 bg-teal-50"}`}>
          <input type="radio" name="mode" value="gestao" className="mt-1 accent-teal-700" defaultChecked={!asaasConnected} />
          <span>
            <span className="block font-semibold text-slate-900">Gestão</span>
            <span className="block text-[13px] text-slate-600">Seu cliente paga como você combinar (Pix, dinheiro, transferência) e você marca Recebi.</span>
          </span>
        </label>
        <label className="flex cursor-not-allowed items-start gap-3 rounded-xl border-[1.5px] border-[#E2E8F0] bg-slate-50 p-3 opacity-80">
          <input type="radio" name="mode" value="integrado" className="mt-1" disabled />
          <span>
            <span className="block font-semibold text-slate-900">
              Integrado <span className="ml-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">Disponível em breve</span>
            </span>
            <span className="block text-[13px] text-slate-600">Pix, boleto e cartão pelo Asaas, com baixa automática quando o cliente paga.</span>
          </span>
        </label>
      </fieldset>
      <Field label="Chave Pix" hint="aparece no link de pagamento">
        <input name="pixKey" className={inputClass} defaultValue={pixKey} placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória" />
      </Field>
      <Field label="Instruções de pagamento" hint="o cliente lê isto ao pagar">
        <textarea name="instructions" className={inputClass} rows={3} defaultValue={instructions} placeholder="Ex.: Depois de pagar, envie o comprovante pelo WhatsApp." />
      </Field>
      <FormError message={error} />
      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? "Salvando..." : "Salvar"}
      </button>
    </form>
  );
}

export function InviteForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  return (
    <form
      className="grid gap-3 sm:grid-cols-[1fr_1fr_10rem_auto] sm:items-end"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        setError("");
        const result = await inviteAction(new FormData(form));
        if (!result.ok) {
          setError(result.error);
          return;
        }
        form.reset();
        toast("Pessoa adicionada à equipe.");
        router.refresh();
      }}
    >
      <Field label="Nome">
        <input name="name" required className={inputClass} />
      </Field>
      <Field label="E-mail">
        <input name="email" type="email" required className={inputClass} />
      </Field>
      <Field label="Pode">
        <select name="role" className={inputClass} defaultValue="operador">
          {roles.map((role) => (
            <option key={role} value={role}>
              {roleLabel(role)}
            </option>
          ))}
        </select>
      </Field>
      <button type="submit" className={buttonClass}>
        Convidar
      </button>
      <div className="sm:col-span-4">
        <FormError message={error} />
      </div>
    </form>
  );
}

export function MemberRole({ memberId, name, role }: { memberId: string; name: string; role: string }) {
  const router = useRouter();
  const [value, setValue] = useState(role);
  const [error, setError] = useState("");
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <select aria-label={`O que ${name} pode fazer`} className={`${inputClass} w-44`} value={value} onChange={(event) => setValue(event.target.value)}>
          {roles.map((option) => (
            <option key={option} value={option}>
              {roleLabel(option)}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={secondaryButtonClass}
          disabled={value === role}
          onClick={async () => {
            setError("");
            const result = await roleAction(memberId, value);
            if (!result.ok) {
              setError(result.error);
              setValue(role);
              return;
            }
            toast("Permissão alterada.");
            router.refresh();
          }}
        >
          Salvar
        </button>
      </div>
      <FormError message={error} />
    </div>
  );
}

export function SupportForm() {
  const [error, setError] = useState("");
  return (
    <form
      className="grid gap-3"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        setError("");
        const result = await supportAction(new FormData(form));
        if (!result.ok) {
          setError(result.error);
          return;
        }
        form.reset();
        toast("Mensagem enviada. Respondemos por e-mail ou telefone.");
      }}
    >
      <Field label="Seu e-mail ou telefone">
        <input name="contact" required className={inputClass} />
      </Field>
      <Field label="Como podemos ajudar?">
        <textarea name="message" required minLength={5} rows={4} className={inputClass} />
      </Field>
      <FormError message={error} />
      <div>
        <button type="submit" className={buttonClass}>
          Enviar
        </button>
      </div>
    </form>
  );
}
