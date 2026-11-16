export function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function maskCpf(value: string) {
  const digits = onlyDigits(value).slice(0, 11);
  return digits.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export function maskCnpj(value: string) {
  const digits = onlyDigits(value).slice(0, 14);
  return digits
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

export function maskDocument(value: string, kind: "pf" | "pj") {
  return kind === "pj" ? maskCnpj(value) : maskCpf(value);
}

export function maskPhone(value: string) {
  const digits = onlyDigits(value).slice(0, 11);
  const withArea = digits.replace(/(\d{2})(\d)/, "($1) $2");
  if (digits.length > 10) return withArea.replace(/(\d{5})(\d{1,4})$/, "$1-$2");
  return withArea.replace(/(\d{4})(\d{1,4})$/, "$1-$2");
}

export function maskCep(value: string) {
  const digits = onlyDigits(value).slice(0, 8);
  return digits.replace(/(\d{5})(\d{1,3})$/, "$1-$2");
}

export function maskMoney(value: string) {
  const digits = onlyDigits(value).slice(0, 14);
  if (!digits) return "";
  const padded = digits.padStart(3, "0");
  const reais = padded.slice(0, -2).replace(/^0+(?=\d)/, "");
  const frac = padded.slice(-2);
  return `${reais.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${frac}`;
}

export function maskUf(value: string) {
  return value.replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase();
}
