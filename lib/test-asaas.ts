import { eq } from "drizzle-orm";
import type { DB } from "./db";
import { createCharge } from "./ledger";
import { cents } from "./money";
import { generateWebhookToken, savePlatformSettings } from "./platform-settings";
import { charges, clients, organizations, platformSettings } from "./schema";
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
};

type Options = {
  apiKey?: string;
  wallets?: Record<string, string>;
  accountName?: string;
  pixExpiresAt?: string;
};

type Failure = { method: string; path: RegExp; status: number; body?: unknown; times: number };

export function fakeAsaas(options: Options = {}) {
  const apiKey = options.apiKey ?? "test-key";
  const wallets = options.wallets ?? { [apiKey]: "wallet-platform" };
  const calls: FakeCall[] = [];
  const payments = new Map<string, FakePayment>();
  const customers = new Map<string, string>();
  const failures: Failure[] = [];
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
  });

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

    if (method === "GET" && path === "/wallets/") return json(200, { object: "list", data: [{ id: wallets[key] }] });
    if (method === "GET" && path === "/myAccount") return json(200, { name: options.accountName ?? "Loja de Teste", walletId: wallets[key] });
    if (method === "GET" && path === "/customers") {
      const found = customers.get(call.query.cpfCnpj ?? "");
      return json(200, { object: "list", data: found ? [{ id: found }] : [] });
    }
    if (method === "POST" && path === "/customers") {
      sequence += 1;
      const id = `cus_${sequence}`;
      customers.set(String(call.body?.cpfCnpj), id);
      return json(200, { object: "customer", id });
    }
    if (method === "POST" && path === "/payments") {
      sequence += 1;
      const body = call.body ?? {};
      const payment: FakePayment = {
        id: `pay_${sequence}`,
        customer: String(body.customer),
        value: Number(body.value),
        billingType: String(body.billingType),
        status: "PENDING",
        dueDate: String(body.dueDate),
        externalReference: body.externalReference === undefined ? null : String(body.externalReference),
        description: String(body.description ?? ""),
        split: (body.split as FakePayment["split"] | undefined) ?? [],
        paymentDate: null,
        deleted: false,
      };
      payments.set(payment.id, payment);
      return json(200, view(payment));
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
    customers,
    state,
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
