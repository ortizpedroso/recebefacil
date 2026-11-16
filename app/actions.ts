"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { DomainError, changeDueDate, createSale, registerPayment, reverseCharge, setRecurrenceStatus } from "../lib/ledger";
import { cents, parseReais } from "../lib/money";
import { requireSession } from "../lib/session";
import { catalogSchema, clientSchema, contactSchema, dueSchema, paymentSchema, saleSchema } from "../lib/schemas";
import { catalogItems, clients, contacts, integrationEvents, organizations } from "../lib/schema";
import { insertCatalog, insertClient, resetOrganization } from "../lib/tenant";

function fail(error: unknown) {
  if (error instanceof DomainError) return { ok: false as const, error: error.message };
  return { ok: false as const, error: "Não foi possível concluir. Revise os dados." };
}

export async function createClientAction(raw: unknown) {
  const parsed = clientSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Revise os dados do cliente." };
  const digits = parsed.data.document.replace(/\D/g, "");
  if (digits.length !== 11 && digits.length !== 14) return { ok: false as const, error: "Informe um CPF ou CNPJ." };
  const { db, org } = await requireSession();
  await insertClient(db, org.id, { ...parsed.data, whatsapp: parsed.data.whatsapp || parsed.data.phone });
  revalidatePath("/clientes");
  return { ok: true as const };
}

