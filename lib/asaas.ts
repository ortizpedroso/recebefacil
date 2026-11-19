import { z } from "zod";
import { cents, type Cents } from "./money";

export type AsaasEnvironment = "sandbox" | "producao";

export const ASAAS_BASE_URL: Record<AsaasEnvironment, string> = {
  sandbox: "https://api-sandbox.asaas.com/v3",
  producao: "https://api.asaas.com/v3",
};

export type AsaasErrorKind = "config" | "network" | "timeout" | "auth" | "notfound" | "rejected" | "ratelimit" | "server" | "response";

// A mensagem já nasce limpa e em português: pode ir direto para a tela e para o log, e nunca leva a chave.
export class AsaasError extends Error {
  constructor(
    readonly kind: AsaasErrorKind,
    message: string,
    readonly status?: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "AsaasError";
  }
}

const FIXED_MESSAGES = {
  config: "O Asaas ainda não está configurado.",
  network: "Não foi possível falar com o Asaas. Confira a conexão e tente de novo.",
  timeout: "O Asaas demorou demais para responder. Tente de novo.",
  auth: "O Asaas não aceitou a chave de API. Confira a chave e se o ambiente (sandbox ou produção) é o certo.",
  notfound: "O Asaas não encontrou o que foi pedido.",
  ratelimit: "O Asaas pediu para esperar um pouco. Tente de novo em instantes.",
  server: "O Asaas está fora do ar agora. Tente de novo em instantes.",
  response: "O Asaas respondeu algo que não esperávamos. Tente de novo.",
} as const;

// Recusas de acesso que têm causa conhecida e um passo certo no painel do Asaas, em vez de culpar a chave.
const ACCESS_MESSAGES: Record<string, string> = {
  not_allowed_ip:
    "O Asaas bloqueou o acesso porque o IP deste servidor não está na lista de IPs autorizados da conta. No Asaas, abra Integrações, Mecanismos de segurança, Lista de IPs autorizados e adicione o IP de saída do servidor.",
  invalid_environment: "A chave de API é de outro ambiente. Chave com _prod_ é de Produção, e chave com _hmlg_ é de Sandbox.",
};

// Dinheiro é centavo inteiro por dentro. Só a fronteira com o Asaas fala em reais com duas casas.
export function toReais(value: Cents): number {
  return value / 100;
}

export function fromReais(value: number): Cents {
  return cents(Math.round(value * 100));
}

