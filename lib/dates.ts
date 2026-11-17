export type Periodicity = "semanal" | "quinzenal" | "mensal" | "trimestral" | "semestral" | "anual";

export function todayIn(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(now);
}

export function formatDateBR(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split("-");
  if (!year || !month || !day) return iso;
  return `${day}/${month}/${year}`;
}

export function formatDateTimeBR(iso: string | null): string {
  if (!iso) return "Nunca sincronizado";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Manaus",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

const PERIODS_PER_YEAR: Record<Periodicity, number> = {
  semanal: 52,
  quinzenal: 24,
  mensal: 12,
  trimestral: 4,
  semestral: 2,
  anual: 1,
};

export function periodsPerYear(periodicity: Periodicity): number {
  return PERIODS_PER_YEAR[periodicity];
}

const WEEKLY_DAYS: Partial<Record<Periodicity, number>> = { semanal: 7, quinzenal: 15 };

export function addPeriod(iso: string, periodicity: Periodicity, steps: number): string {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  const days = WEEKLY_DAYS[periodicity];
  if (days) return shiftDays(iso, days * steps);
  // Meses curtos prendem o dia no último dia do mês. 31 de janeiro mais um mês é 28 ou 29 de fevereiro.
  const monthIndex = year * 12 + (month - 1) + (12 / PERIODS_PER_YEAR[periodicity]) * steps;
  const targetYear = Math.floor(monthIndex / 12);
  const targetMonth = monthIndex - targetYear * 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return new Date(Date.UTC(targetYear, targetMonth, Math.min(day, lastDay))).toISOString().slice(0, 10);
}

export function periodIndexOnOrAfter(startsOn: string, periodicity: Periodicity, date: string): number {
  let index = 1;
  while (addPeriod(startsOn, periodicity, index) < date) index += 1;
  return index;
}

export function delayBand(days: number): string {
  if (days <= 7) return "1 a 7 dias";
  if (days <= 15) return "8 a 15 dias";
  if (days <= 30) return "16 a 30 dias";
  if (days <= 60) return "31 a 60 dias";
  return "Acima de 60 dias";
}

export function shiftDays(iso: string, days: number): string {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function whatsAppHref(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, "");
  // DDD 55 (Rio Grande do Sul) também começa com 55: só um número com mais de 11 dígitos já traz o código do país.
  const full = digits.length > 11 && digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${full}?text=${encodeURIComponent(message)}`;
}

export function daysLate(dueOn: string, today: string): number {
  const due = Date.parse(`${dueOn}T00:00:00Z`);
  const now = Date.parse(`${today}T00:00:00Z`);
  return Math.floor((now - due) / 86_400_000);
}

export function monthStart(today: string): string {
  return `${today.slice(0, 7)}-01`;
}

export function nextMonthStart(today: string): string {
  return addPeriod(monthStart(today), "mensal", 1);
}

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export function monthName(iso: string): string {
  return MONTHS[Number(iso.slice(5, 7)) - 1] ?? "";
}

export function formatDayMonth(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}
