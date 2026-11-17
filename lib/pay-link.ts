import { headers } from "next/headers";
import { can } from "./access";
import { todayIn, whatsAppHref } from "./dates";
import { collectionMessage } from "./messages";
import type { ReceivableRow } from "./receivables";
import { signToken } from "./secret";
import type { Session } from "./session";

// O link de pagamento é absoluto e sai do endereço que o dono está usando agora, para funcionar em qualquer ambiente.
export async function requestOrigin(): Promise<string> {
  const list = await headers();
  const host = (list.get("x-forwarded-host") ?? list.get("host") ?? "localhost:3000").split(",")[0].trim();
  const local = /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(host);
  const proto = (list.get("x-forwarded-proto") ?? (local ? "http" : "https")).split(",")[0].trim();
  return `${proto}://${host}`;
}

export function payUrl(origin: string, chargeId: string): string {
  return `${origin}/pagar/${signToken(chargeId)}`;
}

// Tudo que o botão da linha precisa, já pronto: o cliente da tela só abre o link ou copia o texto.
export type RowActionData = {
  chargeId: string;
  clientId: string;
  clientName: string;
  title: string;
  openCents: number;
  feeCents: number;
  dueOn: string;
  closed: boolean;
  hasPayments: boolean;
  paymentId: string | null;
  link: string;
  whatsapp: string | null;
};

export function rowActionData(row: ReceivableRow, origin: string, company: string): RowActionData {
  const link = payUrl(origin, row.id);
  const message = collectionMessage({ clientName: row.clientName, company, title: row.title, dueOn: row.dueOn, openCents: row.openCents, late: row.late, link });
  const hasPhone = row.clientPhone.replace(/\D/g, "").length >= 10;
  return {
    chargeId: row.id,
    clientId: row.clientId,
    clientName: row.clientName,
    title: row.title,
    openCents: row.openCents,
    feeCents: row.feeCents,
    dueOn: row.dueOn,
    closed: row.closed,
    hasPayments: row.paidCents > 0,
    paymentId: row.paymentId,
    link,
    whatsapp: hasPhone ? whatsAppHref(row.clientPhone, message) : null,
  };
}

export type RowContext = { origin: string; company: string; today: string; canPay: boolean; canUndo: boolean };

export async function rowContext(session: Session): Promise<RowContext> {
  return {
    origin: await requestOrigin(),
    company: session.org.tradeName,
    today: todayIn(session.org.timezone),
    canPay: can(session.role, "pagamentos.registrar"),
    canUndo: can(session.role, "pagamentos.estornar"),
  };
}
