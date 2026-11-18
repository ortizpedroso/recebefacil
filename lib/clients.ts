import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { DB } from "./db";
import { DomainError } from "./errors";
import { clients } from "./schema";

export type ClientInput = {
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
};

export async function insertClient(db: DB, organizationId: string, input: ClientInput) {
  const id = randomUUID();
  await db.insert(clients).values({ id, organizationId, ...input, active: true, createdAt: new Date().toISOString() });
  return id;
}

export async function updateClient(db: DB, organizationId: string, clientId: string, input: ClientInput) {
  const [row] = await db.select().from(clients).where(and(eq(clients.organizationId, organizationId), eq(clients.id, clientId)));
  if (!row) throw new DomainError("Cliente não encontrado.");
  await db.update(clients).set(input).where(eq(clients.id, clientId));
}
