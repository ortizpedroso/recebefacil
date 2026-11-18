import assert from "node:assert/strict";
import test from "node:test";
import { accountOf, AsaasError, createAsaasClient, fromReais, isAsaasUrl, stageOf, subscriptionLive, toReais } from "./asaas";
import { cents } from "./money";
import { fakeAsaas } from "./test-asaas";

const sleep = async () => {};

function clientFor(fake: ReturnType<typeof fakeAsaas>, overrides: Partial<Parameters<typeof createAsaasClient>[0]> = {}) {
  return createAsaasClient({ apiKey: "test-key", environment: "sandbox", fetch: fake.fetch, sleep, ...overrides });
}

async function failureOf(run: () => Promise<unknown>): Promise<AsaasError> {
  try {
    await run();
  } catch (error) {
    assert.ok(error instanceof AsaasError, "o erro precisa ser do Asaas");
    return error;
  }
  throw new Error("era para falhar");
}

test("centavos viram reais só na fronteira, sem sobra de ponto flutuante", () => {
  assert.equal(toReais(cents(12_345)), 123.45);
  assert.equal(toReais(cents(10)), 0.1);
  assert.equal(JSON.stringify({ value: toReais(cents(29)) }), '{"value":0.29}');
  assert.equal(fromReais(1.15), 115);
  assert.equal(fromReais(4_500_000.01), 450_000_001);
});

test("cada pedido leva a chave no cabeçalho access_token, o User-Agent e vai ao endereço do ambiente", async () => {
  const fake = fakeAsaas();
  await clientFor(fake).getWallets();
  const [call] = fake.calls;
  assert.equal(call.token, "test-key");
  assert.equal(call.userAgent, "RecebeFacil");
  assert.equal(call.path, "/wallets/");
});

test("sandbox e produção usam hosts diferentes", async () => {
  const hosts: string[] = [];
  const spy = (async (input: URL | string) => {
    hosts.push(new URL(String(input)).origin);
    return new Response(JSON.stringify({ data: [{ id: "w" }] }), { status: 200 });
  }) as typeof fetch;
  await createAsaasClient({ apiKey: "test-key", environment: "sandbox", fetch: spy }).getWallets();
  await createAsaasClient({ apiKey: "test-key", environment: "producao", fetch: spy }).getWallets();
  assert.deepEqual(hosts, ["https://api-sandbox.asaas.com", "https://api.asaas.com"]);
});

test("a cobrança sai com valor em reais, split, referência e vencimento", async () => {
  const fake = fakeAsaas();
  const client = clientFor(fake);
  const created = await client.createPayment({
    customer: "cus_1",
    billingType: "PIX",
    valueCents: cents(123_456),
    dueDate: "2026-11-17",
    description: "Venda de teste",
    externalReference: "charge-1",
    split: [{ walletId: "wallet-loja", percentualValue: 98.5 }],
  });
  const [call] = fake.calls;
  assert.equal(call.method, "POST");
  assert.deepEqual(call.body, {
    customer: "cus_1",
    billingType: "PIX",
    value: 1234.56,
    dueDate: "2026-11-17",
    description: "Venda de teste",
    externalReference: "charge-1",
    split: [{ walletId: "wallet-loja", percentualValue: 98.5 }],
  });
  assert.equal(created.valueCents, 123_456);
  assert.equal(created.externalReference, "charge-1");
  assert.equal(created.status, "PENDING");
});

test("a resposta do Asaas é conferida: campo que falta vira erro tipado, não undefined", async () => {
  const broken = (async () => new Response(JSON.stringify({ id: "pay_1", status: "PENDING" }), { status: 200 })) as typeof fetch;
  const error = await failureOf(() => createAsaasClient({ apiKey: "test-key", environment: "sandbox", fetch: broken }).getPayment("pay_1"));
  assert.equal(error.kind, "response");
});

test("o Pix traz o vencimento do QR em horário de Brasília convertido para UTC", async () => {
  const fake = fakeAsaas({ pixExpiresAt: "2026-11-20 23:59:59" });
  const client = clientFor(fake);
  const payment = await client.createPayment({ customer: "c", billingType: "PIX", valueCents: cents(100), dueDate: "2026-11-17", description: "x", externalReference: "r", split: [] });
  const qr = await client.getPixQrCode(payment.id);
  assert.equal(qr.expiresAt, "2026-11-21T02:59:59.000Z");
  assert.equal(qr.image, `qr-${payment.id}`);
});

