import { toInteger, type Centavos, type CivilDate } from "./money"

export function formatReais(amount: Centavos): string {
  const n = toInteger(amount)
  const sign = n < 0 ? "-" : ""
  const abs = Math.abs(n)
  const reais = Math.floor(abs / 100)
  const cents = String(abs % 100).padStart(2, "0")
  const grouped = String(reais).replace(/\B(?=(\d{3})+(?!\d))/g, ".")
  return `${sign}R$ ${grouped},${cents}`
}

export function reaisField(amount: Centavos): string {
  const abs = Math.abs(toInteger(amount))
  return `${Math.floor(abs / 100)},${String(abs % 100).padStart(2, "0")}`
}

export function formatCivilDate(iso: CivilDate): string {
  const [year, month, day] = iso.split("-")
  return `${day}/${month}/${year}`
}
