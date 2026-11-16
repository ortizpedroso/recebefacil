import { onlyDigits } from "./masks";

export type PostalAddress = {
  street: string;
  district: string;
  city: string;
  state: string;
  complement: string;
};

export function addressFromViaCep(payload: unknown): PostalAddress | null {
  if (!payload || typeof payload !== "object") return null;
  const row = payload as Record<string, unknown>;
  if (row.erro === true) return null;
  if (typeof row.localidade !== "string" || typeof row.uf !== "string") return null;
  return {
    street: typeof row.logradouro === "string" ? row.logradouro : "",
    district: typeof row.bairro === "string" ? row.bairro : "",
    city: row.localidade,
    state: row.uf.slice(0, 2).toUpperCase(),
    complement: typeof row.complemento === "string" ? row.complemento : "",
  };
}

export async function lookupCep(cep: string): Promise<PostalAddress | null> {
  const code = onlyDigits(cep);
  if (code.length !== 8) return null;
  const response = await fetch(`https://viacep.com.br/ws/${code}/json/`);
  if (!response.ok) return null;
  return addressFromViaCep(await response.json());
}
