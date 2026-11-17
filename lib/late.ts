import { daysLate } from "./dates";
import { cents, type Cents } from "./money";

// CDC art. 52, parágrafo 1: a multa de mora não passa de 2%.
export const MAX_LATE_FINE_BP = 200;
export const MAX_LATE_INTEREST_BP = 1000;

export type LateSettings = { lateFineBp: number; lateInterestMonthlyBp: number };

export function lateSettingsError(settings: LateSettings): string | null {
  const { lateFineBp, lateInterestMonthlyBp } = settings;
  if (!Number.isInteger(lateFineBp) || lateFineBp < 0 || lateFineBp > MAX_LATE_FINE_BP) {
    return "A multa por atraso vai de 0% a 2%.";
  }
  if (!Number.isInteger(lateInterestMonthlyBp) || lateInterestMonthlyBp < 0 || lateInterestMonthlyBp > MAX_LATE_INTEREST_BP) {
    return "Os juros de mora vão de 0% a 10% ao mês.";
  }
  return null;
}

export function lateCharges(amountOpenCents: number, dueOn: string, paidOn: string, settings: LateSettings): { fineCents: Cents; interestCents: Cents } {
  const days = daysLate(dueOn, paidOn);
  if (days <= 0 || amountOpenCents <= 0) return { fineCents: cents(0), interestCents: cents(0) };
  const fineBp = Math.min(settings.lateFineBp, MAX_LATE_FINE_BP);
  return {
    fineCents: cents(Math.round((amountOpenCents * fineBp) / 10_000)),
    // Juros ao mês rateados por dia (mês comercial de 30 dias).
    interestCents: cents(Math.round((amountOpenCents * settings.lateInterestMonthlyBp * days) / (10_000 * 30))),
  };
}
