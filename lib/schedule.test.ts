import assert from "node:assert/strict";
import test from "node:test";
import { cents } from "./money";
import { buildSchedule, scheduleTotal, type ScheduleInput } from "./schedule";

const base: ScheduleInput = {
  financedCents: cents(10_000_000),
  entryCents: cents(0),
  count: 120,
  firstDue: "2026-02-10",
  soldOn: "2026-01-10",
  periodicity: "mensal",
  interestMonthlyBp: 0,
  adjustYearlyBp: 0,
};

test("sem juros a entrada vence na venda e o centavo que sobra fica na primeira parcela", () => {
  const rows = buildSchedule({ ...base, financedCents: cents(10_000), entryCents: cents(5_000), count: 3 });
  assert.deepEqual(
    rows.map((row) => [row.number, row.label, row.dueOn, row.amountCents]),
    [
      [1, "Entrada", "2026-01-10", 5_000],
      [2, "Parcela 1 de 3", "2026-02-10", 3_334],
      [3, "Parcela 2 de 3", "2026-03-10", 3_333],
      [4, "Parcela 3 de 3", "2026-04-10", 3_333],
    ],
  );
  assert.equal(scheduleTotal(rows), 15_000);
});

test("os vencimentos partem do primeiro e o fim de mês não escorrega", () => {
  const rows = buildSchedule({ ...base, financedCents: cents(400), count: 4, firstDue: "2026-01-31" });
  assert.deepEqual(rows.map((row) => row.dueOn), ["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
  const leap = buildSchedule({ ...base, financedCents: cents(200), count: 2, firstDue: "2028-01-31" });
  assert.deepEqual(leap.map((row) => row.dueOn), ["2028-01-31", "2028-02-29"]);
});

test("tabela Price: parcela fixa de R$ 1.434,71 e a última absorve o arredondamento", () => {
  const rows = buildSchedule({ ...base, interestMonthlyBp: 100 });
  assert.equal(rows.length, 120);
  assert.equal(rows[0].amountCents, 143_471);
  assert.equal(rows[118].amountCents, 143_471);
  assert.equal(scheduleTotal(rows), 17_216_514);
  assert.equal(rows[119].amountCents, 143_465);
});

test("reajuste de 5% ao ano sobe a parcela 13 e a 25 sobre a anterior", () => {
  const rows = buildSchedule({ ...base, interestMonthlyBp: 100, adjustYearlyBp: 500 });
  const amount = (position: number) => rows[position - 1].amountCents;
  assert.equal(amount(1), amount(12));
  assert.ok(Math.abs(amount(13) - amount(12) * 1.05) <= 1, `parcela 13 ${amount(13)}`);
  assert.ok(Math.abs(amount(25) - amount(12) * 1.05 ** 2) <= 1, `parcela 25 ${amount(25)}`);
  // 12 * PMT * (1,05^10 - 1) / 0,05, a soma dos dez anos de parcelas reajustadas
  assert.ok(Math.abs(scheduleTotal(rows) - 21_654_746) <= 1);
});

test("o reajuste vale sem juros e a soma do cronograma é a soma das parcelas", () => {
  const rows = buildSchedule({ ...base, financedCents: cents(1_200_000), count: 24, adjustYearlyBp: 1_000 });
  assert.equal(rows[11].amountCents, 50_000);
  assert.equal(rows[12].amountCents, 55_000);
  assert.equal(scheduleTotal(rows), 12 * 50_000 + 12 * 55_000);
});

test("em parcelas trimestrais a taxa mensal compõe por trimestre e o reajuste vem a cada quatro parcelas", () => {
  const rows = buildSchedule({ ...base, financedCents: cents(100_000), count: 8, periodicity: "trimestral", interestMonthlyBp: 100, adjustYearlyBp: 1_000 });
  const rate = 1.01 ** 3 - 1;
  const pmt = (100_000 * rate) / (1 - (1 + rate) ** -8);
  assert.ok(Math.abs(rows[0].amountCents - pmt) <= 1);
  assert.ok(Math.abs(rows[4].amountCents - pmt * 1.1) <= 1);
  assert.equal(rows[1].dueOn, "2026-05-10");
});
