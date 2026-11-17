"use client";

import { MessageCircle, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { dueAction, payAction, reverseAction } from "@/app/actions";
import { formatDateBR } from "@/lib/dates";
import { PAYMENT_METHODS } from "@/lib/labels";
import { maskMoney } from "@/lib/masks";
import { cents, formatBRL, parseReais } from "@/lib/money";
import type { RowActionData } from "@/lib/pay-link";
import { CopyButton, copyText } from "./copy-button";
import { FormError, Modal } from "./dialog";
import { Menu, MenuItem } from "./menu";
import { toast } from "./toast";
import { buttonClass, dangerButtonClass, Field, inputClass, secondaryButtonClass, smallButtonClass, smallPrimaryClass } from "./ui";

type Perms = { canPay: boolean; canUndo: boolean };

const reais = (value: number) => formatBRL(cents(value)).replace(/^R\$\s?/, "");

function sumReais(amount: string, fee: string) {
  try {
    return parseReais(amount || "0") + parseReais(fee || "0");
  } catch {
    return null;
  }
}

function PayForm({ data, today, onDone }: { data: RowActionData; today: string; onDone: () => void }) {
  const router = useRouter();
  const [amount, setAmount] = useState(reais(data.openCents));
  const [fee, setFee] = useState(reais(data.feeCents));
  const [paidOn, setPaidOn] = useState(today);
  const [method, setMethod] = useState<string>("Pix");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  // A chave nasce com o formulário aberto. Um clique repetido reenvia a mesma chave e o servidor devolve o mesmo recebimento.
  const [key] = useState(() => crypto.randomUUID());
  const total = sumReais(amount, fee);
  return (
    <form
      className="space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError("");
        const result = await payAction({ chargeId: data.chargeId, amount, fee: fee || "0", paidOn, method, idempotencyKey: key });
        setPending(false);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        toast("Recebido. O recibo já está pronto.");
        onDone();
        router.refresh();
      }}
    >
      <input type="hidden" name="idempotencyKey" value={key} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Valor recebido">
          <input className={inputClass} inputMode="numeric" value={amount} onChange={(event) => setAmount(maskMoney(event.target.value))} required />
        </Field>
        <Field label="Multa e juros" hint="se houver">
          <input className={inputClass} inputMode="numeric" value={fee} onChange={(event) => setFee(maskMoney(event.target.value))} />
        </Field>
        <Field label="Data">
          <input className={inputClass} type="date" value={paidOn} max={today} onChange={(event) => setPaidOn(event.target.value)} required />
        </Field>
        <Field label="Como recebeu">
          <select className={inputClass} value={method} onChange={(event) => setMethod(event.target.value)}>
            {PAYMENT_METHODS.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </Field>
      </div>
      {total !== null ? <p className="text-sm text-slate-500">Entra no caixa: <strong className="text-slate-900">{formatBRL(cents(total))}</strong></p> : null}
      <FormError message={error} />
      <div className="flex justify-end gap-2">
        <button type="button" className={secondaryButtonClass} onClick={onDone}>
          Cancelar
        </button>
        <button type="submit" className={buttonClass} disabled={pending}>
          {pending ? "Salvando..." : "Confirmar recebimento"}
        </button>
      </div>
    </form>
  );
}

function UndoForm({ data, onDone }: { data: RowActionData; onDone: () => void }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">O que foi recebido nesta cobrança deixa de contar e ela volta a ficar em aberto. O recibo antigo perde a validade.</p>
      <FormError message={error} />
      <div className="flex justify-end gap-2">
        <button type="button" className={secondaryButtonClass} onClick={onDone}>
          Manter
        </button>
        <button
          type="button"
          className={dangerButtonClass}
          disabled={pending}
          onClick={async () => {
            setPending(true);
            const result = await reverseAction(data.chargeId);
            setPending(false);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            toast("Recebimento desfeito.");
            onDone();
            router.refresh();
          }}
        >
          {pending ? "Aguarde..." : "Desfazer recebimento"}
        </button>
      </div>
    </div>
  );
}

