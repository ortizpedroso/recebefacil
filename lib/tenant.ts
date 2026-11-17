import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { startTrial } from "./billing";
import { todayIn } from "./dates";
import { insertClient } from "./clients";
import type { DB } from "./db";
import { cents, type Cents } from "./money";
import { DomainError } from "./errors";
import { tracksStock, type CatalogKind } from "./labels";
import { DEFAULT_COMPANY_NAME, PUBLIC_DEMO_KEY } from "./onboarding";
import { createSale, registerPayment, type SaleInput } from "./ledger";
import {
  catalogItems,
  charges,
  clients,
  contacts,
  contracts,
  dueChanges,
  campaignRecipients,
  campaigns,
  catalogImages,
  errorEvents,
  fiscalDocuments,
  members,
  organizations,
  payments,
  platformInvoices,
  recurrences,
  saleItems,
  sales,
  stockMoves,
  subscriptions,
  supportTickets,
} from "./schema";

export { insertClient, updateClient } from "./clients";

export type CatalogInput = {
  kind: CatalogKind;
  name: string;
  description: string;
  category: string;
  sku: string;
  priceCents: Cents;
  stockQuantity?: number | null;
};

// billing é só o espelho do tipo, para quem lê o banco direto.
const billingOf = (kind: CatalogKind) => (kind === "mensalidade" ? "recorrente" : "pontual");

export async function insertCatalog(db: DB, organizationId: string, input: CatalogInput) {
  const id = randomUUID();
  const stockQuantity = tracksStock(input.kind) ? input.stockQuantity ?? null : null;
  await db.insert(catalogItems).values({ id, organizationId, ...input, billing: billingOf(input.kind), stockQuantity, active: true });
  return id;
}

export async function updateCatalog(db: DB, organizationId: string, itemId: string, input: CatalogInput) {
  const [row] = await db.select().from(catalogItems).where(and(eq(catalogItems.organizationId, organizationId), eq(catalogItems.id, itemId)));
  if (!row) throw new DomainError("Item não encontrado.");
  const stockQuantity = tracksStock(input.kind) ? input.stockQuantity ?? null : null;
  await db.update(catalogItems).set({ ...input, billing: billingOf(input.kind), stockQuantity }).where(eq(catalogItems.id, itemId));
  if (stockQuantity !== null && stockQuantity !== row.stockQuantity) {
    await db.insert(stockMoves).values({ id: randomUUID(), organizationId, catalogItemId: itemId, saleId: null, quantity: stockQuantity - (row.stockQuantity ?? 0), reason: "ajuste", createdAt: new Date().toISOString() });
  }
}

async function sale(db: DB, organizationId: string, input: SaleInput) {
  return createSale(db, organizationId, input);
}

