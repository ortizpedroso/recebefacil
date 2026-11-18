import { and, eq } from "drizzle-orm";
import type { DB } from "./db";
import { DomainError } from "./ledger";
import { campaignRecipients, charges, clients, contacts, contracts, recurrences, sales } from "./schema";

async function findClient(db: DB, organizationId: string, clientId: string) {
  const [client] = await db.select().from(clients).where(and(eq(clients.organizationId, organizationId), eq(clients.id, clientId)));
  if (!client) throw new DomainError("Cliente não encontrado.");
  return client;
}

export async function exportClient(db: DB, organizationId: string, clientId: string) {
  const client = await findClient(db, organizationId, clientId);
  const [saleRows, chargeRows, contractRows, recurrenceRows, contactRows] = await Promise.all([
    db.select().from(sales).where(and(eq(sales.organizationId, organizationId), eq(sales.clientId, clientId))),
    db.select().from(charges).where(and(eq(charges.organizationId, organizationId), eq(charges.clientId, clientId))),
    db.select().from(contracts).where(and(eq(contracts.organizationId, organizationId), eq(contracts.clientId, clientId))),
    db.select().from(recurrences).where(and(eq(recurrences.organizationId, organizationId), eq(recurrences.clientId, clientId))),
    db.select().from(contacts).where(and(eq(contacts.organizationId, organizationId), eq(contacts.clientId, clientId))),
  ]);
  return { client, sales: saleRows, charges: chargeRows, contracts: contractRows, recurrences: recurrenceRows, contacts: contactRows };
}

export type ErasureOutcome = "apagado" | "anonimizado";

// Venda, cobrança e contrato são registro fiscal e de pagamento, que a lei manda guardar (Política de Privacidade, item 5).
// Com eles, o cliente perde os dados pessoais e o histórico fica. Sem eles, o cadastro some de vez.
export async function eraseClient(db: DB, organizationId: string, clientId: string): Promise<ErasureOutcome> {
  await findClient(db, organizationId, clientId);
  return db.transaction(async (tx) => {
    await tx.delete(contacts).where(and(eq(contacts.organizationId, organizationId), eq(contacts.clientId, clientId)));
    await tx.delete(campaignRecipients).where(and(eq(campaignRecipients.organizationId, organizationId), eq(campaignRecipients.clientId, clientId)));
    const history = await Promise.all([
      tx.select({ id: sales.id }).from(sales).where(and(eq(sales.organizationId, organizationId), eq(sales.clientId, clientId))).limit(1),
      tx.select({ id: charges.id }).from(charges).where(and(eq(charges.organizationId, organizationId), eq(charges.clientId, clientId))).limit(1),
      tx.select({ id: contracts.id }).from(contracts).where(and(eq(contracts.organizationId, organizationId), eq(contracts.clientId, clientId))).limit(1),
      tx.select({ id: recurrences.id }).from(recurrences).where(and(eq(recurrences.organizationId, organizationId), eq(recurrences.clientId, clientId))).limit(1),
    ]);
    const client = and(eq(clients.organizationId, organizationId), eq(clients.id, clientId));
    if (history.every((rows) => rows.length === 0)) {
      await tx.delete(clients).where(client);
      return "apagado";
    }
    await tx
      .update(clients)
      .set({ name: "Cliente removido", document: "", email: "", phone: "", whatsapp: "", zip: "", state: "", city: "", district: "", street: "", number: "", complement: "", notes: "", active: false })
      .where(client);
    return "anonimizado";
  });
}
