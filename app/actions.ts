"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { can, isRole, type Permission } from "../lib/access";
import { isPlan, payPlatformInvoice, subscribe } from "../lib/billing";
import { todayIn } from "../lib/dates";
import { documentKind, isValidCnpj } from "../lib/documents";
import { DomainError } from "../lib/errors";
import { cancelSale, changeDueDate, createCharge, createContractForSale, createSale, deleteSale, endSubscription, registerPayment, reverseCharge, updateSale, type SaleInput } from "../lib/ledger";
import { lateSettingsError } from "../lib/late";
import { cents, parsePercentBp, parseReais } from "../lib/money";
import { parsePhoto, saveCatalogPhoto } from "../lib/photos";
import { requireSession } from "../lib/session";
import { catalogSchema, chargeSchema, clientSchema, dueSchema, paymentSchema, saleSchema, toClientInput } from "../lib/schemas";
import type { z } from "zod";
import { campaignRecipients, campaigns, catalogItems, clients, fiscalDocuments, integrationEvents, members, organizations, sales, supportTickets } from "../lib/schema";
import { insertCatalog, insertClient, resetOrganization, updateCatalog, updateClient } from "../lib/tenant";
import { isBrazilZone } from "../lib/zones";

function fail(error: unknown) {
  if (error instanceof DomainError) return { ok: false as const, error: error.message };
  console.error(error);
  return { ok: false as const, error: "Não foi possível concluir. Revise os dados." };
}

async function allow(permission: Permission) {
  const session = await requireSession();
  if (!can(session.role, permission)) throw new DomainError("Seu papel não pode fazer esta ação.");
  return session;
}

// Dinheiro mudou de lugar: o menu, o Início e as listas leem isso.
function refreshMoney() {
  revalidatePath("/", "layout");
}

function parseStock(kind: string, stock: string) {
  if (kind !== "produto" || stock.trim() === "") return null;
  const quantity = Number(stock);
  if (!Number.isInteger(quantity) || quantity < 0) throw new DomainError("Informe o estoque em unidades inteiras.");
  return quantity;
}

function priceOf(text: string) {
  try {
    const value = parseReais(text);
    if (value > 0) return value;
  } catch {
    // cai na mensagem abaixo
  }
  throw new DomainError("Informe o preço, por exemplo 49,90.");
}

export async function createClientAction(raw: unknown) {
  const parsed = clientSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message || "Revise os dados do cliente." };
  try {
    const { db, org } = await allow("clientes.gravar");
    const clientId = await insertClient(db, org.id, toClientInput(parsed.data));
    revalidatePath("/", "layout");
    return { ok: true as const, clientId };
  } catch (error) {
    return fail(error);
  }
}

export async function updateClientAction(clientId: string, raw: unknown) {
  const parsed = clientSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message || "Revise os dados do cliente." };
  try {
    const { db, org } = await allow("clientes.gravar");
    await updateClient(db, org.id, clientId, toClientInput(parsed.data));
    revalidatePath("/", "layout");
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function saveCatalogAction(formData: FormData) {
  const parsed = catalogSchema.safeParse({
    kind: formData.get("kind"),
    name: formData.get("name"),
    price: formData.get("price"),
    category: formData.get("category") ?? "",
    sku: formData.get("sku") ?? "",
    stock: formData.get("stock") ?? "",
  });
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message || "Revise o item." };
  try {
    const { db, org } = await allow("catalogo.gravar");
    const priceCents = priceOf(parsed.data.price);
    const file = formData.get("photo");
    // A foto é conferida antes de gravar o item, para uma foto ruim não deixar um item pela metade.
    const photo = file instanceof File && file.size > 0 ? parsePhoto(new Uint8Array(await file.arrayBuffer())) : null;
    const { stock, ...item } = parsed.data;
    const input = { ...item, description: "", priceCents, stockQuantity: parseStock(item.kind, stock) };
    const existing = String(formData.get("id") || "");
    let itemId = existing;
    if (existing) await updateCatalog(db, org.id, existing, input);
    else itemId = await insertCatalog(db, org.id, input);
    if (photo) await saveCatalogPhoto(db, org.id, itemId, photo);
    revalidatePath("/produtos");
    return { ok: true as const, itemId };
  } catch (error) {
    return fail(error);
  }
}

