import { eq } from "drizzle-orm";
import type { DB } from "./db";
import { createCharge } from "./ledger";
import { cents } from "./money";
import { generateWebhookToken, savePlatformSettings } from "./platform-settings";
import { charges, clients, organizations, platformSettings, subscriptions } from "./schema";
import { addClient, addOrganization } from "./test-support";

// Asaas de mentira para os testes: guarda as cobranças na memória e registra cada chamada recebida.
export type FakeCall = { method: string; path: string; query: Record<string, string>; body: Record<string, unknown> | null; token: string | null; userAgent: string | null };

export type FakePayment = {
  id: string;
  customer: string;
  value: number;
  billingType: string;
  status: string;
  dueDate: string;
  externalReference: string | null;
  description: string;
  split: { walletId: string; percentualValue: number }[];
  paymentDate: string | null;
  deleted: boolean;
  subscription: string | null;
};

export type FakeSubscription = {
  id: string;
  customer: string;
  value: number;
  status: "ACTIVE" | "INACTIVE";
  nextDueDate: string;
  cycle: string;
  billingType: string;
  description: string;
  externalReference: string | null;
  deleted: boolean;
};

type Options = {
  apiKey?: string;
  wallets?: Record<string, string>;
  accountName?: string;
  pixExpiresAt?: string;
  // Dois Asaas de mentira no mesmo banco geram ids que não se repetem: o banco exige id do Asaas único.
  idPrefix?: string;
};

type Failure = { method: string; path: RegExp; status: number; body?: unknown; times: number };

