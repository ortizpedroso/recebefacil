"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { can, isRole, type Permission } from "../lib/access";
import { isPlan, payPlatformInvoice, subscribe } from "../lib/billing";
import { todayIn } from "../lib/dates";
import { isValidCnpj } from "../lib/documents";
import { DomainError, cancelSale, changeDueDate, createSale, registerPayment, reverseCharge, setContractStatus, setRecurrenceStatus } from "../lib/ledger";
import { cents, parseReais } from "../lib/money";
import { requireSession } from "../lib/session";
import { catalogSchema, clientSchema, contactSchema, dueSchema, paymentSchema, saleSchema } from "../lib/schemas";
import { campaignRecipients, campaigns, catalogItems, clients, contacts, fiscalDocuments, integrationEvents, members, organizations, sales, stockMoves, supportTickets } from "../lib/schema";
import { insertCatalog, insertClient, resetOrganization, updateCatalog, updateClient } from "../lib/tenant";

function fail(error: unknown) {
  if (error instanceof DomainError) return { ok: false as const, error: error.message };
  return { ok: false as const, error: "Não foi possível concluir. Revise os dados." };
}

async function allow(permission: Permission) {
  const session = await requireSession();
  if (!can(session.role, permission)) throw new DomainError("Seu papel não pode fazer esta ação.");
  return session;
}

function parseStock(kind: "produto" | "servico", stock: string) {
  if (kind === "servico" || stock.trim() === "") return null;
  const quantity = Number(stock);
  if (!Number.isInteger(quantity) || quantity < 0) throw new DomainError("Informe o estoque em unidades inteiras.");
  return quantity;
}

