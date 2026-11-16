import assert from "node:assert/strict"
import test from "node:test"
import {
  addMonthsClamped,
  centavos,
  civilDate,
  clientId,
  confirmed,
  contractId,
  crediarioId,
  decidePeriod,
  decideReceipt,
  decideReversal,
  dueDay,
  foldBook,
  generatablePeriods,
  installmentCount,
  installmentId,
  parsePhone,
  parsePixKey,
  parseReais,
  parseTaxId,
  periodKey,
  planCrediario,
  positiveCentavos,
  position,
  receiptId,
  receiptKey,
  receivedInMonth,
  reversalId,
  splitPrincipal,
  todayInSaoPaulo,
  voided,
  type Contract,
  type Installment,
  type InstallmentFacts,
  type Receipt,
  type Reversal,
  type Situation,
} from "./money"

type InstallmentHasNoSituation = Installment extends { situation: Situation } ? never : true
type ReversalHasNoAmount = Reversal extends { amount: unknown } ? never : true
const installmentShape: InstallmentHasNoSituation = true
const reversalShape: ReversalHasNoAmount = true
void installmentShape
void reversalShape

function facts(partial: {
  principal?: number
  dueOn?: string
  receipts?: InstallmentFacts["receipts"]
}): InstallmentFacts {
  return {
    clientId: clientId("c1"),
    clientName: "Ada",
    installment: {
      id: installmentId("i1"),
      principal: positiveCentavos(partial.principal ?? 10_000),
      dueOn: civilDate(partial.dueOn ?? "2026-11-10"),
      parent: { kind: "crediario", crediarioId: crediarioId("a1"), sequence: 1 },
    },
    receipts: partial.receipts ?? [],
  }
}

function receipt(amount: number, on: string, key = "k1"): Receipt {
  return {
    id: receiptId("r1"),
    idempotencyKey: receiptKey(key),
    amount: positiveCentavos(amount),
    method: "pix",
    confirmedOn: civilDate(on),
  }
}

test("split puts the remainder on the last installment", () => {
  const schedule = splitPrincipal(positiveCentavos(10_000), installmentCount(3))
  assert.ok(!("code" in schedule))
  assert.deepEqual(schedule.parts.map((part) => part.valueOf()), [3333, 3333, 3334])
  assert.equal(
    schedule.parts.reduce((sum, part) => sum + part, 0),
    10_000,
  )
})

test("split rejects a count that would create a zero-centavo installment", () => {
  const schedule = splitPrincipal(positiveCentavos(2), installmentCount(3))
  assert.deepEqual(schedule, { code: "count_exceeds_principal" })
})

test("january 31 clamps into february", () => {
  assert.equal(addMonthsClamped(civilDate("2026-01-31"), 1), "2026-02-28")
  assert.equal(addMonthsClamped(civilDate("2024-01-31"), 1), "2024-02-29")
})

test("sao paulo date does not follow utc", () => {
  assert.equal(todayInSaoPaulo(new Date("2026-11-16T02:30:00Z")), "2026-11-15")
  assert.equal(todayInSaoPaulo(new Date("2026-11-16T03:00:00Z")), "2026-11-16")
})

test("due today stays open and due yesterday is overdue", () => {
  const today = civilDate("2026-11-16")
  const dueToday = position(facts({ dueOn: "2026-11-16" }), today)
  const late = position(facts({ dueOn: "2026-11-15" }), today)
  assert.equal(dueToday.situation, "open")
  assert.equal(late.situation, "overdue")
  assert.equal(late.open, 10_000)
})

test("a settled installment is not overdue", () => {
  const paid = confirmed(receipt(10_000, "2026-11-12"))
  const placed = position(facts({ receipts: [paid] }), civilDate("2026-11-16"))
  assert.equal(placed.situation, "settled")
  assert.equal(placed.open, 0)
})

test("the same receipt key replays and a different payload conflicts", () => {
  const book = facts({ receipts: [confirmed(receipt(4_000, "2026-11-12"))] })
  const replay = decideReceipt(book, {
    idempotencyKey: receiptKey("k1"),
    amount: positiveCentavos(4_000),
    method: "pix",
    confirmedOn: civilDate("2026-11-12"),
  })
  const conflict = decideReceipt(book, {
    idempotencyKey: receiptKey("k1"),
    amount: positiveCentavos(4_001),
    method: "pix",
    confirmedOn: civilDate("2026-11-12"),
  })
  assert.equal(replay.kind, "replay")
  assert.equal(conflict.kind, "conflict")
})

test("a receipt above the open balance is rejected", () => {
  const decision = decideReceipt(facts({}), {
    idempotencyKey: receiptKey("k2"),
    amount: positiveCentavos(10_001),
    method: "cash",
    confirmedOn: civilDate("2026-11-16"),
  })
  assert.deepEqual(decision, { kind: "reject", reason: "exceeds_open" })
})

