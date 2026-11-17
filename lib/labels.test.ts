import assert from "node:assert/strict";
import test from "node:test";
import { chargeBadge, chargeTitle, clientBadge, kindLabel, planLabel, saleBadge, tracksStock } from "./labels";

const today = "2026-11-17";
const open = (dueOn: string, paidCents = 0) => ({ status: paidCents > 0 ? "parcial" : "pendente", amountCents: 10_000, paidCents, dueOn });

test("cobrança em aberto vira texto leigo conforme a distância do vencimento", () => {
  assert.deepEqual(chargeBadge(open("2026-11-16"), today), { tone: "late", label: "Atrasada 1 dia" });
  assert.deepEqual(chargeBadge(open("2026-11-07"), today), { tone: "late", label: "Atrasada 10 dias" });
  assert.deepEqual(chargeBadge(open("2026-11-17"), today), { tone: "soon", label: "Vence hoje" });
  assert.deepEqual(chargeBadge(open("2026-11-18"), today), { tone: "soon", label: "Vence em 1 dia" });
  assert.deepEqual(chargeBadge(open("2026-11-24"), today), { tone: "soon", label: "Vence em 7 dias" });
  assert.deepEqual(chargeBadge(open("2026-11-25"), today), { tone: "open", label: "Vence 25/11" });
});

test("recebida, recebida em parte e cancelada têm rótulo próprio, e o atraso vence o parcial", () => {
  assert.deepEqual(chargeBadge({ status: "paga", amountCents: 100, paidCents: 100, dueOn: "2026-01-01" }, today), { tone: "paid", label: "Recebida" });
  assert.deepEqual(chargeBadge({ status: "cancelada", amountCents: 100, paidCents: 0, dueOn: "2026-01-01" }, today), { tone: "muted", label: "Cancelada" });
  assert.equal(chargeBadge(open("2026-12-20", 4_000), today).label, "Recebida em parte");
  assert.equal(chargeBadge(open("2026-11-10", 4_000), today).label, "Atrasada 7 dias");
});

test("venda mostra Quitada, Com atraso, Em dia ou Cancelada", () => {
  const base = { status: "aguardando", mode: "parcelado", openCount: 2, lateCount: 0, recurringActive: false };
  assert.equal(saleBadge(base).label, "Em dia");
  assert.equal(saleBadge({ ...base, lateCount: 1 }).label, "Com atraso");
  assert.equal(saleBadge({ ...base, openCount: 0 }).label, "Quitada");
  assert.equal(saleBadge({ ...base, status: "cancelada", lateCount: 1 }).label, "Cancelada");
  assert.equal(saleBadge({ ...base, mode: "recorrente", openCount: 0, recurringActive: true }).label, "Em dia");
  assert.equal(saleBadge({ ...base, mode: "recorrente", openCount: 0, recurringActive: false }).label, "Quitada");
});

test("cliente mostra Atrasado, Em dia ou Nada a pagar", () => {
  assert.equal(clientBadge({ lateCount: 1, openCents: 500 }).label, "Atrasado");
  assert.equal(clientBadge({ lateCount: 0, openCents: 500 }).label, "Em dia");
  assert.equal(clientBadge({ lateCount: 0, openCents: 0 }).label, "Nada a pagar");
});

test("tipos do catálogo saem com acento e só produto controla estoque", () => {
  assert.equal(kindLabel("servico"), "Serviço");
  assert.equal(kindLabel("mensalidade"), "Mensalidade");
  assert.equal(kindLabel("produto"), "Produto");
  assert.equal(tracksStock("produto"), true);
  assert.equal(tracksStock("servico"), false);
  assert.equal(tracksStock("mensalidade"), false);
});

test("plano e título da cobrança usam palavras do dia a dia", () => {
  assert.equal(planLabel({ mode: "avista", installmentCount: 1 }), "À vista");
  assert.equal(planLabel({ mode: "parcelado", installmentCount: 12 }), "12x");
  assert.equal(planLabel({ mode: "recorrente", installmentCount: 1 }), "Mensalidade");
  assert.equal(chargeTitle({ label: "Parcela 3 de 120", dueOn: "2026-11-10" }), "Parcela 3 de 120");
  assert.equal(chargeTitle({ label: "Mensalidade", dueOn: "2026-11-10" }), "Mensalidade de novembro");
  assert.equal(chargeTitle({ label: null, dueOn: "2026-11-10" }), "Cobrança avulsa");
});
