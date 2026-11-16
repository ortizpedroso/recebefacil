import type { BookErrorCode } from "./book"
import { formatCivilDate, formatReais } from "./domain/format"
import type { ReceiptMethod } from "./domain/money"

const phrases = {
  invalid_name: "Informe o nome.",
  invalid_tax_id: "CPF ou CNPJ inválido.",
  invalid_phone: "Telefone inválido. Use DDD e número.",
  invalid_pix: "Chave PIX inválida.",
  invalid_principal: "Informe um valor em reais maior que zero. Use vírgula nos centavos.",
  invalid_count: "Informe de 1 a 60 parcelas. Cada parcela precisa ter pelo menos um centavo.",
  invalid_date: "Data inválida.",
  invalid_method: "Forma de recebimento inválida.",
  invalid_key: "Não foi possível identificar o registro.",
  invalid_description: "Informe uma descrição de até 120 caracteres.",
  invalid_due_day: "O dia de vencimento fica entre 1 e 31.",
  client_not_found: "Cliente não encontrado.",
  agreement_not_found: "Contrato não encontrado.",
  period_not_due: "Esse mês ainda não está em aberto para este contrato.",
  installment_not_found: "Parcela não encontrada.",
  exceeds_open: "O valor passa do saldo em aberto.",
  closed: "Essa parcela já está quitada.",
  idempotency_conflict: "Este envio já foi usado com outros dados. Atualize a página e tente de novo.",
  merchant_missing: "Cadastre a razão social e a chave PIX antes de lançar.",
  receipt_not_found: "Recebimento não encontrado.",
  signed_out: "Entre com sua conta para ver o livro.",
} as const satisfies Record<BookErrorCode, string>

export function phrase(error: { code: BookErrorCode }): string {
  return phrases[error.code]
}

export { formatCivilDate, formatReais }

export function situationLabel(situation: "open" | "overdue" | "settled"): string {
  if (situation === "overdue") return "Vencida"
  if (situation === "settled") return "Quitada"
  return "Em aberto"
}

export function methodLabel(method: ReceiptMethod): string {
  const labels: Record<ReceiptMethod, string> = {
    pix: "PIX",
    boleto: "Boleto",
    card: "Cartão",
    cash: "Dinheiro",
    transfer: "Transferência",
  }
  return labels[method]
}
