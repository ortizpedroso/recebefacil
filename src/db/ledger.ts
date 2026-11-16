import { randomUUID } from "node:crypto"
import type { Sql } from "./driver"
import {
  civilDate,
  clientId,
  confirmed,
  contractId,
  countValue,
  crediarioId,
  decidePeriod,
  decideReceipt,
  decideReversal,
  dueDay,
  dueDayValue,
  installmentCount,
  installmentId,
  periodKey,
  positiveCentavos,
  receiptId,
  receiptKey,
  reversalId,
  sameContract,
  sameCrediario,
  toInteger,
  viewerId,
  voided,
  type CivilDate,
  type Client,
  type ClientId,
  type Contract,
  type ContractId,
  type ContractKey,
  type CountedReceipt,
  type Crediario,
  type CrediarioId,
  type CrediarioKey,
  type DueDay,
  type Installment,
  type InstallmentCount,
  type InstallmentFacts,
  type InstallmentId,
  type Merchant,
  type PeriodKey,
  type PixKey,
  type PlannedInstallment,
  type PositiveCentavos,
  type Receipt,
  type ReceiptCommand,
  type ReceiptMethod,
  type Reversal,
  type TaxId,
  type ViewerId,
} from "../domain/money"

type Row = Record<string, unknown>

function readText(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) throw new Error("text")
  return value
}

function readInt(value: unknown): number {
  if (typeof value === "number" && Number.isInteger(value)) return value
  if (typeof value === "bigint" && value <= BigInt(Number.MAX_SAFE_INTEGER) && value >= BigInt(Number.MIN_SAFE_INTEGER)) {
    return Number(value)
  }
  if (typeof value === "string" && /^-?\d+$/.test(value)) {
    const n = Number(value)
    if (Number.isSafeInteger(n)) return n
  }
  throw new Error("int")
}

function readCivil(value: unknown): CivilDate {
  if (value instanceof Date) {
    const year = value.getUTCFullYear()
    const month = String(value.getUTCMonth() + 1).padStart(2, "0")
    const day = String(value.getUTCDate()).padStart(2, "0")
    return civilDate(`${year}-${month}-${day}`)
  }
  if (typeof value === "string") return civilDate(value.slice(0, 10))
  throw new Error("date")
}

function readMethod(value: unknown): ReceiptMethod {
  if (value === "pix" || value === "boleto" || value === "card" || value === "cash" || value === "transfer") return value
  throw new Error("method")
}

function pixValue(key: PixKey): { kind: string; value: string } {
  if (key.kind === "cpf" || key.kind === "cnpj") return { kind: key.kind, value: key.digits }
  if (key.kind === "email") return { kind: "email", value: key.address }
  if (key.kind === "phone") return { kind: "phone", value: key.e164 }
  return { kind: "evp", value: key.id }
}

function readPix(kind: string, value: string): PixKey {
  if (kind === "cpf") return { kind: "cpf", digits: value }
  if (kind === "cnpj") return { kind: "cnpj", digits: value }
  if (kind === "email") return { kind: "email", address: value }
  if (kind === "phone") return { kind: "phone", e164: value }
  if (kind === "evp") return { kind: "evp", id: value }
  throw new Error("pix")
}

function readMerchant(row: Row): Merchant {
  return {
    viewerId: viewerId(readText(row.viewer_id)),
    legalName: readText(row.legal_name),
    pixKey: readPix(readText(row.pix_kind), readText(row.pix_value)),
  }
}

function readClient(row: Row): Client {
  const kind = readText(row.tax_kind)
  const digits = readText(row.tax_digits)
  const taxId: TaxId = kind === "cnpj" ? { kind: "cnpj", digits } : { kind: "cpf", digits }
  return {
    id: clientId(readText(row.id)),
    name: readText(row.name),
    taxId,
    phone: { digits: readText(row.phone_digits) },
  }
}

function readCrediario(row: Row): Crediario {
  return {
    id: crediarioId(readText(row.id)),
    clientId: clientId(readText(row.client_id)),
    description: readText(row.description),
    principal: positiveCentavos(readInt(row.principal_centavos)),
    installmentCount: installmentCount(readInt(row.installment_count)),
    firstDue: readCivil(row.first_due),
  }
}

function readContract(row: Row): Contract {
  return {
    id: contractId(readText(row.id)),
    clientId: clientId(readText(row.client_id)),
    description: readText(row.description),
    amountPerPeriod: positiveCentavos(readInt(row.amount_per_period_centavos)),
    dueDay: dueDay(readInt(row.due_day)),
    openedOn: readCivil(row.opened_on),
  }
}

