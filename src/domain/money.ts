declare const centavosBrand: unique symbol
declare const positiveBrand: unique symbol
declare const civilDateBrand: unique symbol
declare const periodKeyBrand: unique symbol
declare const viewerBrand: unique symbol
declare const clientBrand: unique symbol
declare const crediarioBrand: unique symbol
declare const contractBrand: unique symbol
declare const installmentBrand: unique symbol
declare const receiptBrand: unique symbol
declare const reversalBrand: unique symbol
declare const crediarioKeyBrand: unique symbol
declare const contractKeyBrand: unique symbol
declare const receiptKeyBrand: unique symbol
declare const countBrand: unique symbol
declare const dueDayBrand: unique symbol

const MAX_CENTS = 9_007_199_254_740_991

export type Centavos = number & { readonly [centavosBrand]: true }
export type PositiveCentavos = Centavos & { readonly [positiveBrand]: true }
export type CivilDate = string & { readonly [civilDateBrand]: true }
export type PeriodKey = string & { readonly [periodKeyBrand]: true }
export type ViewerId = string & { readonly [viewerBrand]: true }
export type ClientId = string & { readonly [clientBrand]: true }
export type CrediarioId = string & { readonly [crediarioBrand]: true }
export type ContractId = string & { readonly [contractBrand]: true }
export type InstallmentId = string & { readonly [installmentBrand]: true }
export type ReceiptId = string & { readonly [receiptBrand]: true }
export type ReversalId = string & { readonly [reversalBrand]: true }
export type CrediarioKey = string & { readonly [crediarioKeyBrand]: true }
export type ContractKey = string & { readonly [contractKeyBrand]: true }
export type ReceiptKey = string & { readonly [receiptKeyBrand]: true }
export type InstallmentCount = number & { readonly [countBrand]: true }
export type DueDay = number & { readonly [dueDayBrand]: true }

export type ReceiptMethod = "pix" | "boleto" | "card" | "cash" | "transfer"
export type Situation = "open" | "overdue" | "settled"

export type Schedule = { readonly parts: readonly PositiveCentavos[] }

export type TaxId =
  | { readonly kind: "cpf"; readonly digits: string }
  | { readonly kind: "cnpj"; readonly digits: string }

export type Phone = { readonly digits: string }

export type PixKey =
  | { readonly kind: "cpf"; readonly digits: string }
  | { readonly kind: "cnpj"; readonly digits: string }
  | { readonly kind: "email"; readonly address: string }
  | { readonly kind: "phone"; readonly e164: string }
  | { readonly kind: "evp"; readonly id: string }

export type Merchant = {
  readonly viewerId: ViewerId
  readonly legalName: string
  readonly pixKey: PixKey
}

export type Client = {
  readonly id: ClientId
  readonly name: string
  readonly taxId: TaxId
  readonly phone: Phone
}

export type Crediario = {
  readonly id: CrediarioId
  readonly clientId: ClientId
  readonly description: string
  readonly principal: PositiveCentavos
  readonly installmentCount: InstallmentCount
  readonly firstDue: CivilDate
}

export type Contract = {
  readonly id: ContractId
  readonly clientId: ClientId
  readonly description: string
  readonly amountPerPeriod: PositiveCentavos
  readonly dueDay: DueDay
  readonly openedOn: CivilDate
}

export type InstallmentParent =
  | { readonly kind: "crediario"; readonly crediarioId: CrediarioId; readonly sequence: number }
  | { readonly kind: "contract"; readonly contractId: ContractId; readonly periodKey: PeriodKey }

export type Installment = {
  readonly id: InstallmentId
  readonly principal: PositiveCentavos
  readonly dueOn: CivilDate
  readonly parent: InstallmentParent
}

export type Receipt = {
  readonly id: ReceiptId
  readonly idempotencyKey: ReceiptKey
  readonly amount: PositiveCentavos
  readonly method: ReceiptMethod
  readonly confirmedOn: CivilDate
}

export type Reversal = {
  readonly id: ReversalId
  readonly receiptId: ReceiptId
  readonly reversedOn: CivilDate
}

export type CountedReceipt =
  | { readonly kind: "confirmed"; readonly receipt: Receipt }
  | { readonly kind: "voided"; readonly receipt: Receipt; readonly reversal: Reversal }