// O Asaas informa horários de Brasília, que não têm horário de verão desde 2019.
function isoFromAsaasDateTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const local = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})$/.exec(value.trim());
  const date = new Date(local ? `${local[1]}T${local[2]}-03:00` : value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

const text = z.string().nullish();

const paymentSchema = z
  .object({
    id: z.string().min(1),
    customer: text,
    value: z.number(),
    billingType: z.string(),
    status: z.string(),
    dueDate: text,
    paymentDate: text,
    clientPaymentDate: text,
    externalReference: text,
    invoiceUrl: text,
    bankSlipUrl: text,
    deleted: z.boolean().nullish(),
  })
  .transform((raw) => ({
    id: raw.id,
    customerId: raw.customer ?? null,
    valueCents: fromReais(raw.value),
    billingType: raw.billingType,
    status: raw.status,
    dueDate: raw.dueDate ?? null,
    paidOn: (raw.paymentDate ?? raw.clientPaymentDate ?? null)?.slice(0, 10) ?? null,
    externalReference: raw.externalReference ?? null,
    invoiceUrl: raw.invoiceUrl ?? null,
    bankSlipUrl: raw.bankSlipUrl ?? null,
    deleted: raw.deleted ?? false,
  }));

export type AsaasPayment = z.output<typeof paymentSchema>;

// Cada status do Asaas cai em uma de três etapas. Status novo que o Asaas inventar fica "unknown" e nada muda.
export type PaymentStage = "open" | "paid" | "dead" | "unknown";

const STAGE_BY_STATUS: Record<string, PaymentStage> = {
  PENDING: "open",
  OVERDUE: "open",
  AWAITING_RISK_ANALYSIS: "open",
  RECEIVED: "paid",
  CONFIRMED: "paid",
  RECEIVED_IN_CASH: "paid",
  REFUNDED: "dead",
  REFUND_REQUESTED: "dead",
  REFUND_IN_PROGRESS: "dead",
  CHARGEBACK_REQUESTED: "dead",
  CHARGEBACK_DISPUTE: "dead",
  AWAITING_CHARGEBACK_REVERSAL: "dead",
};

export function stageOf(status: string): PaymentStage {
  return STAGE_BY_STATUS[status] ?? "unknown";
}

const subscriptionSchema = z
  .object({
    id: z.string().min(1),
    customer: text,
    value: z.number(),
    status: z.string(),
    nextDueDate: text,
    description: text,
    externalReference: text,
    deleted: z.boolean().nullish(),
  })
  .transform((raw) => ({
    id: raw.id,
    customerId: raw.customer ?? null,
    valueCents: fromReais(raw.value),
    status: raw.status,
    nextDueDate: raw.nextDueDate ?? null,
    description: raw.description ?? "",
    externalReference: raw.externalReference ?? null,
    deleted: raw.deleted ?? false,
  }));

export type AsaasSubscription = z.output<typeof subscriptionSchema>;

// Assinatura inativa, expirada ou apagada não cobra mais ninguém.
export function subscriptionLive(subscription: Pick<AsaasSubscription, "status" | "deleted">): boolean {
  return !subscription.deleted && subscription.status === "ACTIVE";
}

const subscriptionListSchema = z.object({ data: z.array(subscriptionSchema) });
const paymentListSchema = z.object({ data: z.array(paymentSchema) });
const walletsSchema = z.object({ data: z.array(z.object({ id: z.string().min(1) })) });
const accountSchema = z.object({ name: text, company: text, tradingName: text, walletId: text });
const customerSchema = z.object({ id: z.string().min(1) });
const customersSchema = z.object({ data: z.array(customerSchema) });
const pixSchema = z
  .object({ encodedImage: z.string().min(1), payload: z.string().min(1), expirationDate: text })
  .transform((raw) => ({ image: raw.encodedImage, payload: raw.payload, expiresAt: isoFromAsaasDateTime(raw.expirationDate) }));
const identificationSchema = z.object({ identificationField: z.string().min(1) });
const deletedSchema = z.object({ deleted: z.boolean().optional() });

export type PixQr = z.output<typeof pixSchema>;

const newAccountSchema = z.object({ id: z.string().min(1), walletId: z.string().min(1), apiKey: z.string().min(1) });
const accountStatusSchema = z.object({ general: z.string().nullish() }).transform((raw) => ({ general: raw.general ?? "PENDING" }));
const balanceSchema = z.object({ balance: z.number() }).transform((raw) => ({ balanceCents: fromReais(raw.balance) }));
const transferSchema = z
  .object({ id: z.string().min(1), status: z.string(), value: z.number(), transferFee: z.number().nullish(), failReason: text, externalReference: text })
  .transform((raw) => ({
    id: raw.id,
    status: raw.status,
    valueCents: fromReais(raw.value),
    feeCents: fromReais(raw.transferFee ?? 0),
    failReason: raw.failReason ?? "",
    externalReference: raw.externalReference ?? null,
  }));
export type AsaasTransfer = z.output<typeof transferSchema>;
export type PixKeyType = "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP";

// O que o Asaas pede para abrir uma subconta. companyType só vale para CNPJ.
export type NewAccount = {
  name: string;
  email: string;
  cpfCnpj: string;
  birthDate?: string;
  companyType?: "MEI" | "LIMITED" | "INDIVIDUAL" | "ASSOCIATION";
  mobilePhone: string;
  incomeValueCents: Cents;
  address: string;
  addressNumber: string;
  complement?: string;
  province: string;
  postalCode: string;
};
export type SplitShare = { walletId: string; percentualValue: number };
export type NewPayment = {
  customer: string;
  billingType: "PIX" | "BOLETO" | "UNDEFINED";
  valueCents: Cents;
  dueDate: string;
  description: string;
  externalReference: string;
  split: SplitShare[];
};
export type NewSubscription = { customer: string; valueCents: Cents; nextDueDate: string; description: string; externalReference: string };
export type NewCustomer = { name: string; cpfCnpj: string; email?: string; phone?: string };

export type AsaasDeps = {
  apiKey: string;
  environment: AsaasEnvironment;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
};

const TIMEOUT_MS = 20_000;
const RETRY_BACKOFF_MS = 400;

type Call = { method: "GET" | "POST" | "DELETE"; path: string; query?: Record<string, string>; body?: unknown };

export function createAsaasClient(deps: AsaasDeps) {
  const key = deps.apiKey.trim();
  const base = ASAAS_BASE_URL[deps.environment];
  const send = deps.fetch ?? fetch;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const timeoutMs = deps.timeoutMs ?? TIMEOUT_MS;

  // Qualquer trecho que lembre uma chave sai antes de a mensagem ir a qualquer lugar.
  function clean(value: string): string {
    let result = value;
    if (key.length >= 6) result = result.split(key).join("***");
    return result.replace(/\$?aact_[\w=-]+/g, "***").replace(/\s+/g, " ").trim().slice(0, 240);
  }

  function failure(status: number, bodyText: string): AsaasError {
    let detail = "";
    let code = "";
    try {
      const parsed: unknown = JSON.parse(bodyText);
      const errors = (parsed as { errors?: unknown }).errors;
      if (Array.isArray(errors)) {
        code = String((errors[0] as { code?: unknown } | undefined)?.code ?? "");
        detail = errors
          .map((entry) => String((entry as { description?: unknown }).description ?? ""))
          .filter(Boolean)
          .join("; ");
      }
    } catch {
      detail = "";
    }
    if (status === 401 || status === 403) return new AsaasError("auth", ACCESS_MESSAGES[code] ?? FIXED_MESSAGES.auth, status, code);
    if (status === 404) return new AsaasError("notfound", FIXED_MESSAGES.notfound, status);
    if (status === 429) return new AsaasError("ratelimit", FIXED_MESSAGES.ratelimit, status);
    if (status >= 500) return new AsaasError("server", FIXED_MESSAGES.server, status);
    return new AsaasError("rejected", clean(detail) || "O Asaas recusou o pedido.", status);
  }

  async function once(call: Call): Promise<unknown> {
    const url = new URL(`${base}${call.path}`);
    for (const [name, value] of Object.entries(call.query ?? {})) url.searchParams.set(name, value);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await send(url, {
        method: call.method,
        headers: { access_token: key, "content-type": "application/json", "user-agent": "RecebeFacil" },
        body: call.body === undefined ? undefined : JSON.stringify(call.body),
        signal: controller.signal,
      });
      const bodyText = await response.text();
      if (!response.ok) throw failure(response.status, bodyText);
      if (!bodyText.trim()) return {};
      try {
        return JSON.parse(bodyText);
      } catch {
        throw new AsaasError("response", FIXED_MESSAGES.response, response.status);
      }
    } catch (error) {
      if (error instanceof AsaasError) throw error;
      throw controller.signal.aborted ? new AsaasError("timeout", FIXED_MESSAGES.timeout) : new AsaasError("network", FIXED_MESSAGES.network);
    } finally {
      clearTimeout(timer);
    }
  }

  // Só leitura repete: refazer um POST poderia cobrar duas vezes.
  async function request<T>(call: Call, schema: z.ZodType<T>): Promise<T> {
    if (!key) throw new AsaasError("config", FIXED_MESSAGES.config);
    const attempts = call.method === "GET" ? 2 : 1;
    let raw: unknown;
    for (let attempt = 1; ; attempt += 1) {
      try {
        raw = await once(call);
        break;
      } catch (error) {
        const retryable = error instanceof AsaasError && (error.kind === "network" || error.kind === "timeout" || error.kind === "server");
        if (attempt >= attempts || !retryable) throw error;
        await sleep(RETRY_BACKOFF_MS);
      }
    }
    const parsed = schema.safeParse(raw);
    if (!parsed.success) throw new AsaasError("response", FIXED_MESSAGES.response);
    return parsed.data;
  }

  const paymentPath = (id: string) => `/payments/${encodeURIComponent(id)}`;
  const subscriptionPath = (id: string) => `/subscriptions/${encodeURIComponent(id)}`;

  return {
    async getMyAccount(): Promise<{ name: string; walletId: string | null }> {
      const account = await request({ method: "GET", path: "/myAccount" }, accountSchema);
      return { name: account.name || account.company || account.tradingName || "", walletId: account.walletId || null };
    },

    createAccount(input: NewAccount): Promise<z.output<typeof newAccountSchema>> {
      const { incomeValueCents, ...rest } = input;
      return request({ method: "POST", path: "/accounts", body: { ...rest, incomeValue: toReais(incomeValueCents) } }, newAccountSchema);
    },

    getAccountStatus(): Promise<{ general: string }> {
      return request({ method: "GET", path: "/myAccount/status" }, accountStatusSchema);
    },

    getBalance(): Promise<{ balanceCents: Cents }> {
      return request({ method: "GET", path: "/finance/balance" }, balanceSchema);
    },

    createTransfer(input: { valueCents: Cents; pixKey: string; pixKeyType: PixKeyType; description: string; externalReference: string }): Promise<AsaasTransfer> {
      return request(
        {
          method: "POST",
          path: "/transfers",
          body: {
            value: toReais(input.valueCents),
            operationType: "PIX",
            pixAddressKey: input.pixKey,
            pixAddressKeyType: input.pixKeyType,
            description: input.description.slice(0, 140),
            externalReference: input.externalReference,
          },
        },
        transferSchema,
      );
    },

    getTransfer(id: string): Promise<AsaasTransfer> {
      return request({ method: "GET", path: `/transfers/${encodeURIComponent(id)}` }, transferSchema);
    },

    async getWallets(): Promise<{ id: string }[]> {
      return (await request({ method: "GET", path: "/wallets/" }, walletsSchema)).data;
    },

    async findOrCreateCustomer(input: NewCustomer): Promise<string> {
      const found = await request({ method: "GET", path: "/customers", query: { cpfCnpj: input.cpfCnpj, limit: "1" } }, customersSchema);
      if (found.data[0]) return found.data[0].id;
      const created = await request(
        {
          method: "POST",
          path: "/customers",
          body: { name: input.name.slice(0, 100), cpfCnpj: input.cpfCnpj, ...(input.email ? { email: input.email } : {}), ...(input.phone ? { mobilePhone: input.phone } : {}) },
        },
        customerSchema,
      );
      return created.id;
    },

    createPayment(input: NewPayment): Promise<AsaasPayment> {
      return request(
        {
          method: "POST",
          path: "/payments",
          body: {
            customer: input.customer,
            billingType: input.billingType,
            value: toReais(input.valueCents),
            dueDate: input.dueDate,
            description: input.description.slice(0, 500),
            externalReference: input.externalReference,
            ...(input.split.length > 0 ? { split: input.split } : {}),
          },
        },
        paymentSchema,
      );
    },

    getPayment(id: string): Promise<AsaasPayment> {
      return request({ method: "GET", path: paymentPath(id) }, paymentSchema);
    },

    getPixQrCode(id: string): Promise<PixQr> {
      return request({ method: "GET", path: `${paymentPath(id)}/pixQrCode` }, pixSchema);
    },

    async getIdentificationField(id: string): Promise<string> {
      return (await request({ method: "GET", path: `${paymentPath(id)}/identificationField` }, identificationSchema)).identificationField;
    },

    receiveInCash(id: string, valueCents: Cents, date: string): Promise<AsaasPayment> {
      return request({ method: "POST", path: `${paymentPath(id)}/receiveInCash`, body: { paymentDate: date, value: toReais(valueCents), notifyCustomer: false } }, paymentSchema);
    },

    undoReceivedInCash(id: string): Promise<AsaasPayment> {
      return request({ method: "POST", path: `${paymentPath(id)}/undoReceivedInCash` }, paymentSchema);
    },

    async deletePayment(id: string): Promise<void> {
      await request({ method: "DELETE", path: paymentPath(id) }, deletedSchema);
    },

    // O pagador escolhe Pix, boleto ou cartão na fatura do Asaas, por isso o tipo fica em UNDEFINED.
    createSubscription(input: NewSubscription): Promise<AsaasSubscription> {
      return request(
        {
          method: "POST",
          path: "/subscriptions",
          body: {
            customer: input.customer,
            billingType: "UNDEFINED",
            value: toReais(input.valueCents),
            nextDueDate: input.nextDueDate,
            cycle: "MONTHLY",
            description: input.description.slice(0, 500),
            externalReference: input.externalReference,
          },
        },
        subscriptionSchema,
      );
    },

    // updatePendingPayments leva o novo valor também para a fatura que ainda não foi paga.
    updateSubscription(id: string, input: { valueCents: Cents; description: string }): Promise<AsaasSubscription> {
      return request(
        { method: "POST", path: subscriptionPath(id), body: { value: toReais(input.valueCents), description: input.description.slice(0, 500), updatePendingPayments: true } },
        subscriptionSchema,
      );
    },

    getSubscription(id: string): Promise<AsaasSubscription> {
      return request({ method: "GET", path: subscriptionPath(id) }, subscriptionSchema);
    },

    async deleteSubscription(id: string): Promise<void> {
      await request({ method: "DELETE", path: subscriptionPath(id) }, deletedSchema);
    },

    async listSubscriptionPayments(id: string): Promise<AsaasPayment[]> {
      return (await request({ method: "GET", path: `${subscriptionPath(id)}/payments`, query: { limit: "100" } }, paymentListSchema)).data;
    },

    async findSubscriptions(externalReference: string): Promise<AsaasSubscription[]> {
      const found = await request({ method: "GET", path: "/subscriptions", query: { externalReference, limit: "20" } }, subscriptionListSchema);
      // Se o Asaas ignorar o filtro, o que não é desta referência não entra.
      return found.data.filter((subscription) => subscription.externalReference === externalReference);
    },
  };
}