function readInstallment(row: Row): Installment {
  const crediario = row.crediario_id === null || row.crediario_id === undefined ? null : readText(row.crediario_id)
  const contract = row.contract_id === null || row.contract_id === undefined ? null : readText(row.contract_id)
  const parent = crediario
    ? { kind: "crediario" as const, crediarioId: crediarioId(crediario), sequence: readInt(row.sequence) }
    : { kind: "contract" as const, contractId: contractId(readText(contract)), periodKey: periodKey(readText(row.period_key)) }
  return {
    id: installmentId(readText(row.id)),
    principal: positiveCentavos(readInt(row.principal_centavos)),
    dueOn: readCivil(row.due_on),
    parent,
  }
}

function readCounted(row: Row): { installmentId: InstallmentId; counted: CountedReceipt } {
  const receipt: Receipt = {
    id: receiptId(readText(row.id)),
    idempotencyKey: receiptKey(readText(row.idempotency_key)),
    amount: positiveCentavos(readInt(row.amount_centavos)),
    method: readMethod(row.method),
    confirmedOn: readCivil(row.confirmed_on),
  }
  const reversal = row.reversal_id === null || row.reversal_id === undefined
    ? null
    : {
        id: reversalId(readText(row.reversal_id)),
        receiptId: receipt.id,
        reversedOn: readCivil(row.reversed_on),
      }
  return {
    installmentId: installmentId(readText(row.installment_id)),
    counted: reversal ? voided(receipt, reversal) : confirmed(receipt),
  }
}

async function receiptsByInstallment(sql: Sql, viewer: ViewerId): Promise<Map<string, CountedReceipt[]>> {
  const rows = await sql.query<Row>(
    `select r.id, r.installment_id, r.idempotency_key, r.amount_centavos, r.method, r.confirmed_on,
            v.id as reversal_id, v.reversed_on
     from receipt r
     left join reversal v on v.receipt_id = r.id and v.viewer_id = r.viewer_id
     where r.viewer_id = $1
     order by r.confirmed_on, r.id`,
    [viewer],
  )
  const grouped = new Map<string, CountedReceipt[]>()
  for (const row of rows) {
    const item = readCounted(row)
    const list = grouped.get(item.installmentId) ?? []
    list.push(item.counted)
    grouped.set(item.installmentId, list)
  }
  return grouped
}

export async function upsertMerchant(sql: Sql, viewer: ViewerId, legalName: string, pix: PixKey): Promise<Merchant> {
  const stored = pixValue(pix)
  const rows = await sql.query<Row>(
    `insert into merchant (viewer_id, legal_name, pix_kind, pix_value)
     values ($1, $2, $3, $4)
     on conflict (viewer_id) do update set legal_name = excluded.legal_name, pix_kind = excluded.pix_kind, pix_value = excluded.pix_value
     returning viewer_id, legal_name, pix_kind, pix_value`,
    [viewer, legalName, stored.kind, stored.value],
  )
  return readMerchant(rows[0])
}

export async function loadMerchant(sql: Sql, viewer: ViewerId): Promise<Merchant | null> {
  const rows = await sql.query<Row>(
    `select viewer_id, legal_name, pix_kind, pix_value from merchant where viewer_id = $1`,
    [viewer],
  )
  return rows[0] ? readMerchant(rows[0]) : null
}

export async function upsertClient(
  sql: Sql,
  viewer: ViewerId,
  name: string,
  taxId: TaxId,
  phoneDigits: string,
): Promise<Client> {
  const rows = await sql.query<Row>(
    `insert into client (id, viewer_id, name, tax_kind, tax_digits, phone_digits)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (viewer_id, tax_digits) do update set name = excluded.name, phone_digits = excluded.phone_digits
     returning id, name, tax_kind, tax_digits, phone_digits`,
    [randomUUID(), viewer, name, taxId.kind, taxId.digits, phoneDigits],
  )
  return readClient(rows[0])
}

export async function listClients(sql: Sql, viewer: ViewerId): Promise<Client[]> {
  const rows = await sql.query<Row>(
    `select id, name, tax_kind, tax_digits, phone_digits from client where viewer_id = $1 order by name, id`,
    [viewer],
  )
  return rows.map(readClient)
}

