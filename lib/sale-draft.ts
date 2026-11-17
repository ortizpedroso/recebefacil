import { addPeriod, type Periodicity } from "./dates";
import { DomainError } from "./errors";
import { cents } from "./money";
import { planSale, type SaleInput } from "./plan";
import { scheduleTotal, type ScheduleRow } from "./schedule";

export type PlanKind = "avista" | "parcelado" | "mensalidade";

export type DraftLine = {
  key: string;
  catalogItemId: string | null;
  description: string;
  kind: "produto" | "servico";
  quantity: number;
  unitCents: number;
};

export type Draft = {
  lines: DraftLine[];
  discountCents: number;
  plan: PlanKind;
  count: number;
  entryCents: number;
  firstDue: string;
  periodicity: Periodicity;
  interestBp: number;
  adjustBp: number;
  paidNow: boolean;
  method: string;
  today: string;
};

const MODE = { avista: "avista", parcelado: "parcelado", mensalidade: "recorrente" } as const;

export function toSaleInput(draft: Draft, clientId: string): SaleInput {
  const parcelado = draft.plan === "parcelado";
  return {
    clientId,
    soldOn: draft.today,
    discountCents: cents(draft.discountCents),
    notes: "",
    mode: MODE[draft.plan],
    entryCents: cents(parcelado ? draft.entryCents : 0),
    installmentCount: parcelado ? draft.count : 1,
    firstDue: draft.plan === "avista" ? draft.today : draft.firstDue,
    periodicity: draft.plan === "mensalidade" ? draft.periodicity : "mensal",
    interestMonthlyBp: parcelado ? draft.interestBp : 0,
    adjustYearlyBp: parcelado ? draft.adjustBp : 0,
    method: draft.method,
    makeContract: false,
    items: draft.lines.map((line) => ({ catalogItemId: line.catalogItemId, description: line.description, kind: line.kind, quantity: line.quantity, unitCents: cents(line.unitCents) })),
    paidNow: draft.plan === "avista" && draft.paidNow ? { method: draft.method, paidOn: draft.today } : undefined,
  };
}

export type Preview =
  | { ok: true; totalCents: number; rows: ScheduleRow[]; payTotalCents: number; recurring: boolean }
  | { ok: false; error: string | null; totalCents: number };

export function itemsTotal(lines: DraftLine[]) {
  return lines.reduce((sum, line) => sum + line.quantity * line.unitCents, 0);
}

// Mesma função que o servidor usa ao gravar, então a prévia nunca promete uma parcela diferente da que será cobrada.
export function previewDraft(draft: Draft): Preview {
  const totalCents = Math.max(itemsTotal(draft.lines) - draft.discountCents, 0);
  if (draft.lines.length === 0) return { ok: false, error: null, totalCents };
  try {
    const plan = planSale(toSaleInput(draft, "-"));
    if (draft.plan === "mensalidade") {
      const rows = Array.from({ length: 3 }, (_, index) => ({ number: index + 1, label: "Mensalidade", dueOn: addPeriod(draft.firstDue, draft.periodicity, index), amountCents: plan.total }));
      return { ok: true, totalCents: plan.total, rows, payTotalCents: plan.total, recurring: true };
    }
    return { ok: true, totalCents: plan.total, rows: plan.rows, payTotalCents: scheduleTotal(plan.rows), recurring: false };
  } catch (error) {
    if (error instanceof DomainError) return { ok: false, error: error.message, totalCents };
    throw error;
  }
}

// Mostra as primeiras linhas e a última, para um plano de 240 parcelas caber na tela.
export function trimmedRows<T>(rows: T[], head = 6): { shown: T[]; hidden: number; last: T | null } {
  if (rows.length <= head + 1) return { shown: rows, hidden: 0, last: null };
  return { shown: rows.slice(0, head), hidden: rows.length - head - 1, last: rows[rows.length - 1] };
}