export type AsaasClient = ReturnType<typeof createAsaasClient>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// O Asaas recusa e-mail e telefone mal formados: o que não serve fica de fora em vez de derrubar o cadastro.
export function customerContact(email: string, phone: string): { email?: string; phone?: string } {
  const digits = phone.replace(/\D/g, "");
  return { ...(EMAIL.test(email) ? { email } : {}), ...(digits.length === 10 || digits.length === 11 ? { phone: digits } : {}) };
}

// Conta e carteira de uma chave. A carteira decide para onde o split manda o dinheiro, então ela é obrigatória.
export async function accountOf(client: AsaasClient): Promise<{ name: string; walletId: string }> {
  const wallets = await client.getWallets();
  let name = "";
  let walletId = wallets[0]?.id ?? "";
  try {
    const account = await client.getMyAccount();
    name = account.name;
    walletId = walletId || account.walletId || "";
  } catch (error) {
    if (!(error instanceof AsaasError) || error.kind !== "notfound") throw error;
  }
  if (!walletId) throw new AsaasError("response", "Não foi possível descobrir a carteira desta conta Asaas.");
  return { name, walletId };
}

// Só links do próprio Asaas servem de destino para o pagador: a resposta é validada antes de virar redirecionamento.
export function isAsaasUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "asaas.com" || url.hostname.endsWith(".asaas.com"));
  } catch {
    return false;
  }
}
