import { eq } from "drizzle-orm";
import { accountOf, AsaasError, createAsaasClient } from "./asaas";
import { assertCanReceiveOnline } from "./billing";
import type { DB } from "./db";
import { DomainError } from "./errors";
import { loadPlatformSettings, platformReady } from "./platform-settings";
import { organizations } from "./schema";

// O lojista cola a chave da própria conta uma única vez. Daqui só a carteira e o nome da conta ficam guardados: a chave é descartada.
export async function linkMerchantAccount(db: DB, organizationId: string, apiKey: string, fetchImpl?: typeof fetch): Promise<{ accountName: string }> {
  const settings = await loadPlatformSettings(db);
  if (!platformReady(settings)) throw new DomainError("O recebimento pelo Asaas ainda não está disponível.");
  await assertCanReceiveOnline(db, organizationId);
  const key = apiKey.trim();
  if (key.length < 6) throw new DomainError("Cole a chave de API da sua conta Asaas.");
  const client = createAsaasClient({ apiKey: key, environment: settings.asaasEnvironment, fetch: fetchImpl });
  let account: { name: string; walletId: string };
  try {
    account = await accountOf(client);
  } catch (error) {
    if (error instanceof AsaasError && error.kind === "auth") {
      const where = settings.asaasEnvironment === "sandbox" ? "do ambiente de testes (sandbox)" : "de produção";
      throw new DomainError(`O Asaas não aceitou esta chave. Confira se ela é de uma conta ${where} e se foi copiada inteira.`);
    }
    throw error;
  }
  if (account.walletId.toLowerCase() === settings.asaasWalletId.toLowerCase()) {
    throw new DomainError("Esta chave é da conta da plataforma. Use a chave da sua própria conta Asaas.");
  }
  await db
    .update(organizations)
    .set({ asaasWalletId: account.walletId, asaasAccountName: account.name, receivingMode: "integrado" })
    .where(eq(organizations.id, organizationId));
  return { accountName: account.name };
}

export async function unlinkMerchantAccount(db: DB, organizationId: string): Promise<void> {
  await db.update(organizations).set({ asaasWalletId: "", asaasAccountName: "", receivingMode: "gestao" }).where(eq(organizations.id, organizationId));
}

export async function setReceivingMode(db: DB, organizationId: string, mode: "gestao" | "integrado"): Promise<void> {
  if (mode === "integrado") {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, organizationId));
    const settings = await loadPlatformSettings(db);
    if (!org?.asaasWalletId || !platformReady(settings)) throw new DomainError("Conecte sua conta Asaas para receber no modo Integrado.");
    await assertCanReceiveOnline(db, organizationId);
  }
  await db.update(organizations).set({ receivingMode: mode }).where(eq(organizations.id, organizationId));
}
