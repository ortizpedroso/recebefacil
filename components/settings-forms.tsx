"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { companyAction, connectAsaasAction, disconnectAsaasAction, inviteAction, receivingAction, removeMemberAction, supportAction, updateMemberAction } from "@/app/actions";
import { roleLabel, roles } from "@/lib/access";
import { BRAZIL_ZONES, isBrazilZone } from "@/lib/zones";
import { maskCpfOrCnpj, maskPhone } from "@/lib/masks";
import { formatPercent, formatPercentBp } from "@/lib/money";
import { ConfirmAction } from "./confirm-action";
import { FormError, Modal } from "./dialog";
import { SubaccountForm } from "./subaccount-form";
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

// planAllowed é falso para quem está no plano Gestão: o modo Integrado fica explicado e com o caminho para trocar de plano.
export type ReceivingOffer = { available: boolean; planAllowed: boolean; feeBp: number; environment: "sandbox" | "producao" };
// subaccountLabel existe quando a conta foi aberta pela plataforma: ela não se troca nem se solta por aqui.
export type ReceivingLink = { accountName: string; walletTail: string; subaccountLabel?: string } | null;


export function ReceivingForm({ pixKey, instructions, initialMode, link, offer, subaccountDefaults }: { pixKey: string; instructions: string; initialMode: "gestao" | "integrado"; link: ReceivingLink; offer: ReceivingOffer; subaccountDefaults: { document: string; name: string; email: string; phone: string } }) {
  const router = useRouter();
  const [mode, setMode] = useState(initialMode);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const usable = offer.available && offer.planAllowed;
  const integratedOn = mode === "integrado" && usable;
  const card = (on: boolean) => `flex cursor-pointer items-start gap-3 rounded-xl border-[1.5px] p-3 ${on ? "border-teal-700 bg-teal-50" : "border-[#E2E8F0]"}`;

  async function connect() {
    setConnecting(true);
    setError("");
    const result = await connectAsaasAction(apiKey);
    setConnecting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setApiKey("");
    setReplacing(false);
    setMode("integrado");
    toast("Conta Asaas conectada.");
    router.refresh();
  }

  async function disconnect() {
    setError("");
    const result = await disconnectAsaasAction();
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMode("gestao");
    toast("Conta Asaas desconectada. Você voltou para o modo Gestão.");
    router.refresh();
  }

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
        <label className={card(!integratedOn)}>
          <input type="radio" name="mode" value="gestao" className="mt-1 accent-teal-700" checked={!integratedOn} onChange={() => setMode("gestao")} />
          <span>
            <span className="block font-semibold text-slate-900">Gestão</span>
            <span className="block text-[13px] text-slate-600">Seu cliente paga como você combinar (Pix, dinheiro, transferência) e você marca Recebi.</span>
          </span>
        </label>
        <label className={`${card(integratedOn)} ${usable ? "" : "cursor-not-allowed bg-slate-50 opacity-80"}`}>
          <input type="radio" name="mode" value="integrado" className="mt-1 accent-teal-700" checked={integratedOn} disabled={!usable} onChange={() => setMode("integrado")} />
          <span>
            <span className="block font-semibold text-slate-900">
              Integrado {!offer.available ? <span className="ml-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">Ainda indisponível</span> : null}
              {offer.available && !offer.planAllowed ? <span className="ml-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">Plano Integrado</span> : null}
            </span>
            <span className="block text-[13px] text-slate-600">Pix, boleto e cartão pelo Asaas, com baixa automática quando o cliente paga. Você ainda pode marcar Recebi.</span>
          </span>
        </label>
      </fieldset>

      {!offer.available ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          O modo Integrado e a abertura da conta de recebimento no Asaas aparecem aqui assim que o dono da plataforma cadastrar as credenciais do Asaas em Configurações, na aba Plataforma.
        </p>
      ) : null}

      {offer.available && !offer.planAllowed ? (
        <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p>
            O modo Integrado faz parte do plano Integrado. No plano Gestão você continua recebendo do seu jeito e marcando Recebi. {initialMode === "integrado" ? "Seus clientes não conseguem mais gerar Pix, boleto ou cartão novos pelo link, e o que já foi gerado segue valendo." : ""}
          </p>
          <Link href="/assinatura?plano=integrado#confirmar" className={buttonClass}>
            Conhecer o plano Integrado
          </Link>
        </div>
      ) : null}

      {integratedOn && usable ? (
        <div className="space-y-3 rounded-xl border border-[#E2E8F0] bg-slate-50 p-4">
          <p className="text-sm text-slate-700">Você recebe direto na sua conta Asaas. A plataforma fica com {formatPercent(offer.feeBp)}% de cada pagamento.</p>
          {offer.environment === "sandbox" ? <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Ambiente de testes: use uma conta e uma chave do sandbox. Nenhum dinheiro de verdade se move.</p> : null}
          {link?.subaccountLabel ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-slate-800">
                <span className="font-semibold">Conta de recebimento:</span> {link.accountName || "conta Asaas"} · {link.subaccountLabel}
              </p>
              <Link href="/saque" className={secondaryButtonClass}>
                Ver saldo e sacar
              </Link>
            </div>
          ) : link && !replacing ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-slate-800">
                <span className="font-semibold">Conta conectada:</span> {link.accountName || "conta Asaas"} · carteira ••••{link.walletTail}
              </p>
              <span className="flex gap-2">
                <button type="button" className={secondaryButtonClass} onClick={() => setReplacing(true)}>
                  Trocar conta
                </button>
                <button type="button" className={secondaryButtonClass} onClick={disconnect}>
                  Desconectar
                </button>
              </span>
            </div>
          ) : (
            <div className="space-y-2">
              {replacing ? null : (
                <div className="space-y-2 border-b border-[#E2E8F0] pb-3">
                  <p className="text-sm text-slate-700">Ainda não tem conta no Asaas? Abra a sua por aqui, sem sair do RecebeFácil. O dinheiro dos seus clientes cai nela e você saca por Pix na aba Saque e taxas.</p>
                  <SubaccountForm defaults={subaccountDefaults} />
                </div>
              )}
              <Field label="Já tem conta no Asaas? Chave de API da sua conta" hint="usada uma vez para achar sua conta e depois descartada">
                <input
                  type="password"
                  autoComplete="new-password"
                  className={inputClass}
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void connect();
                    }
                  }}
                  placeholder="cole a chave que você copiou no Asaas"
                />
              </Field>
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" className={buttonClass} disabled={connecting || apiKey.trim().length < 6} onClick={connect}>
                  {connecting ? "Conectando..." : "Conectar conta Asaas"}
                </button>
                {replacing ? (
                  <button type="button" className="text-sm font-semibold text-slate-600 hover:underline" onClick={() => setReplacing(false)}>
                    Cancelar
                  </button>
                ) : null}
              </div>
              <p className="text-[13px] text-slate-500">No Asaas, a chave fica em Integrações, Chaves de API.</p>
            </div>
          )}
        </div>
      ) : null}

      <Field label="Chave Pix" hint="aparece no link de pagamento no modo Gestão">
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