export async function insertCrediario(
  sql: Sql,
  viewer: ViewerId,
  key: CrediarioKey,
  owner: ClientId,
  description: string,
  plan: readonly PlannedInstallment[],
  total: PositiveCentavos,
  count: InstallmentCount,
  firstDue: CivilDate,
): Promise<
  | { agreement: Crediario; installments: Installment[]; replayed: boolean }
  | { conflict: true }
  | { missingClient: true }
> {
  return sql.transaction(async (tx) => {
    const client = await tx.query(`select id from client where id = $1 and viewer_id = $2`, [owner, viewer])
    if (client.length === 0) return { missingClient: true }
    const id = randomUUID()
    const inserted = await tx.query(
      `insert into crediario (id, viewer_id, client_id, idempotency_key, description, principal_centavos, installment_count, first_due)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       on conflict (viewer_id, idempotency_key) do nothing
       returning id`,
      [id, viewer, owner, key, description, toInteger(total), countValue(count), firstDue],
    )
    if (inserted.length === 0) {
      const rows = await tx.query<Row>(
        `select id, client_id, description, principal_centavos, installment_count, first_due from crediario where viewer_id = $1 and idempotency_key = $2`,
        [viewer, key],
      )
      const stored = readCrediario(rows[0])
      if (!sameCrediario(stored, owner, description, total, count, firstDue)) return { conflict: true }
      const installments = await tx.query<Row>(
        `select id, crediario_id, contract_id, sequence, period_key, principal_centavos, due_on
         from installment where viewer_id = $1 and crediario_id = $2 order by sequence`,
        [viewer, stored.id],
      )
      return { agreement: stored, installments: installments.map(readInstallment), replayed: true }
    }
    const installments: Installment[] = []
    for (const row of plan) {
      const parcelId = randomUUID()
      await tx.query(
        `insert into installment (id, viewer_id, crediario_id, contract_id, sequence, period_key, principal_centavos, due_on)
         values ($1, $2, $3, null, $4, null, $5, $6)`,
        [parcelId, viewer, id, row.sequence, toInteger(row.amount), row.dueOn],
      )
      installments.push({
        id: installmentId(parcelId),
        principal: row.amount,
        dueOn: row.dueOn,
        parent: { kind: "crediario", crediarioId: crediarioId(id), sequence: row.sequence },
      })
    }
    return {
      agreement: {
        id: crediarioId(id),
        clientId: owner,
        description,
        principal: total,
        installmentCount: count,
        firstDue,
      },
      installments,
      replayed: false,
    }
  })
}

export async function insertContract(
  sql: Sql,
  viewer: ViewerId,
  key: ContractKey,
  owner: ClientId,
  description: string,
  amountPerPeriod: PositiveCentavos,
  day: DueDay,
  openedOn: CivilDate,
): Promise<{ agreement: Contract; replayed: boolean } | { conflict: true } | { missingClient: true }> {
  return sql.transaction(async (tx) => {
    const client = await tx.query(`select id from client where id = $1 and viewer_id = $2`, [owner, viewer])
    if (client.length === 0) return { missingClient: true }
    const id = randomUUID()
    const inserted = await tx.query(
      `insert into contract (id, viewer_id, client_id, idempotency_key, description, amount_per_period_centavos, due_day, opened_on)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       on conflict (viewer_id, idempotency_key) do nothing
       returning id`,
      [id, viewer, owner, key, description, toInteger(amountPerPeriod), dueDayValue(day), openedOn],
    )
    if (inserted.length === 0) {
      const rows = await tx.query<Row>(
        `select id, client_id, description, amount_per_period_centavos, due_day, opened_on
         from contract where viewer_id = $1 and idempotency_key = $2`,
        [viewer, key],
      )
      const stored = readContract(rows[0])
      if (!sameContract(stored, owner, description, amountPerPeriod, day, openedOn)) return { conflict: true }
      return { agreement: stored, replayed: true }
    }
    return {
      agreement: {
        id: contractId(id),
        clientId: owner,
        description,
        amountPerPeriod,
        dueDay: day,
        openedOn,
      },
      replayed: false,
    }
  })
}

