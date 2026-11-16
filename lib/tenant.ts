import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import type { DB } from "./db";
import { cents, type Cents } from "./money";
import { createSale, DomainError, registerPayment, type SaleInput } from "./ledger";
import {
  catalogItems,
  charges,
  clients,
  contacts,
  contracts,
  dueChanges,
  installments,
  integrationEvents,
  members,
  organizations,
  payments,
  recurrences,
  saleItems,
  sales,
} from "./schema";

export async function insertClient(
  db: DB,
  organizationId: string,
  input: {
    kind: "pf" | "pj";
    name: string;
    document: string;
    email: string;
    phone: string;
    whatsapp: string;
    zip: string;
    state: string;
    city: string;
    district: string;
    street: string;
    number: string;
    complement: string;
    notes: string;
  },
) {
  const id = randomUUID();
  await db.insert(clients).values({
    id,
    organizationId,
    ...input,
    active: true,
    createdAt: new Date().toISOString(),
  });
  return id;
}

export async function updateClient(
  db: DB,
  organizationId: string,
  clientId: string,
  input: {
    kind: "pf" | "pj";
    name: string;
    document: string;
    email: string;
    phone: string;
    whatsapp: string;
    zip: string;
    state: string;
    city: string;
    district: string;
    street: string;
    number: string;
    complement: string;
    notes: string;
  },
) {
  const [row] = await db.select().from(clients).where(and(eq(clients.organizationId, organizationId), eq(clients.id, clientId)));
  if (!row) throw new DomainError("Cliente não encontrado.");
  await db.update(clients).set(input).where(eq(clients.id, clientId));
}

export async function insertCatalog(
  db: DB,
  organizationId: string,
  input: {
    kind: "produto" | "servico";
    name: string;
    description: string;
    category: string;
    sku: string;
    priceCents: Cents;
    billing: "pontual" | "recorrente";
  },
) {
  const id = randomUUID();
  await db.insert(catalogItems).values({ id, organizationId, ...input, active: true });
  return id;
}

export async function updateCatalog(
  db: DB,
  organizationId: string,
  itemId: string,
  input: {
    kind: "produto" | "servico";
    name: string;
    description: string;
    category: string;
    sku: string;
    priceCents: Cents;
    billing: "pontual" | "recorrente";
  },
) {
  const [row] = await db.select().from(catalogItems).where(and(eq(catalogItems.organizationId, organizationId), eq(catalogItems.id, itemId)));
  if (!row) throw new DomainError("Item não encontrado.");
  await db.update(catalogItems).set(input).where(eq(catalogItems.id, itemId));
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
  const maria = await person("Maria Oliveira", "222.333.444-55", "Belém", "PA");
  await person("Carlos Santos", "333.222.111-00", "São Paulo", "SP");
  await person("Ana Pereira", "444.555.666-77", "Recife", "PE");
  await person("Roberto Almeida", "555.666.777-88", "Curitiba", "PR");
  await person("Fernanda Costa", "666.777.888-99", "Salvador", "BA");
  const marcos = await person("Marcos Rodrigues", "777.888.999-00", "Goiânia", "GO");
  await person("Juliana Ferreira", "888.999.000-11", "Florianópolis", "SC");

  const terreno = await insertCatalog(db, organizationId, {
    kind: "produto",
    name: "Terreno residencial",
    description: "Lote residencial fictício.",
    category: "Imóveis",
    sku: "IMV-01",
    priceCents: cents(4_500_000),
    billing: "pontual",
  });
  const ar = await insertCatalog(db, organizationId, {
    kind: "servico",
    name: "Instalação de ar-condicionado",
    description: "Instalação de um split.",
    category: "Serviços",
    sku: "",
    priceCents: cents(240_000),
    billing: "pontual",
  });
  await insertCatalog(db, organizationId, {
    kind: "produto",
    name: "Móveis planejados",
    description: "Cozinha sob medida.",
    category: "Móveis",
    sku: "MOV-01",
    priceCents: cents(1_200_000),
    billing: "pontual",
  });
  await insertCatalog(db, organizationId, {
    kind: "servico",
    name: "Consultoria empresarial",
    description: "Encontro de diagnóstico.",
    category: "Consultoria",
    sku: "",
    priceCents: cents(150_000),
    billing: "pontual",
  });
  const curso = await insertCatalog(db, organizationId, {
    kind: "servico",
    name: "Curso profissionalizante",
    description: "Mensalidade do curso.",
    category: "Educação",
    sku: "",
    priceCents: cents(200_000),
    billing: "recorrente",
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
  await db.insert(integrationEvents).values({
    id: randomUUID(),
    organizationId,
    happenedAt: new Date().toISOString(),
    kind: "AMBIENTE_INICIALIZADO",
    status: "info",
    description: "Módulo do Asaas preparado só para demonstração. Nenhuma chave foi guardada.",
  });
}

export async function ensureOrganization(db: DB, viewerKey: string, userName: string) {
  return db.transaction(async (tx) => {
    const scoped = tx as unknown as DB;
    await scoped.execute(sql`select pg_advisory_xact_lock(hashtext(${viewerKey}))`);
    const [existing] = await scoped.select().from(organizations).where(eq(organizations.viewerKey, viewerKey));
    if (existing) {
      if (existing.tradeName === "Horizonte Comércio") {
        const tradeName = "Horizonte Comércio & Serviços";
        await scoped.update(organizations).set({ tradeName }).where(eq(organizations.id, existing.id));
        return { ...existing, tradeName };
      }
      return existing;
    }
    const id = randomUUID();
    await scoped.insert(organizations).values({
      id,
      viewerKey,
      tradeName: "Horizonte Comércio & Serviços",
      legalName: "Horizonte Comércio Demonstração Ltda",
      document: "34.567.890/0001-12",
      email: "contato@exemplo.com",
      phone: "(92) 3000-0000",
      address: "Av. Eduardo Ribeiro, 100, Centro, Manaus - AM",
      timezone: "America/Manaus",
      asaasEnvironment: "demonstracao",
      asaasConnected: false,
      asaasSyncedAt: null,
      createdAt: new Date().toISOString(),
    });
    await seedOrganization(scoped, id);
    await scoped.insert(members).values({
      id: randomUUID(),
      organizationId: id,
      name: userName,
      email: "voce@exemplo.com",
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
    const rows = [payments, contacts, dueChanges, charges, installments, recurrences, saleItems, contracts, sales, catalogItems, clients, members, integrationEvents];
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
