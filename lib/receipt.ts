export function receiptNumber(paymentId: string) {
  return `R-${paymentId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}
