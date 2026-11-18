import { eq } from "drizzle-orm";
import { createAsaasClient, type AsaasClient, type NewAccount } from "./asaas";
import { assertCanReceiveOnline } from "./billing";
import { decryptSecret, encryptSecret } from "./crypto";
import type { DB } from "./db";
import { documentKind } from "./documents";
import { DomainError } from "./errors";
import { cents, parseReais } from "./money";
import { loadPlatformSettings, platformClientFor, platformReady, type PlatformSettingsRow } from "./platform-settings";
import { organizations, type SubaccountStatus } from "./schema";

type Org = typeof organizations.$inferSelect;

export const SUBACCOUNT_LABEL: Record<SubaccountStatus, string> = {
  "": "Sem conta",
  pendente: "Aguardando validação",
  em_analise: "Em análise no Asaas",
  aprovada: "Aprovada",
  reprovada: "Reprovada",
};

const COMPANY_TYPES = ["MEI", "LIMITED", "INDIVIDUAL", "ASSOCIATION"] as const;
const digits = (value: unknown) => String(value ?? "").replace(/\D/g, "");
const field = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);

// O formulário vira exatamente o que o Asaas aceita. Cada recusa diz o campo, para a pessoa não adivinhar.
export function parseSubaccountForm(raw: Record<string, unknown>, company: { name: string; email: string }): NewAccount {
  const cpfCnpj = digits(raw.document);
  const kind = documentKind(cpfCnpj);
  if (!kind) throw new DomainError("Informe um CPF ou CNPJ válido.");
  const name = field(raw.name, 100) || company.name;
  if (name.length < 2) throw new DomainError("Informe o nome do titular da conta.");
  const email = field(raw.email, 200) || company.email;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new DomainError("Informe um e-mail válido. O Asaas manda o acesso da conta para ele.");
  const birthDate = field(raw.birthDate, 10);
  if (kind === "pf" && !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) throw new DomainError("Para CPF, informe a data de nascimento.");
  const companyType = field(raw.companyType, 20);
  if (kind === "pj" && !(COMPANY_TYPES as readonly string[]).includes(companyType)) throw new DomainError("Escolha o tipo de empresa.");
  const mobilePhone = digits(raw.phone);
  if (mobilePhone.length !== 10 && mobilePhone.length !== 11) throw new DomainError("Informe o celular com DDD.");
  let income: number;
  try {
    income = parseReais(String(raw.income ?? ""));
  } catch {
    throw new DomainError("Informe o faturamento mensal, por exemplo 5.000,00.");
  }
  if (income <= 0) throw new DomainError("Informe o faturamento mensal, por exemplo 5.000,00.");
  const postalCode = digits(raw.zip);
  if (postalCode.length !== 8) throw new DomainError("Informe o CEP com 8 números.");
  const address = field(raw.street, 120);
  const addressNumber = field(raw.number, 20);
  const province = field(raw.district, 80);
  if (!address || !addressNumber || !province) throw new DomainError("Informe rua, número e bairro.");
  const complement = field(raw.complement, 80);
  return {
    name,
    email,
    cpfCnpj,
    ...(kind === "pf" ? { birthDate } : { companyType: companyType as NewAccount["companyType"] }),
    mobilePhone,
    incomeValueCents: cents(income),
    address,
    addressNumber,
    ...(complement ? { complement } : {}),
    province,
    postalCode,
  };
}

export function statusFromAsaas(general: string): SubaccountStatus {
  if (general === "APPROVED") return "aprovada";
  if (general === "REJECTED") return "reprovada";
  if (general === "AWAITING_APPROVAL") return "em_analise";
  return "pendente";
}

export function subaccountClient(org: Pick<Org, "asaasAccountKeyEnc">, settings: PlatformSettingsRow, fetchImpl?: typeof fetch): AsaasClient | null {
  if (!org.asaasAccountKeyEnc) return null;
  return createAsaasClient({ apiKey: decryptSecret(org.asaasAccountKeyEnc), environment: settings.asaasEnvironment, fetch: fetchImpl });
}

// A conta nasce pela chave da plataforma. O Asaas devolve a chave da subconta uma única vez: ela é cifrada antes de tocar o banco.
export async function openSubaccount(db: DB, organizationId: string, raw: Record<string, unknown>, fetchImpl?: typeof fetch): Promise<{ status: SubaccountStatus }> {
  const settings = await loadPlatformSettings(db);
  if (!platformReady(settings)) throw new DomainError("O recebimento pelo Asaas ainda não está disponível.");
  await assertCanReceiveOnline(db, organizationId);
  const [org] = await db.select().from(organizations).where(eq(organizations.id, organizationId));
  if (!org) throw new DomainError("Empresa não encontrada.");
  if (org.asaasAccountId) throw new DomainError("Sua conta de recebimento já foi aberta.");
  if (org.asaasWalletId) throw new DomainError("Sua empresa já recebe por uma conta Asaas ligada. Desligue-a antes de abrir outra.");
  const input = parseSubaccountForm(raw, { name: org.legalName || org.tradeName, email: org.email });
  const account = await platformClientFor(settings, fetchImpl).createAccount(input);
  await db
    .update(organizations)
    .set({
      asaasAccountId: account.id,
      asaasAccountKeyEnc: encryptSecret(account.apiKey),
      asaasAccountStatus: "pendente",
      asaasWalletId: account.walletId,
      asaasAccountName: input.name,
      receivingMode: "integrado",
      ...(org.document ? {} : { document: input.cpfCnpj }),
    })
    .where(eq(organizations.id, organizationId));
  return { status: "pendente" };
}

// Lido a cada visita à tela: converge para o que o Asaas diz, sem depender de webhook.
export async function refreshSubaccountStatus(db: DB, org: Org, settings: PlatformSettingsRow, fetchImpl?: typeof fetch): Promise<SubaccountStatus> {
  const client = subaccountClient(org, settings, fetchImpl);
  if (!client || org.asaasAccountStatus === "aprovada") return org.asaasAccountStatus;
  const status = statusFromAsaas((await client.getAccountStatus()).general);
  if (status !== org.asaasAccountStatus) await db.update(organizations).set({ asaasAccountStatus: status }).where(eq(organizations.id, org.id));
  return status;
}