export async function toggleCatalogAction(id: string, active: boolean) {
  try {
    const { db, org } = await allow("catalogo.gravar");
    await db.update(catalogItems).set({ active }).where(and(eq(catalogItems.organizationId, org.id), eq(catalogItems.id, id)));
    revalidatePath("/produtos");
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}

function toSaleInput(data: z.infer<typeof saleSchema>): SaleInput {
  return {
    clientId: data.clientId ?? "",
    soldOn: data.soldOn,
    discountCents: cents(data.discountCents),
    notes: data.notes,
    mode: data.mode,
    entryCents: cents(data.entryCents),
    installmentCount: data.installmentCount,
    firstDue: data.firstDue,
    periodicity: data.periodicity,
    interestMonthlyBp: data.interestMonthlyBp,
    adjustYearlyBp: data.adjustYearlyBp,
    method: data.method,
    makeContract: false,
    items: data.items.map((item) => ({ ...item, unitCents: cents(item.unitCents) })),
    paidNow: data.paidNow,
  };
}

export async function createSaleAction(raw: unknown) {
  const parsed = saleSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message || "Revise a venda." };
  try {
    const session = await allow("vendas.criar");
    const { newClient, paidNow } = parsed.data;
    if (newClient && !can(session.role, "clientes.gravar")) throw new DomainError("Seu papel não pode cadastrar clientes.");
    if (paidNow && !can(session.role, "pagamentos.registrar")) throw new DomainError("Seu papel não pode registrar recebimentos.");
    const client = newClient ? toClientInput({ ...newClient, email: "", zip: "", state: "", city: "", district: "", street: "", number: "", complement: "", notes: "" }) : undefined;
    const saleId = await createSale(session.db, session.org.id, toSaleInput(parsed.data), client);
    refreshMoney();
    return { ok: true as const, saleId, received: Boolean(paidNow) };
  } catch (error) {
    return fail(error);
  }
}

export async function updateSaleAction(saleId: string, raw: unknown) {
  const parsed = saleSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message || "Revise a venda." };
  try {
    const { db, org } = await allow("vendas.editar");
    await updateSale(db, org.id, saleId, toSaleInput(parsed.data));
    refreshMoney();
    return { ok: true as const, saleId };
  } catch (error) {
    return fail(error);
  }
}

export async function payAction(raw: unknown) {
  const parsed = paymentSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Revise o valor e a data do recebimento." };
  try {
    const { db, org } = await allow("pagamentos.registrar");
    const paymentId = await registerPayment(db, org.id, {
      chargeId: parsed.data.chargeId,
      amountCents: parseReais(parsed.data.amount),
      feeCents: parseReais(parsed.data.fee || "0"),
      paidOn: parsed.data.paidOn,
      method: parsed.data.method,
      note: "",
      idempotencyKey: parsed.data.idempotencyKey,
    });
    refreshMoney();
    return { ok: true as const, paymentId };
  } catch (error) {
    return fail(error);
  }
}

