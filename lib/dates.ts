export type Periodicity = "semanal" | "quinzenal" | "mensal" | "trimestral" | "semestral" | "anual";

export function todayIn(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
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

export function addPeriod(iso: string, periodicity: Periodicity, steps: number): string {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (periodicity === "semanal") date.setUTCDate(date.getUTCDate() + 7 * steps);
  else if (periodicity === "quinzenal") date.setUTCDate(date.getUTCDate() + 15 * steps);
  else if (periodicity === "mensal") date.setUTCMonth(date.getUTCMonth() + steps);
  else if (periodicity === "trimestral") date.setUTCMonth(date.getUTCMonth() + 3 * steps);
  else if (periodicity === "semestral") date.setUTCMonth(date.getUTCMonth() + 6 * steps);
  else date.setUTCFullYear(date.getUTCFullYear() + steps);
  return date.toISOString().slice(0, 10);
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
  const full = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${full}?text=${encodeURIComponent(message)}`;
}

export function daysLate(dueOn: string, today: string): number {
  const due = Date.parse(`${dueOn}T00:00:00Z`);
  const now = Date.parse(`${today}T00:00:00Z`);
  return Math.floor((now - due) / 86_400_000);
}
