import { randomBytes, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { asaasApi, billingTypeFor, centsToReais, type AsaasEnvironment } from "./asaas";
import type { DB } from "./db";
import { DomainError } from "./ledger";
import { charges, clients, integrationEvents, organizations } from "./schema";
import { encryptionSecret, openSeal, seal, tokenHash } from "./secrets";

function environmentOf(value: string): AsaasEnvironment {
  if (value === "producao" || value === "sandbox") return value;
  throw new DomainError("Escolha sandbox ou produção.");
}

export async function saveAsaasCredentials(
  db: DB,
  organizationId: string,
  input: { apiKey: string; environment: string },
  fetchImpl: typeof fetch = fetch,
) {
  const apiKey = input.apiKey.trim();
  if (!apiKey.startsWith("$aact_")) throw new DomainError("Cole a chave do Asaas. Ela começa com $aact_.");
  const environment = environmentOf(input.environment);
  let account: { name: string };
  try {
    account = await asaasApi(apiKey, environment, fetchImpl).account();
  } catch (error) {
    throw new DomainError(error instanceof Error ? error.message : "O Asaas recusou a chave.");
  }
  let secret: string;
  try {
    secret = encryptionSecret();
  } catch (error) {
    throw new DomainError(error instanceof Error ? error.message : "Segredo de cifragem ausente.");
  }
  const webhookToken = randomBytes(24).toString("base64url");
  await db
    .update(organizations)
    .set({
      asaasEnvironment: environment,
      asaasConnected: true,
      asaasSyncedAt: new Date().toISOString(),
      asaasApiKeyCipher: seal(apiKey, secret),
      asaasWebhookCipher: seal(webhookToken, secret),
      asaasWebhookHash: tokenHash(webhookToken),
      asaasKeyHint: apiKey.slice(-4),
    })
    .where(eq(organizations.id, organizationId));
  await db.insert(integrationEvents).values({
    id: randomUUID(),
    organizationId,
    happenedAt: new Date().toISOString(),
    kind: "ASAAS_CONTA_VERIFICADA",
    status: "sucesso",
    description: `Conta ${account.name || "Asaas"} verificada. A chave ficou cifrada.`,
  });
  return { accountName: account.name || "Asaas", webhookToken };
}

export async function webhookTokenFor(org: { asaasWebhookCipher: string | null }) {
  if (!org.asaasWebhookCipher) throw new DomainError("Grave a chave do Asaas antes de copiar o token.");
  return openSeal(org.asaasWebhookCipher, encryptionSecret());
}

export async function issueAsaasCharge(db: DB, organizationId: string, chargeId: string, fetchImpl: typeof fetch = fetch) {
  const [org] = await db.select().from(organizations).where(eq(organizations.id, organizationId));
  if (!org?.asaasApiKeyCipher || !org.asaasConnected) throw new DomainError("Conecte a chave do Asaas antes de emitir a cobrança.");
  const [charge] = await db.select().from(charges).where(and(eq(charges.organizationId, organizationId), eq(charges.id, chargeId)));
  if (!charge) throw new DomainError("Cobrança não encontrada.");
  if (charge.invoiceUrl && charge.asaasPaymentId) {
    return { invoiceUrl: charge.invoiceUrl, bankSlipUrl: charge.bankSlipUrl, pixPayload: charge.pixPayload };
  }
  const [client] = await db.select().from(clients).where(and(eq(clients.organizationId, organizationId), eq(clients.id, charge.clientId)));
  if (!client) throw new DomainError("Cliente não encontrado.");
  let apiKey: string;
  try {
    apiKey = openSeal(org.asaasApiKeyCipher, encryptionSecret());
  } catch (error) {
    throw new DomainError(error instanceof Error ? error.message : "Não foi possível abrir a chave cifrada.");
  }
  const api = asaasApi(apiKey, environmentOf(org.asaasEnvironment), fetchImpl);
  try {
  let customerId = client.asaasCustomerId;
  if (!customerId) {
    const created = await api.createCustomer({ name: client.name, document: client.document, email: client.email, phone: client.phone });
    customerId = created.id;
    await db.update(clients).set({ asaasCustomerId: customerId }).where(eq(clients.id, client.id));
  }
  const payment = await api.createPayment({
    customer: customerId,
    billingType: billingTypeFor(charge.method),
    value: centsToReais(charge.amountCents - charge.paidCents),
    dueDate: charge.dueOn,
    description: charge.code,
    externalReference: charge.id,
  });
  let pixPayload: string | null = null;
  if (billingTypeFor(charge.method) === "PIX") {
    const qr = await api.pixQrCode(payment.id);
    pixPayload = qr.payload ?? null;
  }
  await db
    .update(charges)
    .set({
      asaasPaymentId: payment.id,
      invoiceUrl: payment.invoiceUrl ?? null,
      bankSlipUrl: payment.bankSlipUrl ?? null,
      pixPayload,
    })
    .where(eq(charges.id, charge.id));
  return { invoiceUrl: payment.invoiceUrl ?? null, bankSlipUrl: payment.bankSlipUrl ?? null, pixPayload };
  } catch (error) {
    if (error instanceof DomainError) throw error;
    throw new DomainError(error instanceof Error ? error.message : "O Asaas recusou a cobrança.");
  }
}
