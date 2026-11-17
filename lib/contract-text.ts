import { formatDateBR } from "./dates";
import { cents, formatBRL, formatPercentBp } from "./money";

export type ContractFacts = {
  issuedOn: string;
  company: { name: string; document: string; address: string };
  client: { name: string; document: string; address: string };
  items: { description: string; quantity: number; unitCents: number }[];
  discountCents: number;
  totalCents: number;
  mode: string;
  entryCents: number;
  installmentCount: number;
  installments: { dueOn: string; amountCents: number }[];
  periodicity: string;
  interestMonthlyBp: number;
  adjustYearlyBp: number;
  lateFineBp: number;
  lateInterestMonthlyBp: number;
};

export type Clause = { title: string; paragraphs: string[] };

const money = (value: number) => formatBRL(cents(value));

const PERIOD_WORDS: Record<string, string> = {
  semanal: "semanais",
  quinzenal: "quinzenais",
  mensal: "mensais",
  trimestral: "trimestrais",
  semestral: "semestrais",
  anual: "anuais",
};

function party(label: string, who: { name: string; document: string; address: string }) {
  const parts = [`${label}: ${who.name}`];
  if (who.document) parts.push(`documento ${who.document}`);
  if (who.address) parts.push(`endereço ${who.address}`);
  return `${parts.join(", ")}.`;
}

function paymentClause(facts: ContractFacts): string[] {
  const firstDue = facts.installments[0]?.dueOn ?? facts.issuedOn;
  if (facts.mode === "avista") return [`O preço será pago à vista, em ${formatDateBR(firstDue)}.`];
  if (facts.mode === "recorrente") {
    return [`O valor de ${money(facts.totalCents)} será cobrado a cada período (${facts.periodicity}), a partir de ${formatDateBR(firstDue)}, até que uma das partes encerre o serviço.`];
  }
  const regular = facts.installments.slice(facts.entryCents > 0 ? 1 : 0);
  const first = regular[0];
  const last = regular.at(-1);
  const lines: string[] = [];
  if (facts.entryCents > 0) lines.push(`Entrada de ${money(facts.entryCents)}, paga no ato da assinatura.`);
  const opening = first ? `, a primeira de ${money(first.amountCents)} com vencimento em ${formatDateBR(first.dueOn)}` : "";
  const closing = last && last !== first ? ` e a última de ${money(last.amountCents)} em ${formatDateBR(last.dueOn)}` : "";
  lines.push(`O saldo será pago em ${facts.installmentCount} parcelas ${PERIOD_WORDS[facts.periodicity] ?? "mensais"}${opening}${closing}.`);
  if (facts.interestMonthlyBp > 0) lines.push(`As parcelas incluem juros de financiamento de ${formatPercentBp(facts.interestMonthlyBp)}% ao mês, calculados pela Tabela Price.`);
  if (facts.adjustYearlyBp > 0) lines.push(`As parcelas serão reajustadas em ${formatPercentBp(facts.adjustYearlyBp)}% a cada 12 meses.`);
  const total = facts.installments.reduce((sum, row) => sum + row.amountCents, 0);
  if (total !== facts.totalCents) lines.push(`Total a pagar ao final do contrato: ${money(total)}.`);
  return lines;
}

export function contractClauses(facts: ContractFacts): Clause[] {
  const price = [`Preço total: ${money(facts.totalCents)}.`];
  if (facts.discountCents > 0) price.unshift(`Desconto concedido: ${money(facts.discountCents)}.`);
  return [
    { title: "Das partes", paragraphs: [party("VENDEDOR", facts.company), party("COMPRADOR", facts.client)] },
    { title: "Do objeto", paragraphs: ["O VENDEDOR vende ao COMPRADOR o que segue:", ...facts.items.map((item) => `${item.quantity} × ${item.description}, ${money(item.unitCents)} cada.`)] },
    { title: "Do preço", paragraphs: price },
    { title: "Da forma de pagamento", paragraphs: paymentClause(facts) },
    {
      title: "Do atraso",
      paragraphs: [
        `O pagamento feito depois do vencimento terá multa de ${formatPercentBp(facts.lateFineBp)}% sobre o valor em aberto e juros de mora de ${formatPercentBp(facts.lateInterestMonthlyBp)}% ao mês, contados por dia de atraso.`,
      ],
    },
    { title: "Das disposições gerais", paragraphs: ["As partes leram, entenderam e concordam com este contrato, que é assinado em duas vias de igual valor."] },
  ];
}
