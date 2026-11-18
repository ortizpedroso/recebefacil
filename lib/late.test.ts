import assert from "node:assert/strict";
import test from "node:test";
import { lateCharges, lateSettingsError } from "./late";

const settings = { lateFineBp: 200, lateInterestMonthlyBp: 100 };

test("atraso de 10 dias cobra multa de 2% e 1% ao mês rateado por dia", () => {
  const result = lateCharges(100_000, "2026-01-01", "2026-01-11", settings);
  assert.equal(result.fineCents, 2_000);
  assert.equal(result.interestCents, 333);
});

test("um mês cheio de atraso rende 1% de juros", () => {
  assert.equal(lateCharges(100_000, "2026-01-01", "2026-01-31", settings).interestCents, 1_000);
});

test("pagar no vencimento ou antes não cobra nada", () => {
  assert.deepEqual(lateCharges(100_000, "2026-01-10", "2026-01-10", settings), { fineCents: 0, interestCents: 0 });
  assert.deepEqual(lateCharges(100_000, "2026-01-10", "2026-01-05", settings), { fineCents: 0, interestCents: 0 });
});

test("a multa nunca passa de 2% mesmo com configuração maior", () => {
  assert.equal(lateCharges(100_000, "2026-01-01", "2026-01-02", { lateFineBp: 500, lateInterestMonthlyBp: 0 }).fineCents, 2_000);
});

test("a configuração recusa multa acima de 2% e valores quebrados", () => {
  assert.equal(lateSettingsError({ lateFineBp: 200, lateInterestMonthlyBp: 100 }), null);
  assert.ok(lateSettingsError({ lateFineBp: 201, lateInterestMonthlyBp: 100 }));
  assert.ok(lateSettingsError({ lateFineBp: 100, lateInterestMonthlyBp: -1 }));
  assert.ok(lateSettingsError({ lateFineBp: 1.5, lateInterestMonthlyBp: 100 }));
});
