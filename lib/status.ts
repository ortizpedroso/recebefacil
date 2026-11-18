export type ChargeRow = { status: string; amountCents: number; paidCents: number };

// A primeira regra que casa decide. `open` marca o que ainda aceita pagamento, pode vencer e muda de vencimento.
export const CHARGE_STATES = [
  { status: "cancelada", open: false, matches: (row: ChargeRow) => row.status === "cancelada" },
  { status: "paga", open: false, matches: (row: ChargeRow) => row.paidCents >= row.amountCents },
  { status: "parcial", open: true, matches: (row: ChargeRow) => row.paidCents > 0 },
  { status: "pendente", open: true, matches: () => true },
] as const;

export type ChargeStatus = (typeof CHARGE_STATES)[number]["status"];

function stateOf(row: ChargeRow) {
  return CHARGE_STATES.find((state) => state.matches(row)) ?? CHARGE_STATES[CHARGE_STATES.length - 1];
}

export function settleStatus(row: ChargeRow): ChargeStatus {
  return stateOf(row).status;
}

export function isOpen(row: ChargeRow): boolean {
  return stateOf(row).open;
}