export async function seedOrganization(db: DB, organizationId: string) {
  const person = (name: string, document: string, city: string, state: string) =>
    insertClient(db, organizationId, {
      kind: "pf",
      name,
      document,
      email: `${name.split(" ")[0].toLowerCase()}@exemplo.com`,
      phone: "(92) 98888-0000",
      whatsapp: "(92) 98888-0000",
      zip: "69000-000",
      state,
      city,
      district: "Centro",
      street: "Rua das Flores",
      number: "100",
      complement: "",
      notes: "Cadastro fictício para demonstração.",
    });

  const joao = await person("João Silva", "111.444.777-35", "Manaus", "AM");
  const maria = await person("Maria Oliveira", "390.533.447-05", "Belém", "PA");
  await person("Carlos Santos", "529.982.247-25", "São Paulo", "SP");
  await person("Ana Pereira", "153.509.460-56", "Recife", "PE");
  await person("Roberto Almeida", "286.255.878-87", "Curitiba", "PR");
  await person("Fernanda Costa", "455.187.238-57", "Salvador", "BA");
  const marcos = await person("Marcos Rodrigues", "746.395.180-48", "Goiânia", "GO");
  await person("Juliana Ferreira", "847.316.280-32", "Florianópolis", "SC");

  const terreno = await insertCatalog(db, organizationId, {
    kind: "produto",
    name: "Terreno residencial",
    description: "Lote residencial fictício.",
    category: "Imóveis",
    sku: "IMV-01",
    priceCents: cents(4_500_000),
    stockQuantity: 5,
  });
  const ar = await insertCatalog(db, organizationId, {
    kind: "servico",
    name: "Instalação de ar-condicionado",
    description: "Instalação de um split.",
    category: "Serviços",
    sku: "",
    priceCents: cents(240_000),
  });
  await insertCatalog(db, organizationId, {
    kind: "produto",
    name: "Móveis planejados",
    description: "Cozinha sob medida.",
    category: "Móveis",
    sku: "MOV-01",
    priceCents: cents(1_200_000),
    stockQuantity: 3,
  });
  await insertCatalog(db, organizationId, {
    kind: "servico",
    name: "Consultoria empresarial",
    description: "Encontro de diagnóstico.",
    category: "Consultoria",
    sku: "",
    priceCents: cents(150_000),
  });
  const curso = await insertCatalog(db, organizationId, {
    kind: "mensalidade",
    name: "Curso profissionalizante",
    description: "Mensalidade do curso.",
    category: "Educação",
    sku: "",
    priceCents: cents(200_000),
  });

  const base = {
    discountCents: cents(0),
    notes: "Venda fictícia.",
    periodicity: "mensal" as const,
    method: "Pix",
    makeContract: true,
  };

  const terrenoSale = await sale(db, organizationId, {
    ...base,
    clientId: marcos,
    soldOn: "2026-01-10",
    mode: "parcelado",
    entryCents: cents(900_000),
    installmentCount: 12,
    firstDue: "2026-02-10",
    items: [{ catalogItemId: terreno, description: "Terreno residencial", kind: "produto", quantity: 1, unitCents: cents(4_500_000) }],
  });
  const arSale = await sale(db, organizationId, {
    ...base,
    clientId: joao,
    soldOn: "2026-08-05",
    mode: "parcelado",
    entryCents: cents(80_000),
    installmentCount: 4,
    firstDue: "2026-09-05",
    method: "Boleto",
    items: [{ catalogItemId: ar, description: "Instalação de ar-condicionado", kind: "servico", quantity: 1, unitCents: cents(240_000) }],
  });
  await sale(db, organizationId, {
    ...base,
    clientId: maria,
    soldOn: "2026-11-02",
    mode: "avista",
    entryCents: cents(0),
    installmentCount: 1,
    firstDue: "2026-11-02",
    makeContract: false,
    items: [{ catalogItemId: null, description: "Consultoria empresarial", kind: "servico", quantity: 1, unitCents: cents(150_000) }],
  });
  await sale(db, organizationId, {
    ...base,
    clientId: joao,
    soldOn: "2026-06-01",
    mode: "parcelado",
    entryCents: cents(200_000),
    installmentCount: 4,
    firstDue: "2026-07-01",
    items: [{ catalogItemId: null, description: "Projeto de móveis", kind: "produto", quantity: 1, unitCents: cents(1_000_000) }],
  });
  await sale(db, organizationId, {
    ...base,
    clientId: maria,
    soldOn: "2026-10-01",
    mode: "recorrente",
    entryCents: cents(0),
    installmentCount: 1,
    firstDue: "2026-10-01",
    items: [{ catalogItemId: curso, description: "Curso profissionalizante", kind: "servico", quantity: 1, unitCents: cents(200_000) }],
  });

  const { charges } = await import("./schema");
  const entryCharges = await db.select().from(charges).where(and(eq(charges.organizationId, organizationId), eq(charges.saleId, terrenoSale)));
  const entry = entryCharges.find((charge) => charge.amountCents === 900_000);
  if (entry) {
    await registerPayment(db, organizationId, {
      chargeId: entry.id,
      amountCents: cents(900_000),
      paidOn: "2026-01-10",
      method: "Pix",
      note: "Entrada fictícia.",
      idempotencyKey: `seed-terreno-${organizationId}`,
    });
  }
  const arCharges = await db.select().from(charges).where(and(eq(charges.organizationId, organizationId), eq(charges.saleId, arSale)));
  const arEntry = arCharges.find((charge) => charge.amountCents === 80_000);
  if (arEntry) {
    await registerPayment(db, organizationId, {
      chargeId: arEntry.id,
      amountCents: cents(80_000),
      paidOn: "2026-08-05",
      method: "Pix",
      note: "Entrada fictícia.",
      idempotencyKey: `seed-ar-${organizationId}`,
    });
  }

  await db.insert(members).values([
    { id: randomUUID(), organizationId, name: "Camila Mendes", email: "camila@exemplo.com", role: "administrador", active: true },
    { id: randomUUID(), organizationId, name: "Rafael Nogueira", email: "rafael@exemplo.com", role: "financeiro", active: true },
    { id: randomUUID(), organizationId, name: "Beatriz Lima", email: "beatriz@exemplo.com", role: "vendedor", active: true },
  ]);
}

