import { randomBytes } from "node:crypto";
import { and, eq, inArray, isNotNull, ne } from "drizzle-orm";
import { z } from "zod";
import { accountOf, AsaasError, createAsaasClient, type AsaasClient, type AsaasEnvironment } from "./asaas";
import { NO_LINK } from "./asaas-link";
import { decryptSecret, encryptSecret, safeEqual, SecretUnreadableError } from "./crypto";
import type { DB } from "./db";
import { DomainError } from "./errors";
import { parsePercentBp, parseReais } from "./money";
import { charges, clients, organizations, platformInvoices, platformSettings, subscriptions } from "./schema";
import { CHARGE_STATES } from "./status";

export type PlatformSettingsRow = typeof platformSettings.$inferSelect;

export const MAX_PLATFORM_FEE_BP = 2000;
const MAX_PLAN_CENTS = 1_000_000;
const OPEN_STATUSES = CHARGE_STATES.filter((state) => state.open).map((state) => state.status);

export type SecretView = { configured: boolean; hint: string };

// O que a tela pode ver. Nada aqui leva chave, token ou texto cifrado: só se existe e os últimos quatro caracteres.
export type PlatformSettingsView = {
  environment: AsaasEnvironment;
  apiKey: SecretView;
  webhookToken: SecretView;
  walletId: string;
  accountName: string;
  feeBp: number;
  planGestaoCents: number;
  planIntegradoCents: number;
  updatedAt: string;
  updatedBy: string;
  ready: boolean;
};

export function platformReady(row: PlatformSettingsRow): boolean {
  return Boolean(row.asaasApiKeyEnc && row.asaasWalletId && row.asaasWebhookTokenEnc);
}

// O lojista só vende pelo Asaas quando escolheu o modo Integrado, ligou a própria conta e a plataforma está pronta.
export function isIntegrated(org: { receivingMode: string; asaasWalletId: string }, platform: PlatformSettingsRow): boolean {
  return org.receivingMode === "integrado" && Boolean(org.asaasWalletId) && platformReady(platform);
}

export function platformSettingsView(row: PlatformSettingsRow): PlatformSettingsView {
  return {
    environment: row.asaasEnvironment,
    apiKey: { configured: Boolean(row.asaasApiKeyEnc), hint: row.asaasApiKeyHint },
    webhookToken: { configured: Boolean(row.asaasWebhookTokenEnc), hint: row.asaasWebhookTokenHint },
    walletId: row.asaasWalletId,
    accountName: row.asaasAccountName,
    feeBp: row.platformFeeBp,
    planGestaoCents: row.planGestaoCents,
    planIntegradoCents: row.planIntegradoCents,
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy,
    ready: platformReady(row),
  };
}

// A migração já cria a linha. O insert abaixo só cobre banco apagado à mão, e a leitura comum não escreve nada.
export async function loadPlatformSettings(db: DB): Promise<PlatformSettingsRow> {
  const [existing] = await db.select().from(platformSettings).where(eq(platformSettings.id, "default"));
  if (existing) return existing;
  await db.insert(platformSettings).values({ id: "default" }).onConflictDoNothing();
  const [row] = await db.select().from(platformSettings).where(eq(platformSettings.id, "default"));
  if (!row) throw new Error("Configuração da plataforma indisponível.");
  return row;
}

export type PlatformSettingsInput = {
  environment: AsaasEnvironment;
  apiKey: string | null;
  webhookToken: string | null;
  feeBp: number;
  planGestaoCents: number;
  planIntegradoCents: number;
};

const formSchema = z.object({
  environment: z.enum(["sandbox", "producao"], { message: "Escolha o ambiente." }),
  apiKey: z.string().trim().max(300).default(""),
  webhookToken: z.string().trim().max(300).default(""),
  fee: z.string().trim(),
  planGestao: z.string().trim(),
  planIntegrado: z.string().trim(),
});

function reaisOrFail(value: string, message: string) {
  try {
    const parsed = parseReais(value);
    if (parsed <= MAX_PLAN_CENTS) return parsed;
  } catch {
    // cai na mensagem abaixo
  }
  throw new DomainError(message);
}

// Campo de segredo em branco mantém o valor salvo: a tela nunca recebe o segredo de volta para reenviar.
export function parsePlatformForm(raw: Record<string, unknown>): PlatformSettingsInput {
  const parsed = formSchema.safeParse(raw);
  if (!parsed.success) throw new DomainError(parsed.error.issues[0]?.message || "Revise os campos.");
  const form = parsed.data;
  let feeBp: number;
  try {
    feeBp = parsePercentBp(form.fee);
  } catch {
    throw new DomainError("Informe a taxa como percentual, por exemplo 1,5.");
  }
  if (feeBp > MAX_PLATFORM_FEE_BP) throw new DomainError("A taxa da plataforma vai de 0% a 20%.");
  if (form.apiKey && form.apiKey.length < 6) throw new DomainError("A chave de API parece curta demais. Copie a chave inteira do Asaas.");
  if (form.webhookToken && (form.webhookToken.length < 32 || form.webhookToken.length > 255)) {
    throw new DomainError("O token do webhook precisa ter de 32 a 255 caracteres. Use o botão Gerar token.");
  }
  return {
    environment: form.environment,
    apiKey: form.apiKey || null,
    webhookToken: form.webhookToken || null,
    feeBp,
    planGestaoCents: reaisOrFail(form.planGestao, "Informe o preço do plano Gestão, por exemplo 49,90."),
    planIntegradoCents: reaisOrFail(form.planIntegrado, "Informe o preço do plano Integrado, por exemplo 39,90."),
  };
}

