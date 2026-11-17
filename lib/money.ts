declare const centsBrand: unique symbol;

export type Cents = number & { readonly [centsBrand]: true };

export function cents(value: number): Cents {
  if (!Number.isInteger(value)) {
    throw new Error("Centavos precisam ser inteiros.");
  }
  return value as Cents;
}

export function parseReais(input: string): Cents {
  const cleaned = input.trim().replace(/\s/g, "").replace(/^R\$/i, "");
  const normalized = cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error("Valor inválido.");
  }
  const [reais, frac = ""] = normalized.split(".");
  return cents(Number(reais) * 100 + Number(frac.padEnd(2, "0").slice(0, 2)));
}

// Percentual com até duas casas vira pontos-base: "2,5" -> 250.
export function parsePercentBp(input: string): number {
  return parseReais(input.replace(/%/g, ""));
}

// "1,5" e "2", sem zeros sobrando, para frases como "a plataforma fica com 1,5%".
export function formatPercent(bp: number): string {
  return String(bp / 100).replace(".", ",");
}

export function formatPercentBp(bp: number): string {
  return (bp / 100).toFixed(2).replace(".", ",");
}

export function formatBRL(value: Cents): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  const reais = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const frac = String(abs % 100).padStart(2, "0");
  return `${sign}R$ ${reais},${frac}`;
}

export const MAX_INSTALLMENTS = 240;

export function splitBalance(balance: Cents, count: number): Cents[] {
  if (!Number.isInteger(count) || count < 1 || count > MAX_INSTALLMENTS) {
    throw new Error(`A quantidade de parcelas deve ficar entre 1 e ${MAX_INSTALLMENTS}.`);
  }
  if (balance < count) {
    throw new Error("O saldo não cobre um centavo por parcela.");
  }
  const base = Math.floor(balance / count);
  const remainder = balance - base * count;
  const parts = Array.from({ length: count }, () => cents(base));
  parts[0] = cents(base + remainder);
  return parts;
}
