"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { allowedInDemo, can, isRole, type Permission } from "../lib/access";
import { AsaasError } from "../lib/asaas";
import { linkMerchantAccount, setReceivingMode, unlinkMerchantAccount } from "../lib/asaas-merchant";
import { receiveManually, reverseWithAsaas } from "../lib/asaas-settle";
import { assertCanSell, isPlan } from "../lib/billing";
import { todayIn } from "../lib/dates";
import { documentKind, isValidCnpj } from "../lib/documents";
import { DomainError } from "../lib/errors";
import { cancelSale, changeDueDate, createCharge, createContractForSale, createSale, deleteSale, endSubscription, updateSale, type SaleInput } from "../lib/ledger";
import { lateSettingsError } from "../lib/late";
import { cents, parsePercentBp, parseReais } from "../lib/money";
import { parsePhoto, saveCatalogPhoto } from "../lib/photos";
import { isPlatformOwner } from "../lib/platform-owner";
import { generateWebhookToken, parsePlatformForm, savePlatformSettings, testPlatformConnection } from "../lib/platform-settings";
import { requireSession } from "../lib/session";
import { cancelPlan, choosePlan } from "../lib/subscription";
import { catalogSchema, chargeSchema, clientSchema, dueSchema, paymentSchema, saleSchema, toClientInput } from "../lib/schemas";
import type { z } from "zod";
import { campaignRecipients, campaigns, catalogItems, clients, fiscalDocuments, members, organizations, sales, supportTickets } from "../lib/schema";
import { removeMember, updateMember } from "../lib/team";
import { openSubaccount } from "../lib/subaccount";
import { requestWithdrawal } from "../lib/withdrawals";
import { loadPlatformSettings } from "../lib/platform-settings";
import { insertCatalog, insertClient, resetOrganization, updateCatalog, updateClient } from "../lib/tenant";
import { isBrazilZone } from "../lib/zones";

function fail(error: unknown) {
  if (error instanceof DomainError || error instanceof AsaasError) return { ok: false as const, error: error.message };
  console.error(error);
  return { ok: false as const, error: "Não foi possível concluir. Revise os dados." };
}

async function allow(permission: Permission) {
  const session = await requireSession();
  if (!can(session.role, permission)) throw new DomainError("Seu papel não pode fazer esta ação.");
  if (session.publicDemo && !allowedInDemo(permission)) throw new DomainError("Na demonstração esta ação fica desligada. Entre com a sua conta para usar.");
  return session;
}

// Só o dono da plataforma mexe nas credenciais. Quem não é dono recebe a mesma recusa de quem não tem papel.
async function owner() {
  const session = await requireSession();
  if (!isPlatformOwner(session)) throw new DomainError("Só o dono da plataforma pode fazer esta ação.");
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
    description: formData.get("description") ?? "",
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
    const input = { ...item, priceCents, stockQuantity: parseStock(item.kind, stock) };
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
    await assertCanSell(session.db, session.org);
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
    const { paymentId, warning } = await receiveManually(db, org.id, {
      chargeId: parsed.data.chargeId,
      amountCents: parseReais(parsed.data.amount),
      feeCents: parseReais(parsed.data.fee || "0"),
      paidOn: parsed.data.paidOn,
      method: parsed.data.method,
      note: "",
      idempotencyKey: parsed.data.idempotencyKey,
    });
    refreshMoney();
    return { ok: true as const, paymentId, warning };
  } catch (error) {
    return fail(error);
  }
}

