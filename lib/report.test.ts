import assert from "node:assert/strict";
import test from "node:test";
import { receiptsByMethod, saleBalance, salesByItem, type Book } from "./read";

const book = {
  payments: [
    { method: "Pix", amountCents: 100, reversedAt: null },
    { method: "Pix", amountCents: 200, reversedAt: null },
    { method: "Boleto", amountCents: 500, reversedAt: null },
    { method: "Pix", amountCents: 999, reversedAt: "2026-01-01" },
  ],
  sales: [
    { id: "s1", status: "paga" },
    { id: "s2", status: "cancelada" },
  ],
  items: [
    { saleId: "s1", description: "Curso", quantity: 1, totalCents: 1000 },
    { saleId: "s2", description: "Cancelado", quantity: 1, totalCents: 500 },
  ],
} as unknown as Book;

test("recebimentos por forma somam só os não estornados", () => {
  assert.deepEqual(receiptsByMethod(book), [
    { method: "Boleto", total: 500 },
    { method: "Pix", total: 300 },
  ]);
});

test("vendas por item ignoram vendas canceladas", () => {
  assert.deepEqual(salesByItem(book), [
    { description: "Curso", total: 1000, quantity: 1 },
  ]);
});

test("saldo da venda é o que falta nas cobranças, e o recebido ignora o estornado", () => {
  const b = {
    sales: [{ id: "s1", totalCents: 1000, mode: "parcelado" }],
    charges: [
      { id: "c1", saleId: "s1", amountCents: 600, paidCents: 400, status: "parcial" },
      { id: "c2", saleId: "s1", amountCents: 400, paidCents: 100, status: "parcial" },
    ],
    payments: [
      { chargeId: "c1", amountCents: 400, reversedAt: null },
      { chargeId: "c1", amountCents: 999, reversedAt: "2026-01-01" },
      { chargeId: "c2", amountCents: 100, reversedAt: null },
    ],
  } as unknown as Book;
  assert.deepEqual(saleBalance(b, "s1"), { received: 500, open: 500 });
});

test("com juros a soma das cobranças passa do preço e o saldo acompanha as cobranças", () => {
  const b = {
    sales: [{ id: "s1", totalCents: 1000, mode: "parcelado" }],
    charges: [
      { id: "c1", saleId: "s1", amountCents: 700, paidCents: 700, status: "paga" },
      { id: "c2", saleId: "s1", amountCents: 700, paidCents: 0, status: "pendente" },
    ],
    payments: [{ chargeId: "c1", amountCents: 700, reversedAt: null }],
  } as unknown as Book;
  assert.deepEqual(saleBalance(b, "s1"), { received: 700, open: 700 });
});
