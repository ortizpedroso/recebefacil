import "server-only"
import { collectionText as buildCollection } from "./domain/collection"
import {
  clientId,
  contractId,
  contractKey,
  crediarioKey,
  foldBook,
  generatablePeriods,
  installmentId,
  parseCivilDate,
  parseCount,
  parseDescription,
  parseDueDay,
  parseMethod,
  parseName,
  parsePeriodKey,
  parsePhone,
  parsePixKey,
  parseReais,
  parseTaxId,
  planCrediario,
  position,
  presentInstallment,
  receiptId,
  receiptKey,
  todayInSaoPaulo,
  toInteger,
  type Centavos,
  type CivilDate,
  type Client,
  type Contract,
  type Crediario,
  type DueSoonItem,
  type InstallmentView,
  type Merchant,
  type PeriodKey,
  type Position,
  type ReceiptMethod,
} from "./domain/money"
import { openLedger } from "./db/driver"
import {
  applyReceipt,
  applyReversal,
  contractPeriods,
  insertContract,
  insertCrediario,
  listClients as listClientRows,
  loadClientBook,
  loadFacts,
  loadMerchant,
  materialize,
  upsertClient,
  upsertMerchant,
} from "./db/ledger"
import { currentViewer } from "./viewer"

export type { InstallmentView }

export type Dashboard = {
  readonly merchant: Merchant | null
  readonly openCentavos: Centavos
  readonly overdueCentavos: Centavos
  readonly receivedThisMonthCentavos: Centavos
  readonly dueSoon: readonly DueSoonItem[]
  readonly asOf: CivilDate
}

export type BookErrorCode =
  | "invalid_name"
  | "invalid_tax_id"
  | "invalid_phone"
  | "invalid_pix"
  | "invalid_principal"
  | "invalid_count"
  | "invalid_date"
  | "invalid_method"
  | "invalid_key"
  | "invalid_description"
  | "invalid_due_day"
  | "client_not_found"
  | "agreement_not_found"
  | "period_not_due"
  | "installment_not_found"
  | "exceeds_open"
  | "closed"
  | "idempotency_conflict"
  | "merchant_missing"
  | "receipt_not_found"
  | "signed_out"

export type BookError = { readonly code: BookErrorCode }
export type BookResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: BookError }

export type ClientPage = {
  readonly client: Client
  readonly openCentavos: number
  readonly crediarios: readonly { readonly agreement: Crediario; readonly installments: readonly InstallmentView[] }[]
  readonly contracts: readonly {
    readonly agreement: Contract
    readonly installments: readonly InstallmentView[]
    readonly generatable: readonly PeriodKey[]
  }[]
}

export type ReceiptLine = {
  readonly id: string
  readonly amount: number
  readonly method: ReceiptMethod
  readonly confirmedOn: string
  readonly reversed: boolean
}

export type InstallmentPage = {
  readonly view: InstallmentView
  readonly clientName: string
  readonly clientId: string
  readonly receipts: readonly ReceiptLine[]
  readonly pixPayload: string | null
  readonly whatsAppUrl: string | null
  readonly message: string | null
  readonly notice: "pix_manual" | "closed" | "merchant_missing"
}

function fail(code: BookErrorCode): BookResult<never> {
  return { ok: false, error: { code } }
}

function today() {
  return todayInSaoPaulo(new Date())
}

export async function saveMerchant(input: { legalName: unknown; pixKey: unknown }): Promise<BookResult<Merchant>> {
  const viewer = await currentViewer()
  if (!viewer) return fail("signed_out")
  const legalName = parseName(input.legalName)
  if (!legalName) return fail("invalid_name")
  const pixKey = parsePixKey(input.pixKey)
  if (!pixKey) return fail("invalid_pix")
  const merchant = await upsertMerchant(await openLedger(), viewer, legalName, pixKey)
  return { ok: true, value: merchant }
}

export async function company(): Promise<BookResult<Merchant | null>> {
  const viewer = await currentViewer()
  if (!viewer) return fail("signed_out")
  return { ok: true, value: await loadMerchant(await openLedger(), viewer) }
}

export async function saveClient(input: {
  name: unknown
  taxId: unknown
  phone: unknown
}): Promise<BookResult<Client>> {
  const viewer = await currentViewer()
  if (!viewer) return fail("signed_out")
  const sql = await openLedger()
  if (!(await loadMerchant(sql, viewer))) return fail("merchant_missing")
  const name = parseName(input.name)
  if (!name) return fail("invalid_name")
  const taxId = parseTaxId(input.taxId)
  if (!taxId) return fail("invalid_tax_id")
  const phone = parsePhone(input.phone)
  if (!phone) return fail("invalid_phone")
  return { ok: true, value: await upsertClient(sql, viewer, name, taxId, phone.digits) }
}

export async function clients(): Promise<BookResult<readonly Client[]>> {
  const viewer = await currentViewer()
  if (!viewer) return fail("signed_out")
  return { ok: true, value: await listClientRows(await openLedger(), viewer) }
}