export async function reverseAction(chargeId: string) {
  try {
    const { db, org } = await allow("pagamentos.estornar");
    const { warning } = await reverseWithAsaas(db, org.id, chargeId);
    refreshMoney();
    return { ok: true as const, warning };
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
    await assertCanSell(db, org);
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
    const mode = String(formData.get("mode") || "gestao");
    if (mode !== "gestao" && mode !== "integrado") return { ok: false as const, error: "Escolha como você recebe." };
    const pixKey = String(formData.get("pixKey") || "").trim().slice(0, 140);
    const paymentInstructions = String(formData.get("instructions") || "").trim().slice(0, 600);
    await setReceivingMode(db, org.id, mode);
    await db.update(organizations).set({ pixKey, paymentInstructions }).where(eq(organizations.id, org.id));
    revalidatePath("/", "layout");
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}

// A chave do lojista só passa por aqui para descobrir a carteira. Nada dela é guardado nem devolvido.
export async function connectAsaasAction(apiKey: string) {
  try {
    const { db, org } = await allow("empresa.gravar");
    const { accountName } = await linkMerchantAccount(db, org.id, apiKey);
    revalidatePath("/", "layout");
    return { ok: true as const, accountName };
  } catch (error) {
    return fail(error);
  }
}

export async function openSubaccountAction(formData: FormData) {
  try {
    const { db, org } = await allow("empresa.gravar");
    await openSubaccount(db, org.id, Object.fromEntries(formData));
    revalidatePath("/", "layout");
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function withdrawAction(amount: string, pixKey: string) {
  try {
    const { db, org } = await allow("saque.solicitar");
    let amountCents;
    try {
      amountCents = parseReais(amount);
    } catch {
      return { ok: false as const, error: "Informe o valor, por exemplo 150,00." };
    }
    await requestWithdrawal(db, org, await loadPlatformSettings(db), { amountCents, pixKey });
    revalidatePath("/saque");
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function disconnectAsaasAction() {
  try {
    const { db, org } = await allow("empresa.gravar");
    await unlinkMerchantAccount(db, org.id);
    revalidatePath("/", "layout");
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function savePlatformAction(formData: FormData) {
  try {
    const { db, viewerEmail, userName } = await owner();
    const input = parsePlatformForm({
      environment: formData.get("environment"),
      apiKey: formData.get("apiKey") ?? "",
      webhookToken: formData.get("webhookToken") ?? "",
      fee: formData.get("fee"),
      planGestao: formData.get("planGestao"),
      planIntegrado: formData.get("planIntegrado"),
    });
    await savePlatformSettings(db, input, viewerEmail || userName);
    revalidatePath("/", "layout");
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}

// O token volta em texto puro só nesta resposta, para o dono colar no Asaas. Depois disso só existe cifrado.
export async function generateWebhookTokenAction() {
  try {
    const { db, viewerEmail, userName } = await owner();
    const token = await generateWebhookToken(db, viewerEmail || userName);
    revalidatePath("/plataforma");
    return { ok: true as const, token };
  } catch (error) {
    return fail(error);
  }
}

export async function testPlatformConnectionAction() {
  try {
    const { db } = await owner();
    const result = await testPlatformConnection(db);
    revalidatePath("/plataforma");
    return { ok: true as const, accountName: result.accountName, environment: result.environment, walletTail: result.walletId.slice(-6) };
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

export async function updateMemberAction(memberId: string, input: { name: string; email: string; role: string }) {
  try {
    const { db, org } = await allow("equipe.convidar");
    await updateMember(db, org.id, memberId, input);
    revalidatePath("/equipe");
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function removeMemberAction(memberId: string) {
  try {
    const { db, org, viewerEmail } = await allow("equipe.convidar");
    await removeMember(db, org.id, memberId, viewerEmail);
    revalidatePath("/equipe");
    return { ok: true as const };
  } catch (error) {
    return fail(error);
  }
}

// Contratar leva o lojista à fatura do Asaas. Quem já tem assinatura só troca de plano, ou volta à fatura em aberto.
export async function subscribeAction(planCode: string, document: string) {
  try {
    const { db, org } = await allow("assinatura.gerir");
    if (!isPlan(planCode)) return { ok: false as const, error: "Plano inválido." };
    const choice = await choosePlan(db, org.id, planCode, { document });
    revalidatePath("/", "layout");
    return { ok: true as const, ...choice };
  } catch (error) {
    return fail(error);
  }
}

export async function cancelPlanAction() {
  try {
    const { db, org } = await allow("assinatura.gerir");
    await cancelPlan(db, org.id);
    revalidatePath("/", "layout");
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