test("erros nunca ecoam a chave, nem a do corpo da resposta, e vêm em português", async () => {
  const secret = "$aact_SEGREDO-123456789";
  const fake = fakeAsaas({ apiKey: secret });
  fake.failNext("POST", /payments/, 400, 1, { errors: [{ code: "invalid", description: `Cliente ${secret} inválido` }] });
  const client = clientFor(fake, { apiKey: secret });
  const error = await failureOf(() => client.createPayment({ customer: "c", billingType: "PIX", valueCents: cents(100), dueDate: "2026-11-17", description: "x", externalReference: "r", split: [] }));
  assert.equal(error.kind, "rejected");
  assert.ok(!error.message.includes(secret) && !error.message.includes("aact_"), error.message);
  assert.match(error.message, /\*\*\*/);

  const wrongKey = await failureOf(() => clientFor(fake, { apiKey: "outra-chave" }).getWallets());
  assert.equal(wrongKey.kind, "auth");
  assert.ok(!wrongKey.message.includes("outra-chave"));
  assert.match(wrongKey.message, /chave de API/);
});

test("falha de rede e timeout viram mensagens fixas sem detalhes internos", async () => {
  const down = (async () => {
    throw new Error("connect ECONNREFUSED com access_token=test-key");
  }) as typeof fetch;
  const network = await failureOf(() => createAsaasClient({ apiKey: "test-key", environment: "sandbox", fetch: down, sleep }).getPayment("pay_1"));
  assert.equal(network.kind, "network");
  assert.ok(!network.message.includes("test-key") && !network.message.includes("ECONNREFUSED"));

  const hang = ((_: unknown, init?: RequestInit) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    })) as typeof fetch;
  const slow = await failureOf(() => createAsaasClient({ apiKey: "test-key", environment: "sandbox", fetch: hang, sleep, timeoutMs: 15 }).getPayment("pay_1"));
  assert.equal(slow.kind, "timeout");
});

test("sem chave configurada não sai pedido nenhum", async () => {
  const fake = fakeAsaas();
  const error = await failureOf(() => createAsaasClient({ apiKey: "  ", environment: "sandbox", fetch: fake.fetch }).getWallets());
  assert.equal(error.kind, "config");
  assert.equal(fake.calls.length, 0);
});

test("leitura repete uma vez quando o Asaas cai, mas criação nunca repete", async () => {
  const fake = fakeAsaas();
  const client = clientFor(fake);
  const created = await client.createPayment({ customer: "c", billingType: "PIX", valueCents: cents(100), dueDate: "2026-11-17", description: "x", externalReference: "r", split: [] });

  fake.failNext("GET", /payments/, 503, 1);
  assert.equal((await client.getPayment(created.id)).id, created.id);
  assert.equal(fake.callsTo("GET", /payments/).length, 2, "uma queda e uma repetição");

  fake.failNext("GET", /payments/, 500, 2);
  assert.equal((await failureOf(() => client.getPayment(created.id))).kind, "server");

  const before = fake.callsTo("POST", /payments/).length;
  fake.failNext("POST", /payments/, 500, 2);
  const error = await failureOf(() => client.createPayment({ customer: "c", billingType: "PIX", valueCents: cents(100), dueDate: "2026-11-17", description: "x", externalReference: "r", split: [] }));
  assert.equal(error.kind, "server");
  assert.equal(fake.callsTo("POST", /payments/).length - before, 1, "o POST saiu uma vez só");
});

test("cliente achado pelo CPF é reaproveitado e o novo é criado com os contatos", async () => {
  const fake = fakeAsaas();
  const client = clientFor(fake);
  const first = await client.findOrCreateCustomer({ name: "Maria Souza", cpfCnpj: "39053344705", email: "maria@exemplo.com", phone: "11988887777" });
  assert.deepEqual(fake.callsTo("POST", /customers/)[0].body, { name: "Maria Souza", cpfCnpj: "39053344705", email: "maria@exemplo.com", mobilePhone: "11988887777" });
  const second = await client.findOrCreateCustomer({ name: "Maria S.", cpfCnpj: "39053344705" });
  assert.equal(second, first);
  assert.equal(fake.callsTo("POST", /customers/).length, 1);
});

test("receber em dinheiro, desfazer e excluir falam com os endereços certos", async () => {
  const fake = fakeAsaas();
  const client = clientFor(fake);
  const { id } = await client.createPayment({ customer: "c", billingType: "BOLETO", valueCents: cents(5_000), dueDate: "2026-11-20", description: "x", externalReference: "r", split: [] });
  const received = await client.receiveInCash(id, cents(5_000), "2026-11-17");
  assert.equal(received.status, "RECEIVED_IN_CASH");
  assert.deepEqual(fake.callsTo("POST", /receiveInCash/)[0].body, { paymentDate: "2026-11-17", value: 50, notifyCustomer: false });
  assert.equal((await client.undoReceivedInCash(id)).status, "PENDING");
  assert.equal(await client.getIdentificationField(id), `34191.79001 ${id}`);
  await client.deletePayment(id);
  assert.equal((await failureOf(() => client.getPayment(id))).kind, "notfound");
});

test("a conta é descoberta pela carteira, e a falta de nome não impede", async () => {
  const fake = fakeAsaas({ wallets: { "test-key": "wallet-xyz" } });
  assert.deepEqual(await accountOf(clientFor(fake)), { name: "Loja de Teste", walletId: "wallet-xyz" });
  const noAccount = fakeAsaas({ wallets: { "test-key": "wallet-xyz" } });
  noAccount.failNext("GET", /myAccount/, 404, 1);
  assert.deepEqual(await accountOf(clientFor(noAccount)), { name: "", walletId: "wallet-xyz" });
});

