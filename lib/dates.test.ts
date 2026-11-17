import assert from "node:assert/strict";
import test from "node:test";
import { addPeriod, periodIndexOnOrAfter } from "./dates";

test("o mês curto prende o dia no último dia do mês, sem transbordar", () => {
  assert.equal(addPeriod("2026-01-31", "mensal", 1), "2026-02-28");
  assert.equal(addPeriod("2026-01-31", "mensal", 2), "2026-03-31");
  assert.equal(addPeriod("2026-01-31", "mensal", 3), "2026-04-30");
  assert.equal(addPeriod("2028-01-31", "mensal", 1), "2028-02-29");
  assert.equal(addPeriod("2026-12-31", "mensal", 2), "2027-02-28");
  assert.equal(addPeriod("2026-11-30", "trimestral", 1), "2027-02-28");
  assert.equal(addPeriod("2026-08-31", "semestral", 1), "2027-02-28");
  assert.equal(addPeriod("2028-02-29", "anual", 1), "2029-02-28");
  assert.equal(addPeriod("2028-02-29", "anual", 4), "2032-02-29");
});

test("semana e quinzena andam em dias corridos", () => {
  assert.equal(addPeriod("2026-01-31", "semanal", 1), "2026-02-07");
  assert.equal(addPeriod("2026-01-31", "quinzenal", 2), "2026-03-02");
});

test("cada vencimento parte da data original e não do vencimento anterior", () => {
  const dates = [0, 1, 2, 3].map((steps) => addPeriod("2026-01-31", "mensal", steps));
  assert.deepEqual(dates, ["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
});

test("o índice do ciclo acha o primeiro vencimento na data ou depois dela", () => {
  assert.equal(periodIndexOnOrAfter("2026-01-31", "mensal", "2026-02-28"), 1);
  assert.equal(periodIndexOnOrAfter("2026-01-31", "mensal", "2026-03-01"), 2);
  assert.equal(periodIndexOnOrAfter("2026-01-31", "mensal", "2026-03-31"), 2);
});