const DEMO_COMPANY = {
  tradeName: "Horizonte Comércio & Serviços",
  legalName: "Horizonte Comércio Demonstração Ltda",
  document: "34.567.890/0001-30",
  email: "contato@exemplo.com",
  phone: "(92) 3000-0000",
  address: "Av. Eduardo Ribeiro, 100, Centro, Manaus - AM",
  timezone: "America/Manaus",
  pixKey: "contato@exemplo.com",
  paymentInstructions: "Depois de pagar, envie o comprovante pelo WhatsApp (92) 3000-0000.",
};

const NEW_COMPANY = { tradeName: DEFAULT_COMPANY_NAME, legalName: "", document: "", email: "", phone: "", address: "", timezone: "America/Sao_Paulo" };

export async function ensureOrganization(db: DB, viewerKey: string, userName: string, userEmail = "voce@exemplo.com") {
  return db.transaction(async (tx) => {
    const scoped = tx as unknown as DB;
    await scoped.execute(sql`select pg_advisory_xact_lock(hashtext(${viewerKey}))`);
    const [existing] = await scoped.select().from(organizations).where(eq(organizations.viewerKey, viewerKey));
    if (existing) {
      if (existing.document === "34.567.890/0001-12") {
        const document = "34.567.890/0001-30";
        await scoped.update(organizations).set({ document }).where(eq(organizations.id, existing.id));
        existing.document = document;
      }
      if (existing.tradeName === "Horizonte Comércio") {
        const tradeName = "Horizonte Comércio & Serviços";
        await scoped.update(organizations).set({ tradeName }).where(eq(organizations.id, existing.id));
        return { ...existing, tradeName };
      }
      return existing;
    }
    const id = randomUUID();
    const demo = viewerKey === PUBLIC_DEMO_KEY;
    await scoped.insert(organizations).values({
      id,
      viewerKey,
      ...(demo ? DEMO_COMPANY : NEW_COMPANY),
      createdAt: new Date().toISOString(),
    });
    // Só a demonstração pública nasce com dados de exemplo e sem plano. Empresa nova começa vazia, com 14 dias de teste.
    if (demo) await seedOrganization(scoped, id);
    else await startTrial(scoped, id, todayIn(NEW_COMPANY.timezone));
    await scoped.insert(members).values({
      id: randomUUID(),
      organizationId: id,
      name: userName,
      email: userEmail,
      role: "administrador",
      active: true,
    });
    const [created] = await scoped.select().from(organizations).where(eq(organizations.id, id));
    if (!created) throw new Error("Organização indisponível.");
    return created;
  });
}

export async function resetOrganization(db: DB, organizationId: string, userName: string) {
  await db.transaction(async (tx) => {
    const scoped = tx as unknown as DB;
    const rows = [campaignRecipients, campaigns, stockMoves, fiscalDocuments, platformInvoices, subscriptions, supportTickets, errorEvents, payments, contacts, dueChanges, charges, recurrences, saleItems, contracts, sales, catalogImages, catalogItems, clients, members];
    for (const table of rows) {
      await scoped.delete(table).where(eq(table.organizationId, organizationId));
    }
    await seedOrganization(scoped, organizationId);
    await scoped.insert(members).values({
      id: randomUUID(),
      organizationId,
      name: userName,
      email: "voce@exemplo.com",
      role: "administrador",
      active: true,
    });
  });
}