export async function createClientAction(raw: unknown) {
  const parsed = clientSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message || "Revise os dados do cliente." };
  try {
    const { db, org } = await allow("clientes.gravar");
    await insertClient(db, org.id, { ...parsed.data, whatsapp: parsed.data.whatsapp || parsed.data.phone });
    revalidatePath("/clientes");
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function updateClientAction(raw: unknown) {
  const parsed = clientSchema.safeParse(raw);
  const id = typeof raw === "object" && raw && "id" in raw ? String(raw.id) : "";
  if (!parsed.success || !id) return { ok: false as const, error: parsed.success ? "Revise os dados do cliente." : parsed.error.issues[0]?.message || "Revise os dados do cliente." };
  try {
    const { db, org } = await allow("clientes.gravar");
    await updateClient(db, org.id, id, { ...parsed.data, whatsapp: parsed.data.whatsapp || parsed.data.phone });
    revalidatePath("/clientes");
    revalidatePath(`/clientes/${id}`);
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function createCatalogAction(raw: unknown) {
  const parsed = catalogSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Revise o item do catálogo." };
  try {
    const priceCents = parseReais(parsed.data.price);
    const { db, org } = await allow("catalogo.gravar");
    const { stock, ...item } = parsed.data;
    await insertCatalog(db, org.id, { ...item, priceCents, sku: item.sku || "", stockQuantity: parseStock(item.kind, stock) });
    revalidatePath("/produtos");
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function updateCatalogAction(id: string, raw: unknown) {
  const parsed = catalogSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Revise o item do catálogo." };
  try {
    const priceCents = parseReais(parsed.data.price);
    const { db, org } = await allow("catalogo.gravar");
    const { stock, ...item } = parsed.data;
    await updateCatalog(db, org.id, id, { ...item, priceCents, sku: item.sku || "", stockQuantity: parseStock(item.kind, stock) });
    revalidatePath("/produtos");
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function toggleCatalogAction(id: string, active: boolean) {
  const { db, org } = await allow("catalogo.gravar");
  await db.update(catalogItems).set({ active }).where(and(eq(catalogItems.organizationId, org.id), eq(catalogItems.id, id)));
  revalidatePath("/produtos");
}

export async function createSaleAction(raw: unknown) {
  const parsed = saleSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Revise a venda." };
  try {
    const { db, org } = await allow("vendas.criar");
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
    const { db, org } = await allow("pagamentos.registrar");
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
    const { db, org } = await allow("pagamentos.estornar");
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
    const { db, org } = await allow("pagamentos.registrar");
    await changeDueDate(db, org.id, parsed.data.installmentId, parsed.data.dueOn);
    revalidatePath("/parcelas");
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function cancelSaleAction(saleId: string) {
  try {
    const { db, org } = await allow("vendas.cancelar");
    await cancelSale(db, org.id, saleId);
    revalidatePath("/vendas");
    revalidatePath("/");
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function contractAction(id: string, status: "ativo" | "suspenso" | "encerrado") {
  try {
    const { db, org } = await allow("contratos.alterar");
    await setContractStatus(db, org.id, id, status);
    revalidatePath("/contratos");
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function recurrenceAction(id: string, status: "ativa" | "suspensa" | "cancelada") {
  const { db, org } = await allow("recorrencias.alterar");
  await setRecurrenceStatus(db, org.id, id, status);
  revalidatePath("/recorrencias");
}

export async function contactAction(raw: unknown) {
  const parsed = contactSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Revise o contato." };
  const { db, org } = await allow("cobrancas.contatar");
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
  const { db, org } = await allow("empresa.gravar");
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
  const { db, org, userName } = await allow("demo.resetar");
  await resetOrganization(db, org.id, userName);
  revalidatePath("/", "layout");
}

export async function companyAction(formData: FormData) {
  const { db, org } = await allow("empresa.gravar");
  const document = String(formData.get("document") || org.document);
  if (!isValidCnpj(document)) return { ok: false as const, error: "CNPJ inválido." };
  await db
    .update(organizations)
    .set({
      tradeName: String(formData.get("tradeName") || org.tradeName),
      legalName: String(formData.get("legalName") || org.legalName),
      document,
      email: String(formData.get("email") || org.email),
      phone: String(formData.get("phone") || org.phone),
      address: String(formData.get("address") || org.address),
      timezone: String(formData.get("timezone") || org.timezone),
    })
    .where(eq(organizations.id, org.id));
  revalidatePath("/configuracoes");
  return { ok: true as const };
}

export async function inviteAction(formData: FormData) {
  try {
    const { db, org } = await allow("equipe.convidar");
    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const role = String(formData.get("role") || "");
    if (name.length < 2 || !email.includes("@") || !isRole(role)) return { ok: false as const, error: "Revise o convite." };
    await db.insert(members).values({ id: crypto.randomUUID(), organizationId: org.id, name, email, role, active: true });
    revalidatePath("/configuracoes");
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function roleAction(memberId: string, role: string) {
  try {
    const { db, org } = await allow("equipe.convidar");
    if (!isRole(role)) return { ok: false as const, error: "Papel inválido." };
    const team = await db.select().from(members).where(eq(members.organizationId, org.id));
    const target = team.find((member) => member.id === memberId);
    if (!target) return { ok: false as const, error: "Pessoa não encontrada." };
    const admins = team.filter((member) => member.role === "administrador" && member.id !== memberId);
    if (target.role === "administrador" && role !== "administrador" && admins.length === 0) {
      return { ok: false as const, error: "A empresa precisa de um administrador." };
    }
    await db.update(members).set({ role }).where(and(eq(members.organizationId, org.id), eq(members.id, memberId)));
    revalidatePath("/configuracoes");
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function subscribeAction(planCode: string) {
  try {
    const { db, org } = await allow("assinatura.gerir");
    if (!isPlan(planCode)) return { ok: false as const, error: "Plano inválido." };
    await subscribe(db, org.id, planCode, todayIn(org.timezone));
    revalidatePath("/assinatura");
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function payPlatformAction(invoiceId: string) {
  try {
    const { db, org } = await allow("assinatura.gerir");
    await payPlatformInvoice(db, org.id, invoiceId, todayIn(org.timezone));
    revalidatePath("/assinatura");
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function issueFiscalAction(saleId: string) {
  try {
    const { db, org } = await allow("fiscal.emitir");
    const [sale] = await db.select().from(sales).where(and(eq(sales.organizationId, org.id), eq(sales.id, saleId)));
    if (!sale || sale.status === "cancelada") return { ok: false as const, error: "Venda indisponível para nota." };
    const existing = await db.select().from(fiscalDocuments).where(and(eq(fiscalDocuments.organizationId, org.id), eq(fiscalDocuments.saleId, saleId)));
    if (existing.some((document) => document.status === "emitida")) return { ok: false as const, error: "Esta venda já tem nota emitida." };
    const issued = await db.select().from(fiscalDocuments).where(eq(fiscalDocuments.organizationId, org.id));
    const number = issued.reduce((max, document) => Math.max(max, document.number), 0) + 1;
    const accessKey = `00${String(number).padStart(8, "0")}${org.id.replace(/\D/g, "").padEnd(34, "0")}`.slice(0, 44);
    await db.insert(fiscalDocuments).values({
      id: crypto.randomUUID(),
      organizationId: org.id,
      saleId,
      number,
      series: "1",
      status: "emitida",
      totalCents: sale.totalCents,
      accessKey,
      issuedAt: new Date().toISOString(),
    });
    revalidatePath("/fiscal");
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function cancelFiscalAction(documentId: string) {
  try {
    const { db, org } = await allow("fiscal.emitir");
    await db.update(fiscalDocuments).set({ status: "cancelada" }).where(and(eq(fiscalDocuments.organizationId, org.id), eq(fiscalDocuments.id, documentId), eq(fiscalDocuments.status, "emitida")));
    revalidatePath("/fiscal");
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function adjustStockAction(itemId: string, quantity: number) {
  try {
    const { db, org } = await allow("estoque.ajustar");
    if (!Number.isInteger(quantity) || quantity < 0) return { ok: false as const, error: "Informe uma quantidade inteira." };
    const [item] = await db.select().from(catalogItems).where(and(eq(catalogItems.organizationId, org.id), eq(catalogItems.id, itemId)));
    if (!item || item.kind === "servico") return { ok: false as const, error: "Serviço não controla estoque." };
    const delta = quantity - (item.stockQuantity ?? 0);
    await db.update(catalogItems).set({ stockQuantity: quantity }).where(eq(catalogItems.id, itemId));
    await db.insert(stockMoves).values({
      id: crypto.randomUUID(),
      organizationId: org.id,
      catalogItemId: itemId,
      saleId: null,
      quantity: delta,
      reason: "ajuste",
      createdAt: new Date().toISOString(),
    });
    revalidatePath("/produtos");
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function campaignAction(formData: FormData) {
  try {
    const { db, org } = await allow("mensagens.enviar");
    const body = String(formData.get("body") || "").trim();
    const ids = formData.getAll("clientId").map(String);
    if (body.length < 3 || ids.length === 0) return { ok: false as const, error: "Escolha clientes e escreva a mensagem. Use {nome}." };
    const selected = await db.select().from(clients).where(eq(clients.organizationId, org.id));
    const targets = selected.filter((client) => ids.includes(client.id) && client.whatsapp);
    if (targets.length === 0) return { ok: false as const, error: "Nenhum cliente com WhatsApp." };
    const campaignId = crypto.randomUUID();
    await db.insert(campaigns).values({ id: campaignId, organizationId: org.id, body, status: "na_fila", createdAt: new Date().toISOString() });
    await db.insert(campaignRecipients).values(targets.map((client) => ({
      id: crypto.randomUUID(),
      organizationId: org.id,
      campaignId,
      clientId: client.id,
      phone: client.whatsapp,
      body: body.replaceAll("{nome}", client.name),
      status: "na_fila",
    })));
    revalidatePath("/mensagens");
    return { ok: true as const, queued: targets.length };
  } catch (error) {
    return fail(error);
  }
}

export async function supportAction(formData: FormData) {
  try {
    const { db, org } = await allow("suporte.abrir");
    const contact = String(formData.get("contact") || "").trim();
    const message = String(formData.get("message") || "").trim();
    if (contact.length < 3 || message.length < 5) return { ok: false as const, error: "Informe contato e mensagem." };
    await db.insert(supportTickets).values({ id: crypto.randomUUID(), organizationId: org.id, contact, message, createdAt: new Date().toISOString() });
    revalidatePath("/ajuda");
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}
