import { addPeriod, periodsPerYear, type Periodicity } from "./dates";
import { cents, splitBalance, type Cents } from "./money";

export type ScheduleInput = {
  financedCents: Cents;
  entryCents: Cents;
  count: number;
  firstDue: string;
  soldOn: string;
  periodicity: Periodicity;
  interestMonthlyBp: number;
  adjustYearlyBp: number;
};

export const MAX_FINANCE_INTEREST_BP = 1000;
export const MAX_ADJUST_BP = 2000;

export type ScheduleRow = { number: number; label: string; dueOn: string; amountCents: Cents };

function installmentAmounts(input: ScheduleInput): Cents[] {
  const { financedCents, count, periodicity, interestMonthlyBp, adjustYearlyBp } = input;
  if (interestMonthlyBp === 0 && adjustYearlyBp === 0) return splitBalance(financedCents, count);
  const perYear = periodsPerYear(periodicity);
  // Tabela Price: a taxa mensal vira taxa por período composta, e a parcela é a PMT do saldo financiado.
  const rate = Math.expm1((12 / perYear) * Math.log1p(interestMonthlyBp / 10_000));
  const pmt = rate === 0 ? financedCents / count : (financedCents * rate) / -Math.expm1(-count * Math.log1p(rate));
  const growth = 1 + adjustYearlyBp / 10_000;
  const exact = Array.from({ length: count }, (_, index) => pmt * growth ** Math.floor(index / perYear));
  const amounts = exact.map((value) => Math.round(value));
  const target = Math.round(exact.reduce((sum, value) => sum + value, 0));
  amounts[count - 1] = target - amounts.slice(0, -1).reduce((sum, value) => sum + value, 0);
  return amounts.map((value) => cents(value));
}

export function buildSchedule(input: ScheduleInput): ScheduleRow[] {
  const rows: ScheduleRow[] = [];
  if (input.entryCents > 0) rows.push({ number: 1, label: "Entrada", dueOn: input.soldOn, amountCents: input.entryCents });
  installmentAmounts(input).forEach((amountCents, index) => {
    rows.push({
      number: rows.length + 1,
      label: `Parcela ${index + 1} de ${input.count}`,
      dueOn: addPeriod(input.firstDue, input.periodicity, index),
      amountCents,
    });
  });
  return rows;
}

export function scheduleTotal(rows: ScheduleRow[]): Cents {
  return cents(rows.reduce((sum, row) => sum + row.amountCents, 0));
}
