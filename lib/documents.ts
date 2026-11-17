export function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function repeated(digits: string) {
  return /^(\d)\1+$/.test(digits);
}

function cpfDigit(digits: number[], length: number) {
  let sum = 0;
  for (let index = 0; index < length; index += 1) sum += digits[index] * (length + 1 - index);
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

function cnpjDigit(digits: number[], length: number) {
  const weights = length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let index = 0; index < length; index += 1) sum += digits[index] * weights[index];
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

export function isValidCpf(value: string) {
  const digits = onlyDigits(value);
  if (!/^\d{11}$/.test(digits) || repeated(digits)) return false;
  const numbers = digits.split("").map(Number);
  return cpfDigit(numbers, 9) === numbers[9] && cpfDigit(numbers, 10) === numbers[10];
}

export function isValidCnpj(value: string) {
  const digits = onlyDigits(value);
  if (!/^\d{14}$/.test(digits) || repeated(digits)) return false;
  const numbers = digits.split("").map(Number);
  return cnpjDigit(numbers, 12) === numbers[12] && cnpjDigit(numbers, 13) === numbers[13];
}

export function isValidDocument(value: string, kind: "pf" | "pj") {
  return kind === "pj" ? isValidCnpj(value) : isValidCpf(value);
}

// O tipo da pessoa sai do documento: 11 dígitos é CPF, 14 é CNPJ. Vazio ou inválido devolve null.
export function documentKind(value: string): "pf" | "pj" | null {
  if (isValidCpf(value)) return "pf";
  if (isValidCnpj(value)) return "pj";
  return null;
}