type MemberView = { id: string; name: string; email: string; role: string };

// Editar e excluir pedem confirmação: mexer na equipe muda o que outra pessoa consegue fazer.
export function MemberActions({ member }: { member: MemberView }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(member);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  function start() {
    setDraft(member);
    setConfirming(false);
    setError("");
    setOpen(true);
  }

  async function save() {
    setPending(true);
    setError("");
    const result = await updateMemberAction(member.id, { name: draft.name, email: draft.email, role: draft.role });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      setConfirming(false);
      return;
    }
    setOpen(false);
    toast("Pessoa atualizada.");
    router.refresh();
  }

  const changed = draft.name !== member.name || draft.email !== member.email || draft.role !== member.role;

  return (
    <div className="flex items-center gap-2">
      <span className="hidden text-sm text-slate-600 sm:inline">{roleLabel(member.role as (typeof roles)[number])}</span>
      <button type="button" className={secondaryButtonClass} onClick={start}>
        Editar
      </button>
      <ConfirmAction
        label="Excluir"
        className={secondaryButtonClass}
        confirmLabel={`Excluir ${member.name}?`}
        message={`${member.name} perde o acesso ao RecebeFácil desta empresa. As vendas e os recebimentos registrados continuam.`}
        danger
        action={() => removeMemberAction(member.id)}
      />
      <Modal open={open} onOpenChange={setOpen} title={`Editar ${member.name}`}>
        {confirming ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Salvar as alterações de {member.name}? {draft.role !== member.role ? `O acesso passa a ser de ${roleLabel(draft.role as (typeof roles)[number])}.` : ""}
            </p>
            <FormError message={error} />
            <div className="flex justify-end gap-2">
              <button type="button" className={secondaryButtonClass} onClick={() => setConfirming(false)} disabled={pending}>
                Voltar
              </button>
              <button type="button" className={buttonClass} onClick={save} disabled={pending}>
                {pending ? "Salvando..." : "Confirmar"}
              </button>
            </div>
          </div>
        ) : (
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              setConfirming(true);
            }}
          >
            <Field label="Nome">
              <input className={inputClass} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} required minLength={2} />
            </Field>
            <Field label="E-mail">
              <input className={inputClass} type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} required />
            </Field>
            <Field label="Pode">
              <select className={inputClass} value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value })}>
                {roles.map((option) => (
                  <option key={option} value={option}>
                    {roleLabel(option)}
                  </option>
                ))}
              </select>
            </Field>
            <FormError message={error} />
            <div className="flex justify-end gap-2">
              <button type="button" className={secondaryButtonClass} onClick={() => setOpen(false)}>
                Cancelar
              </button>
              <button type="submit" className={buttonClass} disabled={!changed}>
                Salvar
              </button>
            </div>
          </form>
        )}
      </Modal>
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