test("reversal has no amount and a second reversal replays", () => {
  const original = receipt(4_000, "2026-11-12")
  const reversal: Reversal = {
    id: reversalId("v1"),
    receiptId: original.id,
    reversedOn: civilDate("2026-11-13"),
  }
  const first = decideReversal(facts({ receipts: [confirmed(original)] }), {
    receiptId: original.id,
    reversedOn: civilDate("2026-11-16"),
  })
  const second = decideReversal(facts({ receipts: [voided(original, reversal)] }), {
    receiptId: original.id,
    reversedOn: civilDate("2026-11-16"),
  })
  assert.equal(first.kind, "append")
  if (first.kind === "append") assert.deepEqual(Object.keys(first.draft).sort(), ["receiptId", "reversedOn"])
  assert.equal(second.kind, "replay")
  const open = position(facts({ receipts: [voided(original, reversal)] }), civilDate("2026-11-16"))
  assert.equal(open.open, 10_000)
})

test("received this month subtracts a reversal dated in that month", () => {
  const original = receipt(4_000, "2026-10-20")
  const reversal: Reversal = {
    id: reversalId("v1"),
    receiptId: original.id,
    reversedOn: civilDate("2026-11-02"),
  }
  const november = receivedInMonth([voided(original, reversal)], civilDate("2026-11-16"))
  const october = receivedInMonth([voided(original, reversal)], civilDate("2026-10-31"))
  assert.equal(november, -4_000)
  assert.equal(october, 4_000)
  const sameMonth = receipt(3_334, "2026-11-16", "k9")
  const undone: Reversal = {
    id: reversalId("v2"),
    receiptId: sameMonth.id,
    reversedOn: civilDate("2026-11-16"),
  }
  assert.equal(receivedInMonth([voided(sameMonth, undone)], civilDate("2026-11-16")), 0)
})

function withId(base: InstallmentFacts, id: string, dueOn: string): InstallmentFacts {
  return {
    ...base,
    installment: { ...base.installment, id: installmentId(id), dueOn: civilDate(dueOn) },
  }
}

test("dashboard overdue is the open subset and due soon covers seven days", () => {
  const today = civilDate("2026-11-16")
  const late = withId(facts({}), "i1", "2026-11-10")
  const soon = withId(facts({}), "i2", "2026-11-20")
  const later = withId(facts({}), "i3", "2026-11-30")
  const dash = foldBook([late, soon, later], today)
  assert.equal(dash.open, 30_000)
  assert.equal(dash.overdue, 10_000)
  assert.deepEqual(
    dash.dueSoon.map((item) => item.installment.id),
    ["i2"],
  )
})

test("a contract only offers periods whose due date is on or after the opening", () => {
  const contract: Contract = {
    id: contractId("ct1"),
    clientId: clientId("c1"),
    description: "Mensalidade",
    amountPerPeriod: positiveCentavos(15_000),
    dueDay: dueDay(5),
    openedOn: civilDate("2026-11-20"),
  }
  assert.deepEqual(generatablePeriods(contract, [], civilDate("2026-11-20")), [])
  assert.deepEqual(generatablePeriods(contract, [], civilDate("2026-12-01")), ["2026-12"])
  const decision = decidePeriod(contract, periodKey("2026-11"), false, civilDate("2026-12-01"))
  assert.deepEqual(decision, { kind: "reject", reason: "period_not_due" })
  const stored = decidePeriod(contract, periodKey("2026-12"), true, civilDate("2026-12-01"))
  assert.equal(stored.kind, "replay")
})

test("plan keeps the crediário sum and monthly dates", () => {
  const plan = planCrediario(positiveCentavos(10_000), installmentCount(3), civilDate("2026-01-31"))
  assert.ok(Array.isArray(plan))
  if (!Array.isArray(plan)) return
  assert.deepEqual(
    plan.map((row) => row.dueOn),
    ["2026-01-31", "2026-02-28", "2026-03-31"],
  )
  assert.equal(
    plan.reduce((sum, row) => sum + row.amount, 0),
    10_000,
  )
})

test("reais parsing keeps centavos as integers", () => {
  assert.equal(parseReais("1.234,56"), 123456)
  assert.equal(parseReais("10,5"), 1050)
  assert.equal(parseReais("10"), 1000)
  assert.equal(parseReais("10.50"), null)
  assert.equal(parseReais("0,00"), null)
  assert.equal(centavos(-150), -150)
})

test("documents, phones, and pix keys reject guesses", () => {
  assert.deepEqual(parseTaxId("529.982.247-25"), { kind: "cpf", digits: "52998224725" })
  assert.equal(parseTaxId("111.111.111-11"), null)
  assert.deepEqual(parsePhone("+55 (11) 98888-7777"), { digits: "11988887777" })
  assert.equal(parsePhone("011988887777"), null)
  assert.deepEqual(parsePixKey("ADA@Loja.com"), { kind: "email", address: "ada@loja.com" })
  assert.equal(parsePixKey("nao-e-chave"), null)
})