export type InstallmentFacts = {
  readonly clientId: ClientId
  readonly clientName: string
  readonly installment: Installment
  readonly receipts: readonly CountedReceipt[]
}

export type Position = {
  readonly principal: PositiveCentavos
  readonly open: Centavos
  readonly situation: Situation
}

export type InstallmentView = {
  readonly id: InstallmentId
  readonly principal: PositiveCentavos
  readonly openCentavos: Centavos
  readonly dueOn: CivilDate
  readonly situation: Situation
  readonly parent: InstallmentParent
}

export type DueSoonItem = InstallmentView & {
  readonly clientId: ClientId
  readonly clientName: string
}

export type PlannedInstallment = {
  readonly sequence: number
  readonly amount: PositiveCentavos
  readonly dueOn: CivilDate
}

export type ReceiptCommand = {
  readonly idempotencyKey: ReceiptKey
  readonly amount: PositiveCentavos
  readonly method: ReceiptMethod
  readonly confirmedOn: CivilDate
}

export type ReceiptDecision =
  | { readonly kind: "replay"; readonly receipt: Receipt }
  | { readonly kind: "conflict" }
  | { readonly kind: "reject"; readonly reason: "exceeds_open" }
  | { readonly kind: "append"; readonly draft: ReceiptCommand }

export type ReversalDraft = {
  readonly receiptId: ReceiptId
  readonly reversedOn: CivilDate
}

export type ReversalDecision =
  | { readonly kind: "replay"; readonly reversal: Reversal }
  | { readonly kind: "missing" }
  | { readonly kind: "append"; readonly draft: ReversalDraft }

export type PeriodDraft = {
  readonly contractId: ContractId
  readonly periodKey: PeriodKey
  readonly principal: PositiveCentavos
  readonly dueOn: CivilDate
}

export type PeriodDecision =
  | { readonly kind: "replay" }
  | { readonly kind: "reject"; readonly reason: "period_not_due" }
  | { readonly kind: "append"; readonly draft: PeriodDraft }

function isCentavos(n: number): n is Centavos {
  return Number.isInteger(n) && n >= -MAX_CENTS && n <= MAX_CENTS
}

function isPositiveCentavos(n: number): n is PositiveCentavos {
  return Number.isInteger(n) && n >= 1 && n <= MAX_CENTS
}

function isInstallmentCount(n: number): n is InstallmentCount {
  return Number.isInteger(n) && n >= 1 && n <= 60
}

function isDueDay(n: number): n is DueDay {
  return Number.isInteger(n) && n >= 1 && n <= 31
}

function isCivilDate(iso: string): iso is CivilDate {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const utc = new Date(Date.UTC(year, month - 1, day))
  return utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day
}

function isPeriodKey(value: string): value is PeriodKey {
  const match = /^(\d{4})-(\d{2})$/.exec(value)
  if (!match) return false
  const month = Number(match[2])
  return month >= 1 && month <= 12
}

function isBounded(value: string): boolean {
  return value.length >= 1 && value.length <= 80 && !/[\u0000\n\r]/.test(value)
}

function isViewerId(value: string): value is ViewerId {
  return isBounded(value)
}
function isClientId(value: string): value is ClientId {
  return isBounded(value)
}
function isCrediarioId(value: string): value is CrediarioId {
  return isBounded(value)
}
function isContractId(value: string): value is ContractId {
  return isBounded(value)
}
function isInstallmentId(value: string): value is InstallmentId {
  return isBounded(value)
}
function isReceiptId(value: string): value is ReceiptId {
  return isBounded(value)
}
function isReversalId(value: string): value is ReversalId {
  return isBounded(value)
}
function isCrediarioKey(value: string): value is CrediarioKey {
  return isBounded(value)
}
function isContractKey(value: string): value is ContractKey {
  return isBounded(value)
}
function isReceiptKey(value: string): value is ReceiptKey {
  return isBounded(value)
}

function brand<T extends string>(value: string, check: (value: string) => value is T): T {
  if (!check(value)) throw new Error("invalid id")
  return value
}

export function centavos(n: number): Centavos {
  if (!isCentavos(n)) throw new Error("invalid centavos")
  return n
}