export async function createCatalogAction(raw: unknown) {
  const parsed = catalogSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Revise o item do catálogo." };
  try {
    const priceCents = parseReais(parsed.data.price);
    const { db, org } = await requireSession();
    await insertCatalog(db, org.id, { ...parsed.data, priceCents, sku: parsed.data.sku || "" });
    revalidatePath("/produtos");
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function toggleCatalogAction(id: string, active: boolean) {
  const { db, org } = await requireSession();
  await db.update(catalogItems).set({ active }).where(and(eq(catalogItems.organizationId, org.id), eq(catalogItems.id, id)));
  revalidatePath("/produtos");
}

export async function createSaleAction(raw: unknown) {
  const parsed = saleSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Revise a venda." };
  try {
    const { db, org } = await requireSession();
    const saleId = await createSale(db, org.id, {
      clientId: parsed.data.clientId,
      soldOn: parsed.data.soldOn,
      discountCents: parseReais(parsed.data.discount || "0"),
      notes: parsed.data.notes,
      mode: parsed.data.mode,
      entryCents: parseReais(parsed.data.entry || "0"),
      installmentCount: parsed.data.installmentCount,
      firstDue: parsed.data.firstDue,
      periodicity: parsed.data.periodicity,
      method: parsed.data.method,
      makeContract: parsed.data.makeContract,
      items: parsed.data.items.map((item) => ({ ...item, unitCents: cents(item.unitCents) })),
    });
    revalidatePath("/vendas");
    revalidatePath("/");
    return { ok: true as const, saleId };
  } catch (error) {
    return fail(error);
  }
}

export async function payAction(raw: unknown) {
  const parsed = paymentSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Revise o pagamento." };
  try {
    const { db, org } = await requireSession();
    await registerPayment(db, org.id, {
      chargeId: parsed.data.chargeId,
      amountCents: parseReais(parsed.data.amount),
      paidOn: parsed.data.paidOn,
      method: parsed.data.method,
      note: parsed.data.note,
    });
    revalidatePath("/parcelas");
    revalidatePath("/");
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function reverseAction(chargeId: string) {
  try {
    const { db, org } = await requireSession();
    await reverseCharge(db, org.id, chargeId);
    revalidatePath("/cobrancas");
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function dueAction(raw: unknown) {
  const parsed = dueSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Informe o novo vencimento." };
  try {
    const { db, org } = await requireSession();
    await changeDueDate(db, org.id, parsed.data.installmentId, parsed.data.dueOn);
    revalidatePath("/parcelas");
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function recurrenceAction(id: string, status: "ativa" | "suspensa" | "cancelada") {
  const { db, org } = await requireSession();
  await setRecurrenceStatus(db, org.id, id, status);
  revalidatePath("/recorrencias");
}

export async function contactAction(raw: unknown) {
  const parsed = contactSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Revise o contato." };
  const { db, org } = await requireSession();
  const [client] = await db.select().from(clients).where(and(eq(clients.organizationId, org.id), eq(clients.id, parsed.data.clientId)));
  if (!client) return { ok: false as const, error: "Cliente não encontrado." };
  await db.insert(contacts).values({
    id: crypto.randomUUID(),
    organizationId: org.id,
    clientId: parsed.data.clientId,
    chargeId: parsed.data.chargeId,
    channel: parsed.data.channel,
    summary: parsed.data.summary,
    promiseOn: parsed.data.promiseOn || null,
    createdAt: new Date().toISOString(),
  });
  revalidatePath("/inadimplencia");
  return { ok: true as const };
}

const environments = {
  demonstracao: "Demo",
  sandbox: "Sandbox",
  producao: "Produção",
} as const;

export async function asaasAction(command: "connect" | "disconnect" | "sync" | "demonstracao" | "sandbox" | "producao") {
  const { db, org } = await requireSession();
  const now = new Date().toISOString();
  if (command === "connect") {
    await db.update(organizations).set({ asaasConnected: true, asaasEnvironment: "demonstracao", asaasSyncedAt: now }).where(eq(organizations.id, org.id));
    await db.insert(integrationEvents).values({
      id: crypto.randomUUID(),
      organizationId: org.id,
      happenedAt: now,
      kind: "CONEXAO_SIMULADA",
      status: "sucesso",
      description: "Conta demonstrativa marcada como conectada. Nenhuma chave foi armazenada.",
    });
  } else if (command === "disconnect") {
    await db.update(organizations).set({ asaasConnected: false }).where(eq(organizations.id, org.id));
    await db.insert(integrationEvents).values({
      id: crypto.randomUUID(),
      organizationId: org.id,
      happenedAt: now,
      kind: "DESCONEXAO_SIMULADA",
      status: "info",
      description: "Simulação desconectada. Nenhuma cobrança foi enviada.",
    });
  } else if (command === "sync") {
    await db.update(organizations).set({ asaasSyncedAt: now }).where(eq(organizations.id, org.id));
    await db.insert(integrationEvents).values({
      id: crypto.randomUUID(),
      organizationId: org.id,
      happenedAt: now,
      kind: "SINCRONIZACAO_SIMULADA",
      status: "sucesso",
      description: "Sincronização simulada. Nenhuma cobrança saiu para o Asaas.",
    });
  } else {
    await db.update(organizations).set({ asaasEnvironment: command }).where(eq(organizations.id, org.id));
    await db.insert(integrationEvents).values({
      id: crypto.randomUUID(),
      organizationId: org.id,
      happenedAt: now,
      kind: "AMBIENTE_VISUAL",
      status: "info",
      description: `Ambiente visual alterado para ${environments[command]}. Nenhuma credencial foi pedida.`,
    });
  }
  revalidatePath("/integracoes");
}

export async function resetDemoAction() {
  const { db, org, userName } = await requireSession();
  await resetOrganization(db, org.id, userName);
  revalidatePath("/", "layout");
}

export async function companyAction(formData: FormData) {
  const { db, org } = await requireSession();
  await db
    .update(organizations)
    .set({
      tradeName: String(formData.get("tradeName") || org.tradeName),
      legalName: String(formData.get("legalName") || org.legalName),
      document: String(formData.get("document") || org.document),
      email: String(formData.get("email") || org.email),
      phone: String(formData.get("phone") || org.phone),
      address: String(formData.get("address") || org.address),
      timezone: String(formData.get("timezone") || org.timezone),
    })
    .where(eq(organizations.id, org.id));
  revalidatePath("/configuracoes");
}
