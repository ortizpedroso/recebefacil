import assert from "node:assert/strict"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { openIsolatedLedger, type Ledger } from "./driver"
import {
  applyReceipt,
  applyReversal,
  insertContract,
  insertCrediario,
  listClients,
  loadFacts,
  materialize,
  upsertClient,
  upsertMerchant,
} from "./ledger"
import {
  civilDate,
  clientId,
  contractKey,
  crediarioKey,
  dueDay,
  installmentCount,
  parseTaxId,
  periodKey,
  planCrediario,
  positiveCentavos,
  position,
  receiptKey,
  toInteger,
  viewerId,
  type ReceiptMethod,
} from "../domain/money"

async function book(): Promise<{ sql: Ledger; dir: string; viewer: ReturnType<typeof viewerId>; client: string }> {
  const dir = await mkdtemp(join(tmpdir(), "recebefacil-"))
  const sql = await openIsolatedLedger(dir)
  const viewer = viewerId("production:user:test")
  await upsertMerchant(sql, viewer, "Loja Teste", { kind: "email", address: "loja@teste.com" })
  const tax = parseTaxId("529.982.247-25")
  assert.ok(tax)
  const client = await upsertClient(sql, viewer, "Ada Lovelace", tax, "11988887777")
  return { sql, dir, viewer, client: client.id }
}

test("a crediário survives a restart and the parcels sum to the principal", async () => {
  const { sql, dir, viewer, client } = await book()
  const plan = planCrediario(positiveCentavos(10_000), installmentCount(3), civilDate("2026-01-31"))
  assert.ok(Array.isArray(plan))
  const created = await insertCrediario(
    sql,
    viewer,
    crediarioKey("sale-1"),
    clientId(client),
    "Curso",
    plan,
    positiveCentavos(10_000),
    installmentCount(3),
    civilDate("2026-01-31"),
  )
  assert.ok("agreement" in created)
  await sql.close()
  const reopened = await openIsolatedLedger(dir)
  const facts = await loadFacts(reopened, viewer)
  assert.equal(facts.length, 3)
  assert.equal(
    facts.reduce((sum, item) => sum + toInteger(item.installment.principal), 0),
    10_000,
  )
  await reopened.close()
  await rm(dir, { recursive: true, force: true })
})

test("the same sale key does not write a second schedule, and a different payload conflicts", async () => {
  const { sql, dir, viewer, client } = await book()
  const plan = planCrediario(positiveCentavos(9_000), installmentCount(2), civilDate("2026-12-01"))
  assert.ok(Array.isArray(plan))
  const args = [
    viewer,
    crediarioKey("sale-2"),
    clientId(client),
    "Serviço",
    plan,
    positiveCentavos(9_000),
    installmentCount(2),
    civilDate("2026-12-01"),
  ] as const
  const first = await insertCrediario(sql, ...args)
  const second = await insertCrediario(sql, ...args)
  assert.ok("agreement" in first && "agreement" in second)
  assert.equal(first.replayed, false)
  assert.equal(second.replayed, true)
  assert.equal(first.agreement.id, second.agreement.id)
  const other = planCrediario(positiveCentavos(8_000), installmentCount(2), civilDate("2026-12-01"))
  assert.ok(Array.isArray(other))
  const conflict = await insertCrediario(
    sql,
    viewer,
    crediarioKey("sale-2"),
    clientId(client),
    "Serviço",
    other,
    positiveCentavos(8_000),
    installmentCount(2),
    civilDate("2026-12-01"),
  )
  assert.deepEqual(conflict, { conflict: true })
  assert.equal((await loadFacts(sql, viewer)).length, 2)
  await sql.close()
  await rm(dir, { recursive: true, force: true })
})

