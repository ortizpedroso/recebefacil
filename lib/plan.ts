import type { Periodicity } from "./dates";
import { DomainError } from "./errors";
import { cents, MAX_INSTALLMENTS, type Cents } from "./money";
import { buildSchedule, MAX_ADJUST_BP, MAX_FINANCE_INTEREST_BP, type ScheduleRow } from "./schedule";

export type ItemInput = {
  catalogItemId: string | null;
  description: string;
  kind: "produto" | "servico";
  quantity: number;
  unitCents: Cents;
};

export type SaleInput = {
  clientId: string;
  soldOn: string;
  discountCents: Cents;
  notes: string;
  mode: "avista" | "parcelado" | "recorrente";
  entryCents: Cents;
  installmentCount: number;
  firstDue: string;
  periodicity: Periodicity;
  interestMonthlyBp?: number;
  adjustYearlyBp?: number;
  method: string;
  makeContract: boolean;
  items: ItemInput[];
  paidNow?: { method: string; paidOn: string };
};

export type SalePlan = {
  total: Cents;
  entry: Cents;
  count: number;
  interestBp: number;
  adjustBp: number;
  periodicity: Periodicity | null;
  rows: ScheduleRow[];
};

// Pura de propósito: a tela de nova venda roda esta mesma função para mostrar as parcelas antes de gravar.
export function planSale(input: SaleInput): SalePlan {
  const itemsTotal = input.items.reduce((sum, item) => sum + item.quantity * item.unitCents, 0);
  if (itemsTotal <= input.discountCents) throw new DomainError("O desconto zera a venda.");
  const total = cents(itemsTotal - input.discountCents);
  if (input.mode === "avista") {
    const rows = [{ number: 1, label: "À vista", dueOn: input.soldOn, amountCents: total }];
    return { total, entry: cents(0), count: 1, interestBp: 0, adjustBp: 0, periodicity: null, rows };
  }
  if (input.mode === "recorrente") {
    return { total, entry: cents(0), count: 1, interestBp: 0, adjustBp: 0, periodicity: input.periodicity, rows: [] };
  }
  const entry = input.entryCents;
  if (entry > total) throw new DomainError("A entrada passa do total.");
  if (entry === total) throw new DomainError("A entrada quita a venda. Use à vista.");
  const count = input.installmentCount;
  if (!Number.isInteger(count) || count < 1 || count > MAX_INSTALLMENTS) {
    throw new DomainError(`A quantidade de parcelas deve ficar entre 1 e ${MAX_INSTALLMENTS}.`);
  }
  const interestBp = input.interestMonthlyBp ?? 0;
  const adjustBp = input.adjustYearlyBp ?? 0;
  if (!Number.isInteger(interestBp) || interestBp < 0 || interestBp > MAX_FINANCE_INTEREST_BP) {
    throw new DomainError("Os juros do financiamento vão de 0% a 10% ao mês.");
  }
  if (!Number.isInteger(adjustBp) || adjustBp < 0 || adjustBp > MAX_ADJUST_BP) {
    throw new DomainError("O reajuste anual vai de 0% a 20%.");
  }
  const financed = cents(total - entry);
  if (financed < count) throw new DomainError("O saldo não cobre um centavo por parcela.");
  const rows = buildSchedule({
    financedCents: financed,
    entryCents: entry,
    count,
    firstDue: input.firstDue,
    soldOn: input.soldOn,
    periodicity: input.periodicity,
    interestMonthlyBp: interestBp,
    adjustYearlyBp: adjustBp,
  });
  if (rows.some((row) => row.amountCents <= 0)) throw new DomainError("O saldo é pequeno demais para essa quantidade de parcelas.");
  return { total, entry, count, interestBp, adjustBp, periodicity: input.periodicity, rows };
}