export async function recordCrediario(input: {
  idempotencyKey: unknown
  clientId: unknown
  description: unknown
  principalReais: unknown
  installmentCount: unknown
  firstDue: unknown
}): Promise<BookResult<{ replayed: boolean }>> {
  const viewer = await currentViewer()
  if (!viewer) return fail("signed_out")
  const keyText = typeof input.idempotencyKey === "string" ? input.idempotencyKey.trim() : ""
  if (keyText.length < 1 || keyText.length > 80) return fail("invalid_key")
  const ownerText = typeof input.clientId === "string" ? input.clientId.trim() : ""
  if (ownerText.length < 1 || ownerText.length > 80) return fail("client_not_found")
  const description = parseDescription(input.description)
  if (!description) return fail("invalid_description")
  const principal = parseReais(input.principalReais)
  if (!principal) return fail("invalid_principal")
  const count = parseCount(input.installmentCount)
  if (!count) return fail("invalid_count")
  const firstDue = parseCivilDate(input.firstDue)
  if (!firstDue) return fail("invalid_date")
  const plan = planCrediario(principal, count, firstDue)
  if ("code" in plan) return fail("invalid_count")
  const sql = await openLedger()
  if (!(await loadMerchant(sql, viewer))) return fail("merchant_missing")
  const stored = await insertCrediario(
    sql,
    viewer,
    crediarioKey(keyText),
    clientId(ownerText),
    description,
    plan,
    principal,
    count,
    firstDue,
  )
  if ("missingClient" in stored) return fail("client_not_found")
  if ("conflict" in stored) return fail("idempotency_conflict")
  return { ok: true, value: { replayed: stored.replayed } }
}

export async function recordContract(input: {
  idempotencyKey: unknown
  clientId: unknown
  description: unknown
  amountReais: unknown
  dueDay: unknown
  openedOn: unknown
}): Promise<BookResult<{ replayed: boolean }>> {
  const viewer = await currentViewer()
  if (!viewer) return fail("signed_out")
  const keyText = typeof input.idempotencyKey === "string" ? input.idempotencyKey.trim() : ""
  if (keyText.length < 1 || keyText.length > 80) return fail("invalid_key")
  const ownerText = typeof input.clientId === "string" ? input.clientId.trim() : ""
  if (ownerText.length < 1 || ownerText.length > 80) return fail("client_not_found")
  const description = parseDescription(input.description)
  if (!description) return fail("invalid_description")
  const amount = parseReais(input.amountReais)
  if (!amount) return fail("invalid_principal")
  const day = parseDueDay(input.dueDay)
  if (!day) return fail("invalid_due_day")
  const openedOn = parseCivilDate(input.openedOn)
  if (!openedOn) return fail("invalid_date")
  const sql = await openLedger()
  if (!(await loadMerchant(sql, viewer))) return fail("merchant_missing")
  const stored = await insertContract(
    sql,
    viewer,
    contractKey(keyText),
    clientId(ownerText),
    description,
    amount,
    day,
    openedOn,
  )
  if ("missingClient" in stored) return fail("client_not_found")
  if ("conflict" in stored) return fail("idempotency_conflict")
  return { ok: true, value: { replayed: stored.replayed } }
}

export async function materializePeriod(input: {
  contractId: unknown
  periodKey: unknown
}): Promise<BookResult<{ replayed: boolean }>> {
  const viewer = await currentViewer()
  if (!viewer) return fail("signed_out")
  const idText = typeof input.contractId === "string" ? input.contractId.trim() : ""
  if (idText.length < 1 || idText.length > 80) return fail("agreement_not_found")
  const period = parsePeriodKey(input.periodKey)
  if (!period) return fail("period_not_due")
  const stored = await materialize(await openLedger(), viewer, contractId(idText), period, today())
  if ("notFound" in stored) return fail("agreement_not_found")
  if ("reject" in stored) return fail("period_not_due")
  return { ok: true, value: { replayed: stored.replayed } }
}

export async function confirmReceipt(input: {
  idempotencyKey: unknown
  installmentId: unknown
  amountReais: unknown
  method: unknown
  confirmedOn: unknown
}): Promise<BookResult<{ replayed: boolean; position: Position }>> {
  const viewer = await currentViewer()
  if (!viewer) return fail("signed_out")
  const keyText = typeof input.idempotencyKey === "string" ? input.idempotencyKey.trim() : ""
  if (keyText.length < 1 || keyText.length > 80) return fail("invalid_key")
  const idText = typeof input.installmentId === "string" ? input.installmentId.trim() : ""
  if (idText.length < 1 || idText.length > 80) return fail("installment_not_found")
  const amount = parseReais(input.amountReais)
  if (!amount) return fail("invalid_principal")
  const method = parseMethod(input.method)
  if (!method) return fail("invalid_method")
  const confirmedOn = parseCivilDate(input.confirmedOn)
  if (!confirmedOn) return fail("invalid_date")
  const stored = await applyReceipt(await openLedger(), viewer, installmentId(idText), {
    idempotencyKey: receiptKey(keyText),
    amount,
    method,
    confirmedOn,
  })
  if (stored.kind === "not_found") return fail("installment_not_found")
  if (stored.kind === "conflict") return fail("idempotency_conflict")
  if (stored.kind === "reject") return fail("exceeds_open")
  return { ok: true, value: { replayed: stored.kind === "replay", position: position(stored.facts, today()) } }
}