async function loadOne(sql: Sql, viewer: ViewerId, id: InstallmentId): Promise<InstallmentFacts | null> {
  const rows = await sql.query<Row>(
    `select i.id, i.crediario_id, i.contract_id, i.sequence, i.period_key, i.principal_centavos, i.due_on,
            coalesce(cr.client_id, ct.client_id) as client_id, c.name as client_name
     from installment i
     left join crediario cr on cr.id = i.crediario_id
     left join contract ct on ct.id = i.contract_id
     join client c on c.id = coalesce(cr.client_id, ct.client_id)
     where i.id = $1 and i.viewer_id = $2`,
    [id, viewer],
  )
  const row = rows[0]
  if (!row) return null
  const grouped = await receiptsByInstallment(sql, viewer)
  return {
    clientId: clientId(readText(row.client_id)),
    clientName: readText(row.client_name),
    installment: readInstallment(row),
    receipts: grouped.get(id) ?? [],
  }
}

export async function materialize(
  sql: Sql,
  viewer: ViewerId,
  id: ContractId,
  period: PeriodKey,
  today: CivilDate,
): Promise<
  | { installment: Installment; replayed: boolean }
  | { notFound: true }
  | { reject: "period_not_due" }
> {
  return sql.transaction(async (tx) => {
    const rows = await tx.query<Row>(
      `select id, client_id, description, amount_per_period_centavos, due_day, opened_on
       from contract where id = $1 and viewer_id = $2 for update`,
      [id, viewer],
    )
    if (!rows[0]) return { notFound: true }
    const contract = readContract(rows[0])
    const existing = await tx.query<Row>(
      `select id, crediario_id, contract_id, sequence, period_key, principal_centavos, due_on
       from installment where viewer_id = $1 and contract_id = $2 and period_key = $3`,
      [viewer, id, period],
    )
    const decision = decidePeriod(contract, period, existing.length > 0, today)
    if (decision.kind === "reject") return { reject: decision.reason }
    if (decision.kind === "replay") return { installment: readInstallment(existing[0]), replayed: true }
    const parcelId = randomUUID()
    const inserted = await tx.query(
      `insert into installment (id, viewer_id, crediario_id, contract_id, sequence, period_key, principal_centavos, due_on)
       values ($1, $2, null, $3, null, $4, $5, $6)
       on conflict (contract_id, period_key) where contract_id is not null do nothing
       returning id`,
      [parcelId, viewer, id, period, toInteger(decision.draft.principal), decision.draft.dueOn],
    )
    if (inserted.length === 0) {
      const again = await tx.query<Row>(
        `select id, crediario_id, contract_id, sequence, period_key, principal_centavos, due_on
         from installment where viewer_id = $1 and contract_id = $2 and period_key = $3`,
        [viewer, id, period],
      )
      return { installment: readInstallment(again[0]), replayed: true }
    }
    return {
      installment: {
        id: installmentId(parcelId),
        principal: decision.draft.principal,
        dueOn: decision.draft.dueOn,
        parent: { kind: "contract", contractId: id, periodKey: period },
      },
      replayed: false,
    }
  })
}

export async function applyReceipt(
  sql: Sql,
  viewer: ViewerId,
  id: InstallmentId,
  command: ReceiptCommand,
): Promise<
  | { kind: "replay" | "appended"; receipt: Receipt; facts: InstallmentFacts }
  | { kind: "conflict" }
  | { kind: "reject"; reason: "exceeds_open" }
  | { kind: "not_found" }
> {
  return sql.transaction(async (tx) => {
    const locked = await tx.query(`select id from installment where id = $1 and viewer_id = $2 for update`, [id, viewer])
    if (locked.length === 0) return { kind: "not_found" }
    const facts = await loadOne(tx, viewer, id)
    if (!facts) return { kind: "not_found" }
    const decision = decideReceipt(facts, command)
    if (decision.kind === "replay") return { kind: "replay", receipt: decision.receipt, facts }
    if (decision.kind === "conflict") return { kind: "conflict" }
    if (decision.kind === "reject") return { kind: "reject", reason: "exceeds_open" }
    const receiptRowId = randomUUID()
    const inserted = await tx.query(
      `insert into receipt (id, viewer_id, installment_id, idempotency_key, amount_centavos, method, confirmed_on)
       values ($1, $2, $3, $4, $5, $6, $7)
       on conflict (viewer_id, idempotency_key) do nothing
       returning id`,
      [
        receiptRowId,
        viewer,
        id,
        command.idempotencyKey,
        toInteger(command.amount),
        command.method,
        command.confirmedOn,
      ],
    )
    if (inserted.length === 0) return { kind: "conflict" }
    const next = await loadOne(tx, viewer, id)
    if (!next) throw new Error("installment missing after receipt")
    const stored = next.receipts.find((item) => item.receipt.id === receiptRowId)?.receipt
    if (!stored) throw new Error("receipt missing after insert")
    return { kind: "appended", receipt: stored, facts: next }
  })
}

