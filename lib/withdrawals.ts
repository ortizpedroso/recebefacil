import { randomUUID } from "node:crypto";
import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { AsaasError, type AsaasTransfer, type PixKeyType } from "./asaas";
import type { DB } from "./db";
import { DomainError } from "./errors";
import { withdrawalFeeCents } from "./fees";
import { cents, type Cents } from "./money";
import type { PlatformSettingsRow } from "./platform-settings";
import { organizations, withdrawals, type WithdrawalStatus } from "./schema";
import { subaccountClient } from "./subaccount";

type Org = typeof organizations.$inferSelect;
export type WithdrawalRow = typeof withdrawals.$inferSelect;

export const WITHDRAWAL_LABEL: Record<WithdrawalStatus, string> = {
  pendente: "Enviando",
  processando: "Em processamento",
  pago: "Pago",
  falhou: "Falhou",
  cancelado: "Cancelado",
};

const OPEN: WithdrawalStatus[] = ["pendente", "processando"];

export function statusFromTransfer(status: string): WithdrawalStatus {
  if (status === "DONE") return "pago";
  if (status === "FAILED") return "falhou";
  if (status === "CANCELLED") return "cancelado";
  return "processando";
}

export function inferPixKeyType(key: string): { key: string; type: PixKeyType } {
  const value = key.trim();
  if (value.includes("@")) return { key: value.toLowerCase(), type: "EMAIL" };
  const numbers = value.replace(/\D/g, "");
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) return { key: value.toLowerCase(), type: "EVP" };
  if (numbers.length === 14) return { key: numbers, type: "CNPJ" };
  if (value.startsWith("+") || value.startsWith("(")) return { key: numbers, type: "PHONE" };
  if (numbers.length === 11) return { key: numbers, type: "CPF" };
  if (numbers.length === 10) return { key: numbers, type: "PHONE" };
  throw new DomainError("Chave Pix inválida. Use CPF, CNPJ, e-mail, celular ou chave aleatória.");
}

function monthStart(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

async function countThisMonth(db: DB, organizationId: string, now: Date): Promise<number> {
  const rows = await db
    .select({ id: withdrawals.id, status: withdrawals.status })
    .from(withdrawals)
    .where(and(eq(withdrawals.organizationId, organizationId), gte(withdrawals.createdAt, monthStart(now))));
  return rows.filter((row) => row.status !== "falhou" && row.status !== "cancelado").length;
}

function applyTransfer(transfer: AsaasTransfer, now: Date) {
  return {
    asaasTransferId: transfer.id,
    status: statusFromTransfer(transfer.status),
    feeCents: transfer.feeCents,
    failReason: transfer.failReason,
    updatedAt: now.toISOString(),
  };
}

export type WalletView = {
  balanceCents: number | null;
  nextFeeCents: number;
  usedThisMonth: number;
  history: WithdrawalRow[];
};

// Saldo e histórico vêm do Asaas a cada visita: os saques em aberto convergem para o status de lá.
export async function loadWallet(db: DB, org: Org, settings: PlatformSettingsRow, now = new Date(), fetchImpl?: typeof fetch): Promise<WalletView> {
  const client = subaccountClient(org, settings, fetchImpl);
  const open = await db.select().from(withdrawals).where(and(eq(withdrawals.organizationId, org.id), inArray(withdrawals.status, OPEN)));
  let balanceCents: number | null = null;
  if (client) {
    for (const row of open) {
      if (!row.asaasTransferId) continue;
      try {
        const transfer = await client.getTransfer(row.asaasTransferId);
        await db.update(withdrawals).set(applyTransfer(transfer, now)).where(eq(withdrawals.id, row.id));
      } catch (error) {
        if (!(error instanceof AsaasError)) throw error;
      }
    }
    try {
      balanceCents = (await client.getBalance()).balanceCents;
    } catch (error) {
      if (!(error instanceof AsaasError)) throw error;
    }
  }
  const usedThisMonth = await countThisMonth(db, org.id, now);
  const history = await db.select().from(withdrawals).where(eq(withdrawals.organizationId, org.id)).orderBy(desc(withdrawals.createdAt)).limit(30);
  return { balanceCents, nextFeeCents: withdrawalFeeCents(usedThisMonth), usedThisMonth, history };
}

// O registro nasce antes da chamada: se a resposta do Asaas se perder, o saque continua rastreável pelo externalReference.
export async function requestWithdrawal(
  db: DB,
  org: Org,
  settings: PlatformSettingsRow,
  input: { amountCents: Cents; pixKey: string },
  now = new Date(),
  fetchImpl?: typeof fetch,
): Promise<WithdrawalRow> {
  const client = subaccountClient(org, settings, fetchImpl);
  if (!client) throw new DomainError("Abra sua conta de recebimento para sacar.");
  if (org.asaasAccountStatus !== "aprovada") throw new DomainError("O saque fica liberado quando o Asaas aprovar sua conta.");
  if (input.amountCents <= 0) throw new DomainError("Informe o valor do saque.");
  const pix = inferPixKeyType(input.pixKey);
  const fee = withdrawalFeeCents(await countThisMonth(db, org.id, now));
  const { balanceCents } = await client.getBalance();
  if (input.amountCents + fee > balanceCents) throw new DomainError("O valor com a tarifa passa do saldo disponível.");
  const id = randomUUID();
  const stamp = now.toISOString();
  await db.insert(withdrawals).values({ id, organizationId: org.id, amountCents: input.amountCents, feeCents: fee, pixKey: pix.key, pixKeyType: pix.type, status: "pendente", createdAt: stamp, updatedAt: stamp });
  try {
    const transfer = await client.createTransfer({ valueCents: input.amountCents, pixKey: pix.key, pixKeyType: pix.type, description: `Saque ${org.tradeName}`, externalReference: id });
    await db.update(withdrawals).set(applyTransfer(transfer, now)).where(eq(withdrawals.id, id));
  } catch (error) {
    const reason = error instanceof AsaasError ? error.message : "Falha ao pedir o saque.";
    await db.update(withdrawals).set({ status: "falhou", failReason: reason, updatedAt: stamp }).where(eq(withdrawals.id, id));
    throw error instanceof AsaasError ? new DomainError(reason) : error;
  }
  const [row] = await db.select().from(withdrawals).where(eq(withdrawals.id, id));
  return row;
}

// Webhook de autorização de saque do Asaas: só passa transferência que nasceu aqui, com o mesmo valor.
export async function authorizeTransfer(db: DB, transfer: { id?: string | null; value?: number | null; externalReference?: string | null }): Promise<{ approved: boolean; reason: string }> {
  const reference = transfer.externalReference ?? "";
  const byReference = reference ? await db.select().from(withdrawals).where(eq(withdrawals.id, reference)) : [];
  const byTransfer = !byReference.length && transfer.id ? await db.select().from(withdrawals).where(eq(withdrawals.asaasTransferId, transfer.id)) : [];
  const row = byReference[0] ?? byTransfer[0];
  if (!row) return { approved: false, reason: "Saque desconhecido pela plataforma." };
  if (!OPEN.includes(row.status)) return { approved: false, reason: "Saque já encerrado." };
  if (cents(Math.round((transfer.value ?? 0) * 100)) !== row.amountCents) return { approved: false, reason: "Valor diferente do saque pedido." };
  return { approved: true, reason: "" };
}