export function positiveCentavos(n: number): PositiveCentavos {
  if (!isPositiveCentavos(n)) throw new Error("invalid centavos")
  return n
}

export function installmentCount(n: number): InstallmentCount {
  if (!isInstallmentCount(n)) throw new Error("invalid count")
  return n
}

export function dueDay(n: number): DueDay {
  if (!isDueDay(n)) throw new Error("invalid due day")
  return n
}

export function civilDate(iso: string): CivilDate {
  if (!isCivilDate(iso)) throw new Error("invalid date")
  return iso
}

export function periodKey(ym: string): PeriodKey {
  if (!isPeriodKey(ym)) throw new Error("invalid period")
  return ym
}

export function toInteger(value: Centavos): number {
  if (!isCentavos(value)) throw new Error("invalid centavos")
  return value
}

export function countValue(value: InstallmentCount): number {
  if (!isInstallmentCount(value)) throw new Error("invalid count")
  return value
}

export function dueDayValue(value: DueDay): number {
  if (!isDueDay(value)) throw new Error("invalid due day")
  return value
}

export function viewerId(raw: string): ViewerId {
  return brand(raw.trim(), isViewerId)
}
export function clientId(raw: string): ClientId {
  return brand(raw.trim(), isClientId)
}
export function crediarioId(raw: string): CrediarioId {
  return brand(raw.trim(), isCrediarioId)
}
export function contractId(raw: string): ContractId {
  return brand(raw.trim(), isContractId)
}
export function installmentId(raw: string): InstallmentId {
  return brand(raw.trim(), isInstallmentId)
}
export function receiptId(raw: string): ReceiptId {
  return brand(raw.trim(), isReceiptId)
}
export function reversalId(raw: string): ReversalId {
  return brand(raw.trim(), isReversalId)
}
export function crediarioKey(raw: string): CrediarioKey {
  return brand(raw.trim(), isCrediarioKey)
}
export function contractKey(raw: string): ContractKey {
  return brand(raw.trim(), isContractKey)
}
export function receiptKey(raw: string): ReceiptKey {
  return brand(raw.trim(), isReceiptKey)
}

export function parseKey(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const trimmed = raw.trim()
  return isBounded(trimmed) ? trimmed : null
}

export function parseReais(raw: unknown): PositiveCentavos | null {
  if (typeof raw !== "string") return null
  const trimmed = raw.trim().replace(/\s/g, "")
  const grouped = /^\d{1,3}(\.\d{3})*,\d{1,2}$/.test(trimmed)
  const plain = /^\d+,\d{1,2}$/.test(trimmed)
  const whole = /^\d+$/.test(trimmed)
  if (!grouped && !plain && !whole) return null
  const normalized = trimmed.includes(",") ? trimmed.replace(/\./g, "").replace(",", ".") : trimmed
  const [reaisPart, fracPart] = normalized.split(".")
  if (!reaisPart || !/^\d+$/.test(reaisPart)) return null
  const frac = fracPart === undefined ? "00" : fracPart.length === 1 ? `${fracPart}0` : fracPart
  if (!/^\d{2}$/.test(frac)) return null
  const reais = Number(reaisPart)
  if (!Number.isSafeInteger(reais)) return null
  const total = reais * 100 + Number(frac)
  if (!isPositiveCentavos(total)) return null
  return total
}

export function parseCount(raw: unknown): InstallmentCount | null {
  if (typeof raw !== "string" || !/^\d+$/.test(raw.trim())) return null
  const n = Number(raw.trim())
  return isInstallmentCount(n) ? n : null
}

export function parseDueDay(raw: unknown): DueDay | null {
  if (typeof raw !== "string" || !/^\d+$/.test(raw.trim())) return null
  const n = Number(raw.trim())
  return isDueDay(n) ? n : null
}

export function parseCivilDate(raw: unknown): CivilDate | null {
  if (typeof raw !== "string") return null
  const trimmed = raw.trim()
  return isCivilDate(trimmed) ? trimmed : null
}

export function parsePeriodKey(raw: unknown): PeriodKey | null {
  if (typeof raw !== "string") return null
  const trimmed = raw.trim()
  return isPeriodKey(trimmed) ? trimmed : null
}

function digitsOnly(raw: string): string {
  return raw.replace(/\D/g, "")
}