export async function applyReversal(
  sql: Sql,
  viewer: ViewerId,
  id: string,
  today: CivilDate,
): Promise<
  | { kind: "replay" | "appended"; reversal: Reversal; facts: InstallmentFacts }
  | { kind: "not_found" }
> {
  return sql.transaction(async (tx) => {
    const found = await tx.query<Row>(
      `select installment_id from receipt where id = $1 and viewer_id = $2`,
      [id, viewer],
    )
    if (!found[0]) return { kind: "not_found" }
    const parcel = installmentId(readText(found[0].installment_id))
    await tx.query(`select id from installment where id = $1 and viewer_id = $2 for update`, [parcel, viewer])
    const facts = await loadOne(tx, viewer, parcel)
    if (!facts) return { kind: "not_found" }
    const decision = decideReversal(facts, { receiptId: receiptId(id), reversedOn: today })
    if (decision.kind === "missing") return { kind: "not_found" }
    if (decision.kind === "replay") return { kind: "replay", reversal: decision.reversal, facts }
    const reversalRowId = randomUUID()
    const inserted = await tx.query(
      `insert into reversal (id, viewer_id, receipt_id, reversed_on)
       values ($1, $2, $3, $4)
       on conflict (receipt_id) do nothing
       returning id`,
      [reversalRowId, viewer, id, today],
    )
    const next = await loadOne(tx, viewer, parcel)
    if (!next) throw new Error("installment missing after reversal")
    if (inserted.length === 0) {
      const existing = next.receipts.find((item) => item.receipt.id === id)
      if (!existing || existing.kind !== "voided") throw new Error("reversal missing")
      return { kind: "replay", reversal: existing.reversal, facts: next }
    }
    const stored = next.receipts.find((item) => item.receipt.id === id)
    if (!stored || stored.kind !== "voided") throw new Error("reversal missing after insert")
    return { kind: "appended", reversal: stored.reversal, facts: next }
  })
}

export async function loadFacts(sql: Sql, viewer: ViewerId): Promise<InstallmentFacts[]> {
  const rows = await sql.query<Row>(
    `select i.id, i.crediario_id, i.contract_id, i.sequence, i.period_key, i.principal_centavos, i.due_on,
            coalesce(cr.client_id, ct.client_id) as client_id, c.name as client_name
     from installment i
     left join crediario cr on cr.id = i.crediario_id
     left join contract ct on ct.id = i.contract_id
     join client c on c.id = coalesce(cr.client_id, ct.client_id)
     where i.viewer_id = $1
     order by i.due_on, i.id`,
    [viewer],
  )
  const grouped = await receiptsByInstallment(sql, viewer)
  return rows.map((row) => {
    const installment = readInstallment(row)
    return {
      clientId: clientId(readText(row.client_id)),
      clientName: readText(row.client_name),
      installment,
      receipts: grouped.get(installment.id) ?? [],
    }
  })
}

export async function loadClientBook(
  sql: Sql,
  viewer: ViewerId,
  id: ClientId,
): Promise<{ client: Client; crediarios: Crediario[]; contracts: Contract[]; installments: InstallmentFacts[] } | null> {
  const clients = await sql.query<Row>(
    `select id, name, tax_kind, tax_digits, phone_digits from client where id = $1 and viewer_id = $2`,
    [id, viewer],
  )
  if (!clients[0]) return null
  const crediarios = await sql.query<Row>(
    `select id, client_id, description, principal_centavos, installment_count, first_due
     from crediario where viewer_id = $1 and client_id = $2 order by first_due, id`,
    [viewer, id],
  )
  const contracts = await sql.query<Row>(
    `select id, client_id, description, amount_per_period_centavos, due_day, opened_on
     from contract where viewer_id = $1 and client_id = $2 order by opened_on, id`,
    [viewer, id],
  )
  const facts = (await loadFacts(sql, viewer)).filter((item) => item.clientId === id)
  return {
    client: readClient(clients[0]),
    crediarios: crediarios.map(readCrediario),
    contracts: contracts.map(readContract),
    installments: facts,
  }
}

export async function contractPeriods(sql: Sql, viewer: ViewerId, id: ContractId): Promise<PeriodKey[]> {
  const rows = await sql.query<Row>(
    `select period_key from installment where viewer_id = $1 and contract_id = $2 and period_key is not null order by period_key`,
    [viewer, id],
  )
  return rows.map((row) => periodKey(readText(row.period_key)))
}
