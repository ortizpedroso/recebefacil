import assert from "node:assert/strict";
import test from "node:test";
import { cents, formatBRL, parseReais, splitBalance } from "./money";

test("a entrada mais as parcelas fecha o total, e o centavo extra fica na primeira", () => {
  const total = cents(1_000_000);
  const entry = cents(200_000);
  const parts = splitBalance(cents(total - entry), 4);
  assert.deepEqual(parts, [cents(200_000), cents(200_000), cents(200_000), cents(200_000)]);
  assert.equal(entry + parts.reduce((sum, part) => sum + part, 0), total);

  const uneven = splitBalance(cents(10_000), 3);
  assert.deepEqual(uneven, [cents(3334), cents(3333), cents(3333)]);
  assert.equal(uneven.reduce((sum, part) => sum + part, 0), 10_000);
});

test("reais brasileiros entram e saem sem fração binária", () => {
  assert.equal(parseReais("10.000,00"), 1_000_000);
  assert.equal(parseReais("2400.5"), 240_050);
  assert.equal(formatBRL(cents(4500000)), "R$ 45.000,00");
  assert.throws(() => parseReais("10,999"));
  assert.throws(() => splitBalance(cents(2), 3));
});