function checkDigit(base: string, weights: readonly number[]): number {
  let sum = 0
  for (let i = 0; i < weights.length; i++) sum += Number(base[i]) * weights[i]
  const mod = sum % 11
  return mod < 2 ? 0 : 11 - mod
}

function cpfOk(digits: string): boolean {
  if (!/^\d{11}$/.test(digits) || /^(\d)\1+$/.test(digits)) return false
  const first = checkDigit(digits, [10, 9, 8, 7, 6, 5, 4, 3, 2])
  const second = checkDigit(digits, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2])
  return first === Number(digits[9]) && second === Number(digits[10])
}

function cnpjOk(digits: string): boolean {
  if (!/^\d{14}$/.test(digits) || /^(\d)\1+$/.test(digits)) return false
  const first = checkDigit(digits, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  const second = checkDigit(digits, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  return first === Number(digits[12]) && second === Number(digits[13])
}

export function parseTaxId(raw: unknown): TaxId | null {
  if (typeof raw !== "string") return null
  const digits = digitsOnly(raw)
  if (digits.length === 11 && cpfOk(digits)) return { kind: "cpf", digits }
  if (digits.length === 14 && cnpjOk(digits)) return { kind: "cnpj", digits }
  return null
}

export function parsePhone(raw: unknown): Phone | null {
  if (typeof raw !== "string") return null
  let digits = digitsOnly(raw)
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) digits = digits.slice(2)
  if (!/^\d{10,11}$/.test(digits) || digits.startsWith("0")) return null
  return { digits }
}

export function parseName(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const trimmed = raw.trim().replace(/\s+/g, " ")
  if (trimmed.length < 1 || trimmed.length > 80) return null
  return trimmed
}

export function parseDescription(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const trimmed = raw.trim().replace(/\s+/g, " ")
  if (trimmed.length < 1 || trimmed.length > 120) return null
  return trimmed
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function parsePixKey(raw: unknown): PixKey | null {
  if (typeof raw !== "string") return null
  const trimmed = raw.trim()
  if (trimmed.length < 1 || trimmed.length > 77) return null
  if (trimmed.includes("@")) {
    const address = trimmed.toLowerCase()
    return EMAIL.test(address) ? { kind: "email", address } : null
  }
  if (UUID.test(trimmed)) return { kind: "evp", id: trimmed.toLowerCase() }
  const tax = parseTaxId(trimmed)
  if (tax) return tax.kind === "cpf" ? { kind: "cpf", digits: tax.digits } : { kind: "cnpj", digits: tax.digits }
  const phone = parsePhone(trimmed)
  if (phone) return { kind: "phone", e164: `+55${phone.digits}` }
  return null
}

export function parseMethod(raw: unknown): ReceiptMethod | null {
  if (raw === "pix" || raw === "boleto" || raw === "card" || raw === "cash" || raw === "transfer") return raw
  return null
}

export function canonicalPixKey(key: PixKey): string {
  if (key.kind === "cpf" || key.kind === "cnpj") return key.digits
  if (key.kind === "email") return key.address
  if (key.kind === "phone") return key.e164
  return key.id
}

function dateParts(date: CivilDate): { year: number; month: number; day: number } {
  const [year, month, day] = date.split("-").map(Number)
  return { year, month, day }
}

function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta
  const nextYear = Math.floor(index / 12)
  return { year: nextYear, month: index - nextYear * 12 + 1 }
}

function lastDay(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

export function addMonthsClamped(date: CivilDate, months: number): CivilDate {
  if (!Number.isInteger(months)) throw new Error("invalid months")
  const { year, month, day } = dateParts(date)
  const shifted = shiftMonth(year, month, months)
  const dayClamped = Math.min(day, lastDay(shifted.year, shifted.month))
  return civilDate(
    `${shifted.year}-${String(shifted.month).padStart(2, "0")}-${String(dayClamped).padStart(2, "0")}`,
  )
}

export function addDays(date: CivilDate, days: number): CivilDate {
  if (!Number.isInteger(days)) throw new Error("invalid days")
  const { year, month, day } = dateParts(date)
  const utc = new Date(Date.UTC(year, month - 1, day + days))
  const y = utc.getUTCFullYear()
  const m = String(utc.getUTCMonth() + 1).padStart(2, "0")
  const d = String(utc.getUTCDate()).padStart(2, "0")
  return civilDate(`${y}-${m}-${d}`)
}

export function todayInSaoPaulo(now: Date): CivilDate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now)
  const year = parts.find((part) => part.type === "year")?.value
  const month = parts.find((part) => part.type === "month")?.value
  const day = parts.find((part) => part.type === "day")?.value
  if (!year || !month || !day) throw new Error("clock")
  return civilDate(`${year}-${month}-${day}`)
}