test("status do Asaas viram etapas e status novo fica desconhecido", () => {
  assert.equal(stageOf("RECEIVED"), "paid");
  assert.equal(stageOf("CONFIRMED"), "paid");
  assert.equal(stageOf("RECEIVED_IN_CASH"), "paid");
  assert.equal(stageOf("PENDING"), "open");
  assert.equal(stageOf("REFUNDED"), "dead");
  assert.equal(stageOf("CHARGEBACK_REQUESTED"), "dead");
  assert.equal(stageOf("ALGO_NOVO"), "unknown");
});

test("só link https do próprio Asaas serve de destino do pagador", () => {
  assert.equal(isAsaasUrl("https://sandbox.asaas.com/i/abc"), true);
  assert.equal(isAsaasUrl("https://www.asaas.com/i/abc"), true);
  assert.equal(isAsaasUrl("http://www.asaas.com/i/abc"), false);
  assert.equal(isAsaasUrl("https://asaas.com.malvado.com/i/abc"), false);
  assert.equal(isAsaasUrl("javascript:alert(1)"), false);
});

test("a assinatura sai mensal, com tipo livre e valor em reais, e volta com o valor em centavos", async () => {
  const fake = fakeAsaas();
  const client = clientFor(fake);
  const created = await client.createSubscription({ customer: "cus_1", valueCents: cents(4_990), nextDueDate: "2026-11-17", description: "RecebeFácil plano Gestão", externalReference: "sub:org-1" });
  assert.deepEqual(fake.callsTo("POST", /^\/subscriptions$/)[0].body, {
    customer: "cus_1",
    billingType: "UNDEFINED",
    value: 49.9,
    nextDueDate: "2026-11-17",
    cycle: "MONTHLY",
    description: "RecebeFácil plano Gestão",
    externalReference: "sub:org-1",
  });
  assert.equal(created.valueCents, 4_990);
  assert.equal(created.externalReference, "sub:org-1");
  assert.equal(subscriptionLive(created), true);

  const updated = await client.updateSubscription(created.id, { valueCents: cents(3_990), description: "RecebeFácil plano Integrado" });
  assert.deepEqual(fake.callsTo("POST", new RegExp(`^/subscriptions/${created.id}$`))[0].body, { value: 39.9, description: "RecebeFácil plano Integrado", updatePendingPayments: true });
  assert.equal(updated.valueCents, 3_990);

  const [first] = await client.listSubscriptionPayments(created.id);
  assert.equal(first.externalReference, "sub:org-1");
  assert.equal(first.valueCents, 3_990);
  assert.equal(first.dueDate, "2026-11-17");

  await client.deleteSubscription(created.id);
  const removed = await client.getSubscription(created.id);
  assert.equal(subscriptionLive(removed), false);
});

test("ao procurar assinaturas por referência, o que é de outra referência não entra, mesmo que o Asaas ignore o filtro", async () => {
  const everything = (async () =>
    new Response(
      JSON.stringify({
        data: [
          { id: "sub_a", value: 10, status: "ACTIVE", externalReference: "sub:org-a" },
          { id: "sub_b", value: 10, status: "ACTIVE", externalReference: "sub:org-b" },
          { id: "sub_c", value: 10, status: "ACTIVE", externalReference: null },
        ],
      }),
      { status: 200 },
    )) as unknown as typeof fetch;
  const found = await createAsaasClient({ apiKey: "test-key", environment: "sandbox", fetch: everything }).findSubscriptions("sub:org-b");
  assert.deepEqual(found.map((subscription) => subscription.id), ["sub_b"]);
});

test("resposta de assinatura sem id vira erro de resposta, e erro do Asaas ao criar sai limpo", async () => {
  const bad = (async () => new Response(JSON.stringify({ value: 10 }), { status: 200 })) as unknown as typeof fetch;
  const error = await failureOf(() => createAsaasClient({ apiKey: "test-key", environment: "sandbox", fetch: bad }).getSubscription("sub_x"));
  assert.equal(error.kind, "response");

  const fake = fakeAsaas();
  fake.failNext("POST", /^\/subscriptions$/, 400, 1, { errors: [{ description: "O CPF/CNPJ informado é inválido." }] });
  const rejected = await failureOf(() => clientFor(fake).createSubscription({ customer: "cus_1", valueCents: cents(100), nextDueDate: "2026-11-17", description: "x", externalReference: "sub:o" }));
  assert.equal(rejected.kind, "rejected");
  assert.match(rejected.message, /CPF\/CNPJ/);
  assert.equal(fake.callsTo("POST", /^\/subscriptions$/).length, 1, "criar não repete: poderia cobrar duas vezes");
});