export function fakeAsaas(options: Options = {}) {
  const apiKey = options.apiKey ?? "test-key";
  const prefix = options.idPrefix ?? "";
  const wallets = options.wallets ?? { [apiKey]: "wallet-platform" };
  const calls: FakeCall[] = [];
  const payments = new Map<string, FakePayment>();
  const subscriptions = new Map<string, FakeSubscription>();
  const customers = new Map<string, string>();
  const failures: Failure[] = [];
  const accounts = new Map<string, { id: string; status: string; balance: number }>();
  const transfers = new Map<string, { id: string; key: string; value: number; status: string; externalReference: string | null }>();
  let sequence = 0;
  const state = { pixExpiresAt: options.pixExpiresAt ?? "2099-01-01 23:59:59" };

  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const view = (payment: FakePayment) => ({
    object: "payment",
    id: payment.id,
    customer: payment.customer,
    value: payment.value,
    billingType: payment.billingType,
    status: payment.status,
    dueDate: payment.dueDate,
    paymentDate: payment.paymentDate,
    externalReference: payment.externalReference,
    invoiceUrl: `https://sandbox.asaas.com/i/${payment.id}`,
    bankSlipUrl: payment.billingType === "PIX" ? null : `https://sandbox.asaas.com/b/pdf/${payment.id}`,
    deleted: payment.deleted,
    subscription: payment.subscription,
  });
  const subscriptionView = (subscription: FakeSubscription) => ({ object: "subscription", ...subscription });
  const addPayment = (fields: Pick<FakePayment, "customer" | "value" | "billingType" | "dueDate" | "externalReference" | "description"> & Partial<FakePayment>) => {
    sequence += 1;
    const payment: FakePayment = { id: `pay_${prefix}${sequence}`, status: "PENDING", split: [], paymentDate: null, deleted: false, subscription: null, ...fields };
    payments.set(payment.id, payment);
    return payment;
  };

  const fakeFetch = (async (input: URL | string | Request, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const headers = new Headers(init?.headers);
    const method = (init?.method ?? "GET").toUpperCase();
    const path = url.pathname.replace(/^\/v3/, "");
    const call: FakeCall = {
      method,
      path,
      query: Object.fromEntries(url.searchParams),
      body: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null,
      token: headers.get("access_token"),
      userAgent: headers.get("user-agent"),
    };
    calls.push(call);

    const planned = failures.find((failure) => failure.times > 0 && failure.method === method && failure.path.test(path));
    if (planned) {
      planned.times -= 1;
      return json(planned.status, planned.body ?? { errors: [{ code: "falha", description: "Falha combinada no teste." }] });
    }
    const key = call.token ?? "";
    if (!(key in wallets)) return json(401, { errors: [{ code: "invalid_access_token", description: `Chave ${key} inválida.` }] });

    if (method === "POST" && path === "/accounts") {
      sequence += 1;
      const subKey = `sub-key-${prefix}${sequence}`;
      wallets[subKey] = `wallet-sub-${prefix}${sequence}`;
      accounts.set(subKey, { id: `acc_${prefix}${sequence}`, status: "PENDING", balance: 0 });
      return json(200, { id: `acc_${prefix}${sequence}`, walletId: wallets[subKey], apiKey: subKey });
    }
    if (method === "GET" && path === "/myAccount/status") return json(200, { general: accounts.get(key)?.status ?? "APPROVED" });
    if (method === "GET" && path === "/finance/balance") return json(200, { balance: accounts.get(key)?.balance ?? 0 });
    if (method === "POST" && path === "/transfers") {
      sequence += 1;
      const body = call.body ?? {};
      const transfer = { id: `tra_${prefix}${sequence}`, key, value: Number(body.value), status: "PENDING", externalReference: (body.externalReference as string) ?? null };
      transfers.set(transfer.id, transfer);
      return json(200, { ...transfer, transferFee: 0 });
    }
    const transferMatch = /^\/transfers\/([^/]+)$/.exec(path);
    if (method === "GET" && transferMatch) {
      const transfer = transfers.get(decodeURIComponent(transferMatch[1]));
      return transfer && transfer.key === key ? json(200, { ...transfer, transferFee: 0 }) : json(404, { errors: [{ code: "not_found", description: "Transferência não encontrada." }] });
    }
    if (method === "GET" && path === "/wallets/") return json(200, { object: "list", data: [{ id: wallets[key] }] });
    if (method === "GET" && path === "/myAccount") return json(200, { name: options.accountName ?? "Loja de Teste", walletId: wallets[key] });
    if (method === "GET" && path === "/customers") {
      const found = customers.get(call.query.cpfCnpj ?? "");
      return json(200, { object: "list", data: found ? [{ id: found }] : [] });
    }
    if (method === "POST" && path === "/customers") {
      sequence += 1;
      const id = `cus_${prefix}${sequence}`;
      customers.set(String(call.body?.cpfCnpj), id);
      return json(200, { object: "customer", id });
    }
    if (method === "POST" && path === "/payments") {
      const body = call.body ?? {};
      const payment = addPayment({
        customer: String(body.customer),
        value: Number(body.value),
        billingType: String(body.billingType),
        dueDate: String(body.dueDate),
        externalReference: body.externalReference === undefined ? null : String(body.externalReference),
        description: String(body.description ?? ""),
        split: (body.split as FakePayment["split"] | undefined) ?? [],
      });
      return json(200, view(payment));
    }

    if (method === "POST" && path === "/subscriptions") {
      sequence += 1;
      const body = call.body ?? {};
      const subscription: FakeSubscription = {
        id: `sub_${prefix}${sequence}`,
        customer: String(body.customer),
        value: Number(body.value),
        status: "ACTIVE",
        nextDueDate: String(body.nextDueDate),
        cycle: String(body.cycle),
        billingType: String(body.billingType),
        description: String(body.description ?? ""),
        externalReference: body.externalReference === undefined ? null : String(body.externalReference),
        deleted: false,
      };
      subscriptions.set(subscription.id, subscription);
      addPayment({ customer: subscription.customer, value: subscription.value, billingType: subscription.billingType, dueDate: subscription.nextDueDate, externalReference: subscription.externalReference, description: subscription.description, subscription: subscription.id });
      return json(200, subscriptionView(subscription));
    }
    if (method === "GET" && path === "/subscriptions") {
      const reference = call.query.externalReference;
      const data = [...subscriptions.values()].filter((subscription) => !reference || subscription.externalReference === reference).map(subscriptionView);
      return json(200, { object: "list", data });
    }
    const subscriptionMatch = /^\/subscriptions\/([^/]+)(?:\/(\w+))?$/.exec(path);
    if (subscriptionMatch) {
      const subscription = subscriptions.get(decodeURIComponent(subscriptionMatch[1]));
      if (!subscription) return json(404, { errors: [{ code: "not_found", description: "Assinatura não encontrada." }] });
      const action = subscriptionMatch[2];
      if (method === "GET" && !action) return json(200, subscriptionView(subscription));
      if (method === "GET" && action === "payments") {
        const data = [...payments.values()].filter((payment) => payment.subscription === subscription.id && !payment.deleted).reverse().map(view);
        return json(200, { object: "list", data });
      }
      if (method === "POST" && !action) {
        const body = call.body ?? {};
        if (body.value !== undefined) subscription.value = Number(body.value);
        if (body.description !== undefined) subscription.description = String(body.description);
        if (body.updatePendingPayments) {
          for (const payment of payments.values()) {
            if (payment.subscription === subscription.id && payment.status === "PENDING") payment.value = subscription.value;
          }
        }
        return json(200, subscriptionView(subscription));
      }
      if (method === "DELETE" && !action) {
        subscription.deleted = true;
        subscription.status = "INACTIVE";
        for (const payment of payments.values()) {
          if (payment.subscription === subscription.id && payment.status === "PENDING") payment.deleted = true;
        }
        return json(200, { deleted: true, id: subscription.id });
      }
    }

    const match = /^\/payments\/([^/]+)(?:\/(\w+))?$/.exec(path);
    const payment = match ? payments.get(decodeURIComponent(match[1])) : undefined;
    if (!match || !payment || payment.deleted) return json(404, { errors: [{ code: "not_found", description: "Cobrança não encontrada." }] });
    const action = match[2];
    if (method === "GET" && !action) return json(200, view(payment));
    if (method === "GET" && action === "pixQrCode") return json(200, { encodedImage: `qr-${payment.id}`, payload: `000201-${payment.id}`, expirationDate: state.pixExpiresAt });
    if (method === "GET" && action === "identificationField") return json(200, { identificationField: `34191.79001 ${payment.id}` });
    if (method === "POST" && action === "receiveInCash") {
      payment.status = "RECEIVED_IN_CASH";
      payment.paymentDate = String(call.body?.paymentDate);
      return json(200, view(payment));
    }
    if (method === "POST" && action === "undoReceivedInCash") {
      payment.status = "PENDING";
      payment.paymentDate = null;
      return json(200, view(payment));
    }
    if (method === "DELETE" && !action) {
      if (payment.status === "RECEIVED" || payment.status === "CONFIRMED") return json(400, { errors: [{ code: "invalid_action", description: "Não é possível excluir uma cobrança já paga." }] });
      payment.deleted = true;
      return json(200, { deleted: true, id: payment.id });
    }
    return json(404, { errors: [{ code: "not_found", description: "Rota desconhecida." }] });
  }) as typeof fetch;

  return {
    fetch: fakeFetch,
    calls,
    payments,
    subscriptions,
    customers,
    state,
    accounts,
    transfers,
    setAccount(subKey: string, fields: { status?: string; balance?: number }) {
      const account = accounts.get(subKey);
      if (!account) throw new Error(`subconta ${subKey} não existe no Asaas de mentira`);
      Object.assign(account, fields);
    },
    setTransferStatus(id: string, status: string) {
      const transfer = transfers.get(id);
      if (!transfer) throw new Error(`transferência ${id} não existe no Asaas de mentira`);
      transfer.status = status;
    },
    callsTo: (method: string, pattern: RegExp) => calls.filter((call) => call.method === method && pattern.test(call.path)),
    // O pagador pagou: o status muda do lado do Asaas, como no mundo real.
    settle(id: string, status = "RECEIVED", paymentDate = "2026-11-17") {
      const payment = payments.get(id);
      if (!payment) throw new Error(`cobrança ${id} não existe no Asaas de mentira`);
      payment.status = status;
      payment.paymentDate = paymentDate;
    },
    setStatus(id: string, status: string) {
      const payment = payments.get(id);
      if (!payment) throw new Error(`cobrança ${id} não existe no Asaas de mentira`);
      payment.status = status;
    },
    // O Asaas gera a fatura do mês seguinte sozinho: aqui o teste pede essa fatura na data que quiser.
    renew(subscriptionId: string, dueDate: string) {
      const subscription = subscriptions.get(subscriptionId);
      if (!subscription) throw new Error(`assinatura ${subscriptionId} não existe no Asaas de mentira`);
      return addPayment({ customer: subscription.customer, value: subscription.value, billingType: subscription.billingType, dueDate, externalReference: subscription.externalReference, description: subscription.description, subscription: subscription.id });
    },
    failNext(method: string, path: RegExp, status: number, times = 1, body?: unknown) {
      failures.push({ method, path, status, times, body });
    },
  };
}

