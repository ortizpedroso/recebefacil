import { formatCivilDate, formatReais } from "./format"
import {
  canonicalPixKey,
  positiveCentavos,
  toInteger,
  type CivilDate,
  type InstallmentView,
  type Merchant,
  type Phone,
  type PositiveCentavos,
} from "./money"

export type CollectionText = {
  readonly pixPayload: string
  readonly whatsAppUrl: string
  readonly message: string
}

function tlv(id: string, value: string): string {
  const length = String(Buffer.byteLength(value, "utf8")).padStart(2, "0")
  if (length.length !== 2) throw new Error("tlv")
  return id + length + value
}

export function crc16(payload: string): string {
  let crc = 0xffff
  for (const byte of Buffer.from(payload, "utf8")) {
    crc ^= byte << 8
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0")
}

function amountField(cents: PositiveCentavos): string {
  const value = toInteger(cents)
  const reais = Math.floor(value / 100)
  const frac = String(value % 100).padStart(2, "0")
  return `${reais}.${frac}`
}

function merchantLabel(name: string): string {
  const stripped = name.normalize("NFD").replace(/\p{M}/gu, "")
  const clean = stripped
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 25)
  return clean.length > 0 ? clean : "LOJA"
}

function txidOf(raw: string): string {
  const cleaned = raw.replace(/[^A-Za-z0-9]/g, "").slice(0, 25)
  return cleaned.length > 0 ? cleaned : "***"
}

export function pixPayload(merchant: Merchant, amount: PositiveCentavos, txid: string): string {
  const body =
    tlv("00", "01") +
    tlv("01", "11") +
    tlv("26", tlv("00", "br.gov.bcb.pix") + tlv("01", canonicalPixKey(merchant.pixKey))) +
    tlv("52", "0000") +
    tlv("53", "986") +
    tlv("54", amountField(amount)) +
    tlv("58", "BR") +
    tlv("59", merchantLabel(merchant.legalName)) +
    tlv("60", "SAO PAULO") +
    tlv("62", tlv("05", txidOf(txid)))
  const withMarker = `${body}6304`
  return withMarker + crc16(withMarker)
}

export function collectionText(input: {
  readonly merchant: Merchant
  readonly clientName: string
  readonly phone: Phone
  readonly installment: InstallmentView
  readonly today: CivilDate
}): CollectionText | { code: "closed" } {
  if (input.installment.situation === "settled" || toInteger(input.installment.openCentavos) < 1) {
    return { code: "closed" }
  }
  const amount = positiveCentavos(toInteger(input.installment.openCentavos))
  const payload = pixPayload(input.merchant, amount, input.installment.id)
  const message = `Olá ${input.clientName}. A parcela de ${formatReais(input.installment.openCentavos)} vence em ${formatCivilDate(input.installment.dueOn)}. PIX copia e cola: ${payload}`
  const url = `https://wa.me/55${input.phone.digits}?text=${encodeURIComponent(message)}`
  return { pixPayload: payload, whatsAppUrl: url, message }
}
