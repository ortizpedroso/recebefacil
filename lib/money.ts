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

export function formatBRL(value: Cents): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  const reais = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const frac = String(abs % 100).padStart(2, "0");
  return `${sign}R$ ${reais},${frac}`;
}

export function splitBalance(balance: Cents, count: number): Cents[] {
  if (!Number.isInteger(count) || count < 1 || count > 60) {
    throw new Error("A quantidade de parcelas deve ficar entre 1 e 60.");
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
