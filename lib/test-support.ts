import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cents } from "./money";
import { openIsolatedDatabase, type DB } from "./db";
import { insertClient } from "./clients";
import type { SaleInput } from "./plan";
import { organizations } from "./schema";

export async function testDatabase(prefix = "recebefacil-") {
  return openIsolatedDatabase(await mkdtemp(join(tmpdir(), prefix)));
}

export async function addOrganization(db: DB, id: string) {
  await db.insert(organizations).values({
    id,
    viewerKey: `test:${id}`,
    tradeName: "Empresa de Teste",
    legalName: "Empresa de Teste Ltda",
    document: "",
    email: "",
    phone: "",
    address: "",
    timezone: "America/Sao_Paulo",
    asaasEnvironment: "demonstracao",
    asaasConnected: false,
    asaasSyncedAt: null,
    createdAt: new Date().toISOString(),
  });
  return id;
}

export function addClient(db: DB, organizationId: string, name: string) {
  return insertClient(db, organizationId, {
    kind: "pf",
    name,
    document: "",
    email: "",
    phone: "(11) 98877-1020",
    whatsapp: "(11) 98877-1020",
    zip: "",
    state: "",
    city: "",
    district: "",
    street: "",
    number: "",
    complement: "",
    notes: "",
  });
}

export function saleInput(clientId: string, overrides: Partial<SaleInput> = {}): SaleInput {
  return {
    clientId,
    soldOn: "2026-10-01",
    discountCents: cents(0),
    notes: "",
    mode: "parcelado",
    entryCents: cents(0),
    installmentCount: 4,
    firstDue: "2026-10-17",
    periodicity: "mensal",
    method: "Pix",
    makeContract: false,
    items: [{ catalogItemId: null, description: "Kit skincare", kind: "produto", quantity: 1, unitCents: cents(40_000) }],
    ...overrides,
  };
}