const hintOf = (secret: string) => secret.slice(-4);

// Trocar de ambiente invalida tudo que o Asaas de antes conhecia: clientes, cobranças ainda abertas e carteiras dos lojistas.
async function forgetAsaasWorld(tx: DB) {
  await tx.update(clients).set({ asaasCustomerId: null }).where(isNotNull(clients.asaasCustomerId));
  await tx
    .update(charges)
    .set(NO_LINK)
    .where(and(isNotNull(charges.asaasPaymentId), inArray(charges.status, [...OPEN_STATUSES])));
  await tx.update(organizations).set({ receivingMode: "gestao", asaasWalletId: "", asaasAccountName: "" }).where(ne(organizations.asaasWalletId, ""));
  await tx.update(organizations).set({ asaasCustomerId: null }).where(isNotNull(organizations.asaasCustomerId));
  // Assinatura e faturas do plano também moram no Asaas de antes. O acesso segue até o fim do que foi pago, e o lojista contrata de novo.
  await tx.update(subscriptions).set({ asaasSubscriptionId: null, status: "cancelada" }).where(isNotNull(subscriptions.asaasSubscriptionId));
  await tx.update(platformInvoices).set({ status: "cancelada" }).where(inArray(platformInvoices.status, ["aberta", "vencida"]));
}

export async function savePlatformSettings(db: DB, input: PlatformSettingsInput, updatedBy: string, now: Date = new Date()): Promise<void> {
  await loadPlatformSettings(db);
  await db.transaction(async (transaction) => {
    const tx = transaction as DB;
    const [current] = await tx.select().from(platformSettings).where(eq(platformSettings.id, "default")).for("update");
    if (!current) throw new Error("Configuração da plataforma indisponível.");
    const environmentChanged = current.asaasEnvironment !== input.environment;
    await tx
      .update(platformSettings)
      .set({
        asaasEnvironment: input.environment,
        ...(input.apiKey ? { asaasApiKeyEnc: encryptSecret(input.apiKey), asaasApiKeyHint: hintOf(input.apiKey) } : {}),
        ...(input.webhookToken ? { asaasWebhookTokenEnc: encryptSecret(input.webhookToken), asaasWebhookTokenHint: hintOf(input.webhookToken) } : {}),
        ...(environmentChanged ? { asaasWalletId: "", asaasAccountName: "" } : {}),
        platformFeeBp: input.feeBp,
        planGestaoCents: input.planGestaoCents,
        planIntegradoCents: input.planIntegradoCents,
        updatedAt: now.toISOString(),
        updatedBy,
      })
      .where(eq(platformSettings.id, "default"));
    if (environmentChanged) await forgetAsaasWorld(tx);
  });
}

// O token aparece uma única vez, na resposta desta chamada. No banco fica só cifrado.
export async function generateWebhookToken(db: DB, updatedBy: string, now: Date = new Date()): Promise<string> {
  await loadPlatformSettings(db);
  const token = randomBytes(32).toString("base64url");
  await db
    .update(platformSettings)
    .set({ asaasWebhookTokenEnc: encryptSecret(token), asaasWebhookTokenHint: hintOf(token), updatedAt: now.toISOString(), updatedBy })
    .where(eq(platformSettings.id, "default"));
  return token;
}

// A chave só é decifrada aqui, na hora de montar o cliente do Asaas, e nunca sai deste objeto.
export function platformClientFor(row: PlatformSettingsRow, fetchImpl?: typeof fetch): AsaasClient {
  if (!row.asaasApiKeyEnc) throw new AsaasError("config", "O Asaas da plataforma ainda não foi configurado.");
  let apiKey: string;
  try {
    apiKey = decryptSecret(row.asaasApiKeyEnc);
  } catch (error) {
    if (error instanceof SecretUnreadableError) throw new AsaasError("config", "A chave de API salva não pode ser lida. Salve a chave de novo em Plataforma.");
    throw error;
  }
  return createAsaasClient({ apiKey, environment: row.asaasEnvironment, fetch: fetchImpl });
}

export async function platformClient(db: DB, fetchImpl?: typeof fetch): Promise<{ client: AsaasClient; settings: PlatformSettingsRow }> {
  const settings = await loadPlatformSettings(db);
  return { client: platformClientFor(settings, fetchImpl), settings };
}

export async function testPlatformConnection(db: DB, fetchImpl?: typeof fetch): Promise<{ accountName: string; environment: AsaasEnvironment; walletId: string }> {
  const { client, settings } = await platformClient(db, fetchImpl);
  const account = await accountOf(client);
  await db
    .update(platformSettings)
    .set({ asaasWalletId: account.walletId, asaasAccountName: account.name })
    .where(and(eq(platformSettings.id, "default"), eq(platformSettings.asaasEnvironment, settings.asaasEnvironment)));
  return { accountName: account.name, environment: settings.asaasEnvironment, walletId: account.walletId };
}

export type WebhookTokenCheck = "unconfigured" | "match" | "mismatch";

export function checkWebhookToken(row: PlatformSettingsRow, given: string): WebhookTokenCheck {
  if (!row.asaasWebhookTokenEnc) return "unconfigured";
  let expected: string;
  try {
    expected = decryptSecret(row.asaasWebhookTokenEnc);
  } catch (error) {
    if (error instanceof SecretUnreadableError) return "unconfigured";
    throw error;
  }
  return safeEqual(given, expected) ? "match" : "mismatch";
}