test("a receipt key posts once, every method fits, and a second reversal does nothing", async () => {
  const { sql, dir, viewer, client } = await book()
  const plan = planCrediario(positiveCentavos(500), installmentCount(1), civilDate("2026-11-01"))
  assert.ok(Array.isArray(plan))
  const created = await insertCrediario(
    sql,
    viewer,
    crediarioKey("sale-3"),
    clientId(client),
    "Parcela única",
    plan,
    positiveCentavos(500),
    installmentCount(1),
    civilDate("2026-11-01"),
  )
  assert.ok("installments" in created)
  const parcel = created.installments[0].id
  const methods: ReceiptMethod[] = ["pix", "boleto", "card", "cash", "transfer"]
  for (const [index, method] of methods.entries()) {
    const posted = await applyReceipt(sql, viewer, parcel, {
      idempotencyKey: receiptKey(`pay-${method}`),
      amount: positiveCentavos(100),
      method,
      confirmedOn: civilDate("2026-11-16"),
    })
    assert.equal(posted.kind, "appended")
    const replay = await applyReceipt(sql, viewer, parcel, {
      idempotencyKey: receiptKey(`pay-${method}`),
      amount: positiveCentavos(100),
      method,
      confirmedOn: civilDate("2026-11-16"),
    })
    assert.equal(replay.kind, "replay")
    assert.equal(index >= 0, true)
  }
  const open = await loadFacts(sql, viewer)
  assert.equal(position(open[0], civilDate("2026-11-16")).open, 0)
  const tooMuch = await applyReceipt(sql, viewer, parcel, {
    idempotencyKey: receiptKey("pay-extra"),
    amount: positiveCentavos(1),
    method: "pix",
    confirmedOn: civilDate("2026-11-16"),
  })
  assert.deepEqual(tooMuch, { kind: "reject", reason: "exceeds_open" })
  const firstReceipt = open[0].receipts[0]
  assert.equal(firstReceipt.kind, "confirmed")
  if (firstReceipt.kind !== "confirmed") return
  const undone = await applyReversal(sql, viewer, firstReceipt.receipt.id, civilDate("2026-11-16"))
  const again = await applyReversal(sql, viewer, firstReceipt.receipt.id, civilDate("2026-11-17"))
  assert.equal(undone.kind, "appended")
  assert.equal(again.kind, "replay")
  if (again.kind !== "replay") return
  assert.equal(position(again.facts, civilDate("2026-11-16")).open, 100)
  await sql.close()
  await rm(dir, { recursive: true, force: true })
})

test("a contract period materializes once and a future month is refused", async () => {
  const { sql, dir, viewer, client } = await book()
  const contract = await insertContract(
    sql,
    viewer,
    contractKey("ct-1"),
    clientId(client),
    "Mensalidade",
    positiveCentavos(15_000),
    dueDay(5),
    civilDate("2026-11-20"),
  )
  assert.ok("agreement" in contract)
  assert.equal((await loadFacts(sql, viewer)).length, 0)
  const early = await materialize(sql, viewer, contract.agreement.id, periodKey("2026-11"), civilDate("2026-12-01"))
  assert.deepEqual(early, { reject: "period_not_due" })
  const first = await materialize(sql, viewer, contract.agreement.id, periodKey("2026-12"), civilDate("2026-12-01"))
  const second = await materialize(sql, viewer, contract.agreement.id, periodKey("2026-12"), civilDate("2026-12-01"))
  assert.ok("installment" in first && "installment" in second)
  assert.equal(first.replayed, false)
  assert.equal(second.replayed, true)
  assert.equal(first.installment.id, second.installment.id)
  assert.equal((await loadFacts(sql, viewer)).length, 1)
  await sql.close()
  await rm(dir, { recursive: true, force: true })
})

test("another viewer cannot see the book", async () => {
  const { sql, dir, viewer, client } = await book()
  const plan = planCrediario(positiveCentavos(1_000), installmentCount(1), civilDate("2026-11-01"))
  assert.ok(Array.isArray(plan))
  await insertCrediario(
    sql,
    viewer,
    crediarioKey("sale-4"),
    clientId(client),
    "Privado",
    plan,
    positiveCentavos(1_000),
    installmentCount(1),
    civilDate("2026-11-01"),
  )
  const other = viewerId("production:user:other")
  assert.equal((await loadFacts(sql, other)).length, 0)
  assert.equal((await listClients(sql, other)).length, 0)
  await sql.close()
  await rm(dir, { recursive: true, force: true })
})

test("the file ledger creates a missing data directory", async () => {
  const parent = await mkdtemp(join(tmpdir(), "recebefacil-parent-"))
  const dir = join(parent, "missing", "recebefacil")
  const sql = await openIsolatedLedger(dir)
  const rows = await sql.query<{ filename: string }>("select filename from schema_migration")
  assert.deepEqual(
    rows.map((row) => row.filename),
    ["001_book.sql"],
  )
  await sql.close()
  await rm(parent, { recursive: true, force: true })
})
