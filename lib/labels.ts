import { daysLate, formatDayMonth, monthName, type Periodicity } from "./dates";
import { isOpen } from "./status";

// Todo texto de situação que aparece na tela nasce aqui. Nenhuma tela escreve o valor cru do banco.
export type Tone = "late" | "soon" | "open" | "paid" | "muted";

export type Badge = { tone: Tone; label: string };

export type ChargeFacts = { status: string; amountCents: number; paidCents: number; dueOn: string };

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

export function chargeBadge(charge: ChargeFacts, today: string): Badge {
  if (charge.status === "cancelada") return { tone: "muted", label: "Cancelada" };
  if (!isOpen(charge)) return { tone: "paid", label: "Recebida" };
  const late = daysLate(charge.dueOn, today);
  if (late > 0) return { tone: "late", label: `Atrasada ${late} ${plural(late, "dia", "dias")}` };
  if (charge.paidCents > 0) return { tone: "soon", label: "Recebida em parte" };
  const ahead = -late;
  if (ahead === 0) return { tone: "soon", label: "Vence hoje" };
  if (ahead <= 7) return { tone: "soon", label: `Vence em ${ahead} ${plural(ahead, "dia", "dias")}` };
  return { tone: "open", label: `Vence ${formatDayMonth(charge.dueOn)}` };
}

export type SaleFacts = {
  status: string;
  mode: string;
  openCount: number;
  lateCount: number;
  recurringActive: boolean;
};

export function saleBadge(sale: SaleFacts): Badge {
  if (sale.status === "cancelada") return { tone: "muted", label: "Cancelada" };
  if (sale.lateCount > 0) return { tone: "late", label: "Com atraso" };
  if (sale.openCount > 0 || (sale.mode === "recorrente" && sale.recurringActive)) return { tone: "open", label: "Em dia" };
  return { tone: "paid", label: "Quitada" };
}

export type ClientFacts = { lateCount: number; openCents: number };

export function clientBadge(client: ClientFacts): Badge {
  if (client.lateCount > 0) return { tone: "late", label: "Atrasado" };
  if (client.openCents > 0) return { tone: "open", label: "Em dia" };
  return { tone: "paid", label: "Nada a pagar" };
}

export const CATALOG_KINDS = ["produto", "servico", "mensalidade"] as const;
export type CatalogKind = (typeof CATALOG_KINDS)[number];

const KIND_LABELS: Record<CatalogKind, string> = { produto: "Produto", servico: "Serviço", mensalidade: "Mensalidade" };

export function isCatalogKind(value: string): value is CatalogKind {
  return (CATALOG_KINDS as readonly string[]).includes(value);
}

export function kindLabel(kind: string): string {
  return isCatalogKind(kind) ? KIND_LABELS[kind] : "Produto";
}

// Só produto tem estoque contado.
export function tracksStock(kind: string): boolean {
  return kind === "produto";
}

export function planLabel(sale: { mode: string; installmentCount: number | null }): string {
  if (sale.mode === "avista") return "À vista";
  if (sale.mode === "recorrente") return "Mensalidade";
  return `${sale.installmentCount ?? 1}x`;
}

export function chargeTitle(charge: { label: string | null; dueOn: string }): string {
  if (charge.label === "Mensalidade") return `Mensalidade de ${monthName(charge.dueOn)}`;
  if (charge.label) return charge.label;
  return "Cobrança avulsa";
}

export const PAYMENT_METHODS = ["Pix", "Dinheiro", "Cartão", "Boleto", "Transferência"] as const;

export const TONE_CLASS: Record<Tone, string> = {
  late: "bg-rose-50 text-rose-700",
  soon: "bg-amber-50 text-amber-700",
  open: "bg-slate-100 text-slate-600",
  paid: "bg-emerald-50 text-emerald-700",
  muted: "bg-slate-100 text-slate-500",
};

export const PERIODS: { id: Periodicity; label: string }[] = [
  { id: "mensal", label: "Todo mês" },
  { id: "quinzenal", label: "A cada 15 dias" },
  { id: "semanal", label: "Toda semana" },
  { id: "trimestral", label: "A cada 3 meses" },
  { id: "semestral", label: "A cada 6 meses" },
  { id: "anual", label: "Todo ano" },
];

export function periodLabel(periodicity: string): string {
  return PERIODS.find((period) => period.id === periodicity)?.label ?? "Todo mês";
}

// O que o banco guarda na venda, dito do jeito do filtro e das exportações.
const SALE_STATUS_LABELS: Record<string, string> = {
  aguardando: "Sem recebimento",
  parcial: "Recebendo",
  paga: "Quitada",
  cancelada: "Cancelada",
};

export const SALE_STATUS_FILTERS = ["aguardando", "parcial", "paga"] as const;

export function saleStatusLabel(status: string): string {
  return SALE_STATUS_LABELS[status] ?? "Em andamento";
}