export async function reverseAction(chargeId: string) {
  try {
    const { db, org } = await allow("pagamentos.estornar");
    await reverseCharge(db, org.id, chargeId);
    refreshMoney();
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
    await changeDueDate(db, org.id, parsed.data.chargeId, parsed.data.dueOn);
    refreshMoney();
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function createChargeAction(raw: unknown) {
  const parsed = chargeSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Escolha o cliente, o valor e o vencimento." };
  try {
    const { db, org } = await allow("cobrancas.gravar");
    const chargeId = await createCharge(db, org.id, { clientId: parsed.data.clientId, amountCents: priceOf(parsed.data.amount), dueOn: parsed.data.dueOn, method: parsed.data.method });
    refreshMoney();
    return { ok: true as const, chargeId };
  } catch (error) {
    return fail(error);
  }
}

export async function cancelSaleAction(saleId: string) {
  try {
    const { db, org } = await allow("vendas.cancelar");
    await cancelSale(db, org.id, saleId);
    refreshMoney();
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteSaleAction(saleId: string) {
  try {
    const { db, org } = await allow("vendas.excluir");
    await deleteSale(db, org.id, saleId);
    refreshMoney();
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function contractForSaleAction(saleId: string) {
  try {
    const { db, org } = await allow("contratos.alterar");
    const contractId = await createContractForSale(db, org.id, saleId);
    revalidatePath(`/vendas/${saleId}`);
    return { ok: true as const, contractId };
  } catch (error) {
    return fail(error);
  }
}

export async function endSubscriptionAction(saleId: string) {
  try {
    const { db, org } = await allow("recorrencias.alterar");
    await endSubscription(db, org.id, saleId, todayIn(org.timezone));
    refreshMoney();
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
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
  const { db, org, userName, publicDemo } = await allow("demo.resetar");
  if (!publicDemo) throw new DomainError("Só a demonstração pública pode ser restaurada.");
  await resetOrganization(db, org.id, userName);
  revalidatePath("/", "layout");
}

export async function companyAction(formData: FormData) {
  try {
    const { db, org } = await allow("empresa.gravar");
    const document = String(formData.get("document") || "").trim();
    if (document && !isValidCnpj(document) && documentKind(document) !== "pf") return { ok: false as const, error: "CNPJ ou CPF inválido." };
    const timezone = String(formData.get("timezone") || org.timezone);
    if (timezone !== org.timezone && !isBrazilZone(timezone)) return { ok: false as const, error: "Escolha um fuso horário da lista." };
    let late: { lateFineBp: number; lateInterestMonthlyBp: number };
    try {
      late = {
        lateFineBp: parsePercentBp(String(formData.get("lateFine") || "0")),
        lateInterestMonthlyBp: parsePercentBp(String(formData.get("lateInterest") || "0")),
      };
    } catch {
      return { ok: false as const, error: "Informe multa e juros como percentual, por exemplo 2 ou 1,5." };
    }
    const lateError = lateSettingsError(late);
    if (lateError) return { ok: false as const, error: lateError };
    const tradeName = String(formData.get("tradeName") || "").trim();
    if (tradeName.length < 2) return { ok: false as const, error: "Informe o nome da empresa." };
    await db
      .update(organizations)
      .set({
        ...late,
        tradeName,
        legalName: String(formData.get("legalName") || "").trim(),
        document,
        email: String(formData.get("email") || "").trim(),
        phone: String(formData.get("phone") || "").trim(),
        address: String(formData.get("address") || "").trim(),
        timezone,
      })
      .where(eq(organizations.id, org.id));
    revalidatePath("/", "layout");
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function receivingAction(formData: FormData) {
  try {
    const { db, org } = await allow("empresa.gravar");
    const pixKey = String(formData.get("pixKey") || "").trim().slice(0, 140);
    const paymentInstructions = String(formData.get("instructions") || "").trim().slice(0, 600);
    await db.update(organizations).set({ pixKey, paymentInstructions }).where(eq(organizations.id, org.id));
    revalidatePath("/", "layout");
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function inviteAction(formData: FormData) {
  try {
    const { db, org } = await allow("equipe.convidar");
    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const role = String(formData.get("role") || "");
    if (name.length < 2 || !email.includes("@") || !isRole(role)) return { ok: false as const, error: "Revise o convite." };
    await db.insert(members).values({ id: crypto.randomUUID(), organizationId: org.id, name, email, role, active: true });
    revalidatePath("/equipe");
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
    revalidatePath("/equipe");
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