export async function reverseReceipt(input: { receiptId: unknown }): Promise<BookResult<{ replayed: boolean }>> {
  const viewer = await currentViewer()
  if (!viewer) return fail("signed_out")
  const idText = typeof input.receiptId === "string" ? input.receiptId.trim() : ""
  if (idText.length < 1 || idText.length > 80) return fail("receipt_not_found")
  const stored = await applyReversal(await openLedger(), viewer, receiptId(idText), today())
  if (stored.kind === "not_found") return fail("receipt_not_found")
  return { ok: true, value: { replayed: stored.kind === "replay" } }
}

export async function openDashboard(): Promise<BookResult<Dashboard>> {
  const viewer = await currentViewer()
  if (!viewer) return fail("signed_out")
  const sql = await openLedger()
  const asOf = today()
  const folded = foldBook(await loadFacts(sql, viewer), asOf)
  const dueSoon: DueSoonItem[] = folded.dueSoon.map((facts) => ({
    ...presentInstallment(facts, asOf),
    clientId: facts.clientId,
    clientName: facts.clientName,
  }))
  return {
    ok: true,
    value: {
      merchant: await loadMerchant(sql, viewer),
      openCentavos: folded.open,
      overdueCentavos: folded.overdue,
      receivedThisMonthCentavos: folded.receivedThisMonth,
      dueSoon,
      asOf,
    },
  }
}

export async function clientPage(rawId: unknown): Promise<BookResult<ClientPage>> {
  const viewer = await currentViewer()
  if (!viewer) return fail("signed_out")
  const idText = typeof rawId === "string" ? rawId.trim() : ""
  if (idText.length < 1 || idText.length > 80) return fail("client_not_found")
  const sql = await openLedger()
  const loaded = await loadClientBook(sql, viewer, clientId(idText))
  if (!loaded) return fail("client_not_found")
  const asOf = today()
  const views = loaded.installments.map((facts) => ({
    facts,
    view: presentInstallment(facts, asOf),
  }))
  const crediarios = loaded.crediarios.map((agreement) => ({
    agreement,
    installments: views
      .filter((item) => item.facts.installment.parent.kind === "crediario" && item.facts.installment.parent.crediarioId === agreement.id)
      .map((item) => item.view),
  }))
  const contracts = []
  for (const agreement of loaded.contracts) {
    const stored = await contractPeriods(sql, viewer, agreement.id)
    contracts.push({
      agreement,
      installments: views
        .filter((item) => item.facts.installment.parent.kind === "contract" && item.facts.installment.parent.contractId === agreement.id)
        .map((item) => item.view),
      generatable: generatablePeriods(agreement, stored, asOf),
    })
  }
  const openCentavos = views.reduce((sum, item) => sum + toInteger(item.view.openCentavos), 0)
  return { ok: true, value: { client: loaded.client, openCentavos, crediarios, contracts } }
}

export async function installmentPage(rawId: unknown): Promise<BookResult<InstallmentPage>> {
  const viewer = await currentViewer()
  if (!viewer) return fail("signed_out")
  const idText = typeof rawId === "string" ? rawId.trim() : ""
  if (idText.length < 1 || idText.length > 80) return fail("installment_not_found")
  const sql = await openLedger()
  const facts = (await loadFacts(sql, viewer)).find((item) => item.installment.id === idText)
  if (!facts) return fail("installment_not_found")
  const asOf = today()
  const view = presentInstallment(facts, asOf)
  const merchant = await loadMerchant(sql, viewer)
  const client = (await loadClientBook(sql, viewer, facts.clientId))?.client
  let notice: InstallmentPage["notice"] = "pix_manual"
  let pixPayload: string | null = null
  let whatsAppUrl: string | null = null
  let message: string | null = null
  if (!merchant) notice = "merchant_missing"
  else if (!client || view.situation === "settled") notice = view.situation === "settled" ? "closed" : "merchant_missing"
  else {
    const kit = buildCollection({ merchant, clientName: client.name, phone: client.phone, installment: view, today: asOf })
    if ("code" in kit) notice = "closed"
    else {
      pixPayload = kit.pixPayload
      whatsAppUrl = kit.whatsAppUrl
      message = kit.message
    }
  }
  return {
    ok: true,
    value: {
      view,
      clientName: facts.clientName,
      clientId: facts.clientId,
      receipts: facts.receipts.map((item) => ({
        id: item.receipt.id,
        amount: toInteger(item.receipt.amount),
        method: item.receipt.method,
        confirmedOn: item.receipt.confirmedOn,
        reversed: item.kind === "voided",
      })),
      pixPayload,
      whatsAppUrl,
      message,
      notice,
    },
  }
}