export function periodOf(date: CivilDate): PeriodKey {
  return periodKey(date.slice(0, 7))
}

export function dueDate(period: PeriodKey, day: DueDay): CivilDate {
  const [yearText, monthText] = period.split("-")
  const year = Number(yearText)
  const month = Number(monthText)
  const clamped = Math.min(dueDayValue(day), lastDay(year, month))
  return civilDate(`${period}-${String(clamped).padStart(2, "0")}`)
}

function nextPeriod(period: PeriodKey): PeriodKey {
  const [yearText, monthText] = period.split("-")
  const shifted = shiftMonth(Number(yearText), Number(monthText), 1)
  return periodKey(`${shifted.year}-${String(shifted.month).padStart(2, "0")}`)
}

export function splitPrincipal(
  total: PositiveCentavos,
  count: InstallmentCount,
): Schedule | { code: "count_exceeds_principal" } {
  const totalN = toInteger(total)
  const countN = countValue(count)
  const base = Math.floor(totalN / countN)
  if (base < 1) return { code: "count_exceeds_principal" }
  const parts: PositiveCentavos[] = []
  for (let i = 0; i < countN - 1; i++) parts.push(positiveCentavos(base))
  parts.push(positiveCentavos(totalN - base * (countN - 1)))
  const sum = parts.reduce((acc, part) => acc + toInteger(part), 0)
  if (parts.length !== countN || sum !== totalN || parts.some((part) => toInteger(part) < 1)) {
    throw new Error("split")
  }
  return { parts }
}

export function planCrediario(
  total: PositiveCentavos,
  count: InstallmentCount,
  firstDue: CivilDate,
): readonly PlannedInstallment[] | { code: "count_exceeds_principal" } {
  const split = splitPrincipal(total, count)
  if ("code" in split) return split
  return split.parts.map((amount, index) => ({
    sequence: index + 1,
    amount,
    dueOn: addMonthsClamped(firstDue, index),
  }))
}

export function confirmed(receipt: Receipt): CountedReceipt {
  return { kind: "confirmed", receipt }
}

export function voided(receipt: Receipt, reversal: Reversal): CountedReceipt {
  if (reversal.receiptId !== receipt.id) throw new Error("reversal receipt mismatch")
  return { kind: "voided", receipt, reversal }
}

export function position(facts: InstallmentFacts, today: CivilDate): Position {
  let paid = 0
  for (const item of facts.receipts) {
    if (item.kind === "confirmed") paid += toInteger(item.receipt.amount)
  }
  const principal = toInteger(facts.installment.principal)
  if (paid > principal) throw new Error("corrupt ledger")
  const open = centavos(principal - paid)
  const situation: Situation =
    toInteger(open) === 0 ? "settled" : facts.installment.dueOn < today ? "overdue" : "open"
  return { principal: facts.installment.principal, open, situation }
}

export function receivedInMonth(receipts: readonly CountedReceipt[], today: CivilDate): Centavos {
  const month = periodOf(today)
  let sum = 0
  for (const item of receipts) {
    if (periodOf(item.receipt.confirmedOn) === month) sum += toInteger(item.receipt.amount)
    if (item.kind === "voided" && periodOf(item.reversal.reversedOn) === month) {
      sum -= toInteger(item.receipt.amount)
    }
  }
  return centavos(sum)
}

