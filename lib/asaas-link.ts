import { charges } from "./schema";

// A cobrança tem no máximo uma cobrança viva no Asaas. Estas colunas andam sempre juntas: ou todas preenchidas, ou todas vazias.
export type AsaasLink = Pick<
  typeof charges.$inferSelect,
  | "asaasPaymentId"
  | "asaasBillingType"
  | "asaasInvoiceUrl"
  | "asaasBankSlipUrl"
  | "asaasIdentificationField"
  | "asaasPixPayload"
  | "asaasPixImage"
  | "asaasPixExpiresAt"
  | "asaasValueCents"
  | "asaasSyncedAt"
>;

export const NO_LINK: AsaasLink = {
  asaasPaymentId: null,
  asaasBillingType: null,
  asaasInvoiceUrl: null,
  asaasBankSlipUrl: null,
  asaasIdentificationField: null,
  asaasPixPayload: null,
  asaasPixImage: null,
  asaasPixExpiresAt: null,
  asaasValueCents: null,
  asaasSyncedAt: null,
};