function DueForm({ data, onDone }: { data: RowActionData; onDone: () => void }) {
  const router = useRouter();
  const [dueOn, setDueOn] = useState(data.dueOn);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <form
      className="space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        const result = await dueAction({ chargeId: data.chargeId, dueOn });
        setPending(false);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        toast("Vencimento alterado.");
        onDone();
        router.refresh();
      }}
    >
      <Field label="Novo vencimento">
        <input className={inputClass} type="date" value={dueOn} onChange={(event) => setDueOn(event.target.value)} required />
      </Field>
      <FormError message={error} />
      <div className="flex justify-end gap-2">
        <button type="button" className={secondaryButtonClass} onClick={onDone}>
          Cancelar
        </button>
        <button type="submit" className={buttonClass} disabled={pending}>
          Salvar
        </button>
      </div>
    </form>
  );
}

type Dialogs = "pay" | "undo" | "due" | "nophone" | null;

export function RowActions({ data, today, perms }: { data: RowActionData; today: string; perms: Perms }) {
  const [dialog, setDialog] = useState<Dialogs>(null);
  const close = () => setDialog(null);
  const open = !data.closed;
  const hasMenu = open || (data.hasPayments && perms.canUndo);
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {open ? (
        data.whatsapp ? (
          <a href={data.whatsapp} target="_blank" rel="noopener noreferrer" className={smallButtonClass}>
            <MessageCircle className="h-3.5 w-3.5" />
            Cobrar
          </a>
        ) : (
          <button type="button" className={smallButtonClass} onClick={() => setDialog("nophone")}>
            <MessageCircle className="h-3.5 w-3.5" />
            Cobrar
          </button>
        )
      ) : null}
      {open && perms.canPay ? (
        <button type="button" className={smallPrimaryClass} onClick={() => setDialog("pay")}>
          Recebi
        </button>
      ) : null}
      {data.paymentId ? (
        <Link href={`/recibo/${data.paymentId}`} className={smallButtonClass}>
          Recibo
        </Link>
      ) : null}
      {hasMenu ? (
      <Menu label={`Mais opções de ${data.title}`} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" trigger={<MoreHorizontal className="h-4 w-4" />}>
        {open ? (
          <MenuItem
            onSelect={async () => {
              toast((await copyText(data.link)) ? "Link copiado" : "Não deu para copiar o link.");
            }}
          >
            Copiar link de pagamento
          </MenuItem>
        ) : null}
        {open && perms.canPay ? <MenuItem onSelect={() => setDialog("due")}>Mudar vencimento</MenuItem> : null}
        {data.hasPayments && perms.canUndo ? (
          <MenuItem danger onSelect={() => setDialog("undo")}>
            Desfazer recebimento
          </MenuItem>
        ) : null}
      </Menu>
      ) : null}

      <Modal open={dialog === "pay"} onOpenChange={(value) => !value && close()} title="Marcar como recebido" description={`${data.clientName} · ${data.title}`}>
        <PayForm data={data} today={today} onDone={close} />
      </Modal>
      <Modal open={dialog === "undo"} onOpenChange={(value) => !value && close()} title="Desfazer recebimento?" description={`${data.clientName} · ${data.title}`}>
        <UndoForm data={data} onDone={close} />
      </Modal>
      <Modal open={dialog === "due"} onOpenChange={(value) => !value && close()} title="Mudar vencimento" description={`Hoje vence em ${formatDateBR(data.dueOn)}.`}>
        <DueForm data={data} onDone={close} />
      </Modal>
      <Modal open={dialog === "nophone"} onOpenChange={(value) => !value && close()} title="Cliente sem WhatsApp" description={`${data.clientName} não tem telefone cadastrado.`}>
        <div className="space-y-3">
          <p className="text-sm text-slate-600">Copie o link de pagamento e envie por onde preferir. Para o botão Cobrar abrir o WhatsApp, cadastre o telefone do cliente.</p>
          <div className="flex flex-wrap justify-end gap-2">
            <Link href={`/clientes/${data.clientId}`} className={secondaryButtonClass}>
              Abrir o cliente
            </Link>
            <CopyButton text={data.link} className={buttonClass} doneMessage="Link copiado">
              Copiar link de pagamento
            </CopyButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}
