import type { Cents } from "./money";

// Tabela pública do Asaas (https://www.asaas.com/precos-e-taxas), conferida em nov/2026.
// Mudou lá, mude aqui: a tela Saque e taxas e o simulador leem só esta tabela.
export const ASAAS_FEES = {
  pixCents: 199,
  boletoCents: 199,
  card: [
    { upTo: 1, label: "Cartão à vista", fixedCents: 49, bp: 299 },
    { upTo: 6, label: "Cartão de 2 a 6 parcelas", fixedCents: 49, bp: 349 },
    { upTo: 12, label: "Cartão de 7 a 12 parcelas", fixedCents: 49, bp: 399 },
    { upTo: 21, label: "Cartão de 13 a 21 parcelas", fixedCents: 49, bp: 429 },
  ],
  anticipation: { cashMonthlyBp: 125, installmentMonthlyBp: 170 },
  withdrawal: { pixFreePerMonth: 30, pixCents: 200 },
  cardSettlementDays: 32,
  boletoSettlementDays: 1,
} as const;

export type PayMethod = "pix" | "boleto" | "cartao";

export type FeeQuote = {
  grossCents: number;
  asaasCents: number;
  anticipationCents: number;
  platformCents: number;
  netCents: number;
  lines: { label: string; cents: number }[];
};

const percentOf = (cents: number, bp: number) => Math.round((cents * bp) / 10_000);

export function cardTier(installments: number) {
  return ASAAS_FEES.card.find((tier) => installments <= tier.upTo) ?? ASAAS_FEES.card[ASAAS_FEES.card.length - 1];
}

// Antecipar a parcela n custa a taxa mensal por n meses; a média de 1..N dá (N+1)/2 meses.
export function anticipationCents(baseCents: number, installments: number): number {
  if (installments <= 1) return percentOf(baseCents, ASAAS_FEES.anticipation.cashMonthlyBp);
  return Math.round((baseCents * ASAAS_FEES.anticipation.installmentMonthlyBp * (installments + 1)) / 2 / 10_000);
}

// Quanto do pagamento chega na subconta. A taxa da plataforma é um percentual do valor pago, além das taxas do Asaas.
export function quoteFees(input: { grossCents: Cents | number; method: PayMethod; installments?: number; anticipate?: boolean; platformFeeBp: number }): FeeQuote {
  const gross = Math.max(0, Math.round(input.grossCents));
  const installments = input.method === "cartao" ? Math.min(21, Math.max(1, Math.round(input.installments ?? 1))) : 1;
  const lines: FeeQuote["lines"] = [];
  let asaas = 0;
  if (input.method === "pix") {
    asaas = ASAAS_FEES.pixCents;
    lines.push({ label: "Taxa do Asaas (Pix)", cents: asaas });
  } else if (input.method === "boleto") {
    asaas = ASAAS_FEES.boletoCents;
    lines.push({ label: "Taxa do Asaas (boleto)", cents: asaas });
  } else {
    const tier = cardTier(installments);
    asaas = tier.fixedCents + percentOf(gross, tier.bp);
    lines.push({ label: `Taxa do Asaas (${tier.label.toLowerCase()})`, cents: asaas });
  }
  asaas = Math.min(asaas, gross);
  const anticipation = input.method === "cartao" && input.anticipate ? anticipationCents(gross - asaas, installments) : 0;
  if (anticipation > 0) lines.push({ label: "Antecipação do cartão (Asaas)", cents: anticipation });
  const platform = percentOf(gross, input.platformFeeBp);
  lines.push({ label: "Taxa da plataforma", cents: platform });
  const net = Math.max(0, gross - asaas - anticipation - platform);
  return { grossCents: gross, asaasCents: asaas, anticipationCents: anticipation, platformCents: platform, netCents: net, lines };
}

// O Asaas dá saques Pix grátis por mês; depois disso cada um custa a tarifa fixa.
export function withdrawalFeeCents(withdrawalsThisMonth: number): number {
  return withdrawalsThisMonth < ASAAS_FEES.withdrawal.pixFreePerMonth ? 0 : ASAAS_FEES.withdrawal.pixCents;
}
