import { onlyDigits } from "./documents";

export const asaasHosts = {
  sandbox: "https://api-sandbox.asaas.com/v3",
  producao: "https://api.asaas.com/v3",
} as const;

export type AsaasEnvironment = keyof typeof asaasHosts;

const billingTypes = {
  Pix: "PIX",
  Boleto: "BOLETO",
  "Cartão de crédito": "CREDIT_CARD",
  Transferência: "UNDEFINED",
} as const;

export function billingTypeFor(method: string) {
  return billingTypes[method as keyof typeof billingTypes] ?? "UNDEFINED";
}

export function centsToReais(cents: number) {
  const whole = Math.trunc(cents / 100);
  const fraction = String(Math.abs(cents % 100)).padStart(2, "0");
  return Number(`${whole}.${fraction}`);
}

export type AsaasAccount = { name: string; email: string; cpfCnpj: string };
export type AsaasPayment = { id: string; invoiceUrl: string; bankSlipUrl: string | null; pixPayload: string | null };

type FetchLike = typeof fetch;

export function asaasApi(apiKey: string, environment: AsaasEnvironment, fetchImpl: FetchLike = fetch) {
  const root = asaasHosts[environment];
  async function call<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetchImpl(`${root}${path}`, {
      ...init,
      headers: {
        access_token: apiKey,
        accept: "application/json",
        "content-type": "application/json",
        "user-agent": "RecebeFacil",
        ...(init?.headers ?? {}),
      },
    });
    const text = await response.text();
    const body = text ? JSON.parse(text) : {};
    if (!response.ok) {
      const description = body?.errors?.[0]?.description || body?.message || "O Asaas recusou a chamada.";
      throw new Error(String(description));
    }
    return body as T;
  }
  return {
    account: () => call<AsaasAccount>("/myAccount"),
    createCustomer: (input: { name: string; document: string; email: string; phone: string }) =>
      call<{ id: string }>("/customers", {
        method: "POST",
        body: JSON.stringify({
          name: input.name,
          cpfCnpj: onlyDigits(input.document),
          email: input.email || undefined,
          mobilePhone: onlyDigits(input.phone) || undefined,
        }),
      }),
    createPayment: (input: { customer: string; billingType: string; value: number; dueDate: string; description: string; externalReference: string }) =>
      call<{ id: string; invoiceUrl?: string; bankSlipUrl?: string | null }>("/payments", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    pixQrCode: (paymentId: string) => call<{ payload?: string }>(`/payments/${paymentId}/pixQrCode`),
  };
}
