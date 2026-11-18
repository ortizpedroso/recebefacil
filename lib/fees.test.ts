import assert from "node:assert/strict";
import test from "node:test";
import { anticipationCents, quoteFees, withdrawalFeeCents } from "./fees";

test("Pix de R$ 100 paga R$ 1,99 do Asaas e 1,5% da plataforma", () => {
  const quote = quoteFees({ grossCents: 10_000, method: "pix", platformFeeBp: 150 });
  assert.deepEqual([quote.asaasCents, quote.platformCents, quote.netCents], [199, 150, 9_651]);
  assert.equal(quote.lines.length, 2);
});

test("cartão à vista de R$ 100 paga R$ 0,49 + 2,99%", () => {
  const quote = quoteFees({ grossCents: 10_000, method: "cartao", installments: 1, platformFeeBp: 150 });
  assert.equal(quote.asaasCents, 49 + 299);
  assert.equal(quote.anticipationCents, 0);
});

test("cartão em 12x antecipado soma a antecipação de 1,70% ao mês pelo prazo médio", () => {
  const quote = quoteFees({ grossCents: 120_000, method: "cartao", installments: 12, anticipate: true, platformFeeBp: 150 });
  const asaas = 49 + Math.round((120_000 * 399) / 10_000);
  assert.equal(quote.asaasCents, asaas);
  assert.equal(quote.anticipationCents, anticipationCents(120_000 - asaas, 12));
  assert.equal(quote.netCents, 120_000 - asaas - quote.anticipationCents - 1_800);
  assert.ok(quote.lines.some((line) => line.label.includes("Antecipação")));
});

test("antecipar à vista custa 1,25% e parcelado usa (N+1)/2 meses", () => {
  assert.equal(anticipationCents(10_000, 1), 125);
  assert.equal(anticipationCents(10_000, 3), 340);
});

test("taxa nunca deixa o líquido negativo", () => {
  assert.equal(quoteFees({ grossCents: 100, method: "pix", platformFeeBp: 150 }).netCents, 0);
});

test("os 30 primeiros saques do mês são grátis", () => {
  assert.equal(withdrawalFeeCents(0), 0);
  assert.equal(withdrawalFeeCents(29), 0);
  assert.equal(withdrawalFeeCents(30), 200);
});