export function foldBook(
  installments: readonly InstallmentFacts[],
  today: CivilDate,
): {
  readonly open: Centavos
  readonly overdue: Centavos
  readonly receivedThisMonth: Centavos
  readonly dueSoon: readonly InstallmentFacts[]
} {
  let open = 0
  let overdue = 0
  let received = 0
  const horizon = addDays(today, 6)
  const dueSoon: InstallmentFacts[] = []
  for (const facts of installments) {
    const placed = position(facts, today)
    const openN = toInteger(placed.open)
    if (openN > 0) open += openN
    if (placed.situation === "overdue") overdue += openN
    received += toInteger(receivedInMonth(facts.receipts, today))
    if (openN > 0 && facts.installment.dueOn >= today && facts.installment.dueOn <= horizon) {
      dueSoon.push(facts)
    }
  }
  dueSoon.sort((a, b) => {
    if (a.installment.dueOn < b.installment.dueOn) return -1
    if (a.installment.dueOn > b.installment.dueOn) return 1
    if (a.installment.id < b.installment.id) return -1
    if (a.installment.id > b.installment.id) return 1
    return 0
  })
  return {
    open: centavos(open),
    overdue: centavos(overdue),
    receivedThisMonth: centavos(received),
    dueSoon,
  }
}

export function presentInstallment(facts: InstallmentFacts, today: CivilDate): InstallmentView {
  const placed = position(facts, today)
  return {
    id: facts.installment.id,
    principal: facts.installment.principal,
    openCentavos: placed.open,
    dueOn: facts.installment.dueOn,
    situation: placed.situation,
    parent: facts.installment.parent,
  }
}

export function decideReceipt(facts: InstallmentFacts, command: ReceiptCommand): ReceiptDecision {
  const existing = facts.receipts.find((item) => item.receipt.idempotencyKey === command.idempotencyKey)
  if (existing) {
    const same =
      existing.receipt.amount === command.amount &&
      existing.receipt.method === command.method &&
      existing.receipt.confirmedOn === command.confirmedOn
    return same ? { kind: "replay", receipt: existing.receipt } : { kind: "conflict" }
  }
  const open = toInteger(position(facts, command.confirmedOn).open)
  if (toInteger(command.amount) > open) return { kind: "reject", reason: "exceeds_open" }
  return { kind: "append", draft: command }
}

export function decideReversal(facts: InstallmentFacts, draft: ReversalDraft): ReversalDecision {
  const found = facts.receipts.find((item) => item.receipt.id === draft.receiptId)
  if (!found) return { kind: "missing" }
  if (found.kind === "voided") return { kind: "replay", reversal: found.reversal }
  return { kind: "append", draft }
}

export function legalPeriods(contract: Contract, today: CivilDate): readonly PeriodKey[] {
  const end = periodOf(today)
  const periods: PeriodKey[] = []
  let cursor = periodOf(contract.openedOn)
  for (let guard = 0; cursor <= end && guard < 600; guard++) {
    if (dueDate(cursor, contract.dueDay) >= contract.openedOn) periods.push(cursor)
    if (cursor === end) break
    cursor = nextPeriod(cursor)
  }
  return periods
}

export function generatablePeriods(
  contract: Contract,
  stored: readonly PeriodKey[],
  today: CivilDate,
): readonly PeriodKey[] {
  const have = new Set(stored)
  return legalPeriods(contract, today).filter((period) => !have.has(period))
}

export function decidePeriod(
  contract: Contract,
  period: PeriodKey,
  alreadyStored: boolean,
  today: CivilDate,
): PeriodDecision {
  if (!legalPeriods(contract, today).includes(period)) return { kind: "reject", reason: "period_not_due" }
  if (alreadyStored) return { kind: "replay" }
  return {
    kind: "append",
    draft: {
      contractId: contract.id,
      periodKey: period,
      principal: contract.amountPerPeriod,
      dueOn: dueDate(period, contract.dueDay),
    },
  }
}

export function sameCrediario(
  stored: Crediario,
  owner: ClientId,
  description: string,
  principal: PositiveCentavos,
  count: InstallmentCount,
  firstDue: CivilDate,
): boolean {
  return (
    stored.clientId === owner &&
    stored.description === description &&
    stored.principal === principal &&
    stored.installmentCount === count &&
    stored.firstDue === firstDue
  )
}

export function sameContract(
  stored: Contract,
  owner: ClientId,
  description: string,
  amountPerPeriod: PositiveCentavos,
  day: DueDay,
  openedOn: CivilDate,
): boolean {
  return (
    stored.clientId === owner &&
    stored.description === description &&
    stored.amountPerPeriod === amountPerPeriod &&
    stored.dueDay === day &&
    stored.openedOn === openedOn
  )
}