export type FakeAsaas = ReturnType<typeof fakeAsaas>;

// Cenário integrado: plataforma configurada, lojista ligado ao Asaas, uma cobrança em aberto.

export const PLATFORM_WALLET = "wallet-plataforma";
export const MERCHANT_WALLET = "wallet-loja";
export const VALID_CPF = "390.533.447-05";

// Devolve o token do webhook, que só existe em texto puro neste momento.
export async function configurePlatform(db: DB): Promise<string> {
  await savePlatformSettings(db, { environment: "sandbox", apiKey: "test-key", webhookToken: null, feeBp: 150, planGestaoCents: 4990, planIntegradoCents: 3990 }, "teste");
  const token = await generateWebhookToken(db, "teste");
  await db.update(platformSettings).set({ asaasWalletId: PLATFORM_WALLET, asaasAccountName: "Plataforma" }).where(eq(platformSettings.id, "default"));
  return token;
}

export async function integratedCharge(db: DB, id: string, options: { amountCents?: number; dueOn?: string; document?: string; integrated?: boolean } = {}) {
  const org = await addOrganization(db, id);
  if (options.integrated !== false) {
    await db.update(organizations).set({ receivingMode: "integrado", asaasWalletId: MERCHANT_WALLET, asaasAccountName: "Loja" }).where(eq(organizations.id, org));
    // Lojista no plano Integrado em dia, para os testes de cobrança não dependerem da data em que rodam.
    await db.insert(subscriptions).values({ id: `sub-${org}`, organizationId: org, planCode: "integrado", status: "ativa", trialEndsOn: "2026-01-01", periodEndsOn: "2099-01-01" });
  }
  const client = await addClient(db, org, "Maria Souza");
  await db.update(clients).set({ document: options.document ?? VALID_CPF, email: "maria@exemplo.com" }).where(eq(clients.id, client));
  const chargeId = await createCharge(db, org, { clientId: client, amountCents: cents(options.amountCents ?? 10_000), dueOn: options.dueOn ?? "2099-01-01", method: "Pix" });
  return { org, client, chargeId };
}

export async function chargeRow(db: DB, chargeId: string) {
  const [row] = await db.select().from(charges).where(eq(charges.id, chargeId));
  return row;
}

export function webhookRequest(body: unknown, token: string | null): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token !== null) headers["asaas-access-token"] = token;
  return new Request("http://localhost/api/webhooks/asaas", { method: "POST", headers, body: JSON.stringify(body) });
}

let eventSequence = 0;
const nextEventId = () => `evt_teste_${(eventSequence += 1)}`;

export const paymentEvent = (event: string, paymentId: string, payment: Record<string, unknown> = {}) => ({ id: nextEventId(), event, payment: { id: paymentId, ...payment } });
export const subscriptionEvent = (event: string, subscriptionId: string, subscription: Record<string, unknown> = {}) => ({ id: nextEventId(), event, subscription: { id: subscriptionId, ...subscription } });
