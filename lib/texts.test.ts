import assert from "node:assert/strict";
import test from "node:test";
import { contractClauses, type ContractFacts } from "./contract-text";
import { monthName, nextMonthStart, whatsAppHref } from "./dates";
import { collectionMessage } from "./messages";

test("a mensagem de cobrança chama pelo primeiro nome e leva o link", () => {
  const late = collectionMessage({ clientName: "Camila Rocha", company: "Estúdio Bella", title: "Parcela 3 de 4", dueOn: "2026-10-10", openCents: 18_990, late: 38, link: "https://x.test/pagar/abc" });
  assert.match(late, /^Olá, Camila! Aqui é da Estúdio Bella\./);
  assert.match(late, /Parcela 3 de 4/);
  assert.match(late, /R\$ 189,90/);
  assert.match(late, /venceu em 10\/10\/2026/);
  assert.match(late, /https:\/\/x\.test\/pagar\/abc$/);
  const soon = collectionMessage({ clientName: "Camila Rocha", company: "Estúdio Bella", title: "Parcela 3 de 4", dueOn: "2026-11-20", openCents: 18_990, late: 0, link: "https://x.test/pagar/abc" });
  assert.match(soon, /com vencimento em 20\/11\/2026/);
  assert.doesNotMatch(soon, /venceu/);
});

test("o mês de hoje começa no dia 1 e o seguinte vira o ano em dezembro", () => {
  assert.equal(nextMonthStart("2026-11-17"), "2026-12-01");
  assert.equal(nextMonthStart("2026-12-31"), "2027-01-01");
  assert.equal(monthName("2026-03-09"), "março");
});

const facts: ContractFacts = {
  issuedOn: "2026-01-10",
  company: { name: "Loteadora Horizonte", document: "34.567.890/0001-30", address: "Av. Central, 100" },
  client: { name: "Marcos Rodrigues", document: "", address: "" },
  items: [{ description: "Lote 12, quadra B", quantity: 1, unitCents: 4_500_000 }],
  discountCents: 0,
  totalCents: 4_500_000,
  mode: "parcelado",
  entryCents: 900_000,
  installmentCount: 3,
  installments: [
    { dueOn: "2026-01-10", amountCents: 900_000 },
    { dueOn: "2026-02-10", amountCents: 1_300_000 },
    { dueOn: "2026-03-10", amountCents: 1_300_000 },
    { dueOn: "2026-04-10", amountCents: 1_300_000 },
  ],
  periodicity: "mensal",
  interestMonthlyBp: 100,
  adjustYearlyBp: 500,
  lateFineBp: 200,
  lateInterestMonthlyBp: 100,
};

test("o contrato lista partes, objeto, preço, plano com juros e reajuste, e multa de atraso", () => {
  const text = contractClauses(facts).map((clause) => `${clause.title}\n${clause.paragraphs.join("\n")}`).join("\n");
  assert.match(text, /VENDEDOR: Loteadora Horizonte, documento 34\.567\.890\/0001-30/);
  assert.match(text, /COMPRADOR: Marcos Rodrigues\./);
  assert.match(text, /1 × Lote 12, quadra B, R\$ 45\.000,00 cada/);
  assert.match(text, /Entrada de R\$ 9\.000,00/);
  assert.match(text, /3 parcelas mensais, a primeira de R\$ 13\.000,00 com vencimento em 10\/02\/2026 e a última de R\$ 13\.000,00 em 10\/04\/2026/);
  assert.match(text, /juros de financiamento de 1,00% ao mês/);
  assert.match(text, /reajustadas em 5,00% a cada 12 meses/);
  assert.match(text, /multa de 2,00%.*juros de mora de 1,00% ao mês/);
  assert.match(text, /Total a pagar ao final do contrato: R\$ 48\.000,00/);
});

test("contrato à vista e de mensalidade descrevem a cobrança sem parcelas", () => {
  const avista = contractClauses({ ...facts, mode: "avista", entryCents: 0, installments: [{ dueOn: "2026-01-10", amountCents: 4_500_000 }], interestMonthlyBp: 0, adjustYearlyBp: 0 });
  assert.match(avista[3].paragraphs[0], /à vista, em 10\/01\/2026/);
  const monthly = contractClauses({ ...facts, mode: "recorrente", totalCents: 24_900, installments: [{ dueOn: "2026-12-05", amountCents: 24_900 }] });
  assert.match(monthly[3].paragraphs[0], /R\$ 249,00 será cobrado a cada período \(mensal\), a partir de 05\/12\/2026/);
});

test("o link do WhatsApp põe o 55 do Brasil sem confundir com o DDD 55", () => {
  assert.equal(whatsAppHref("(11) 98877-1020", "Oi"), "https://wa.me/5511988771020?text=Oi");
  assert.equal(whatsAppHref("(55) 98877-1020", "Oi"), "https://wa.me/5555988771020?text=Oi");
  assert.equal(whatsAppHref("+55 11 98877-1020", "Oi"), "https://wa.me/5511988771020?text=Oi");
});
