import { and, eq, inArray } from "drizzle-orm";
import type { DB } from "./db";
import { DomainError } from "./ledger";
import {
  campaignRecipients,
  charges,
  clients,
  contacts,
  contracts,
  dueChanges,
  fiscalDocuments,
  installments,
  payments,
  recurrences,
  saleItems,
  sales,
  stockMoves,
} from "./schema";

export async function exportClient(db: DB, organizationId: string, clientId: string) {
  const [client] = await db.select().from(clients).where(and(eq(clients.organizationId, organizationId), eq(clients.id, clientId)));
  if (!client) throw new DomainError("Cliente não encontrado.");
  const [saleRows, chargeRows, installmentRows, contractRows, contactRows, recurrenceRows] = await Promise.all([
    db.select().from(sales).where(and(eq(sales.organizationId, organizationId), eq(sales.clientId, clientId))),
    db.select().from(charges).where(and(eq(charges.organizationId, organizationId), eq(charges.clientId, clientId))),
    db.select().from(installments).where(and(eq(installments.organizationId, organizationId), eq(installments.clientId, clientId))),
    db.select().from(contracts).where(and(eq(contracts.organizationId, organizationId), eq(contracts.clientId, clientId))),
    db.select().from(contacts).where(and(eq(contacts.organizationId, organizationId), eq(contacts.clientId, clientId))),
    db.select().from(recurrences).where(and(eq(recurrences.organizationId, organizationId), eq(recurrences.clientId, clientId))),
  ]);
  return { client, sales: saleRows, charges: chargeRows, installments: installmentRows, contracts: contractRows, contacts: contactRows, recurrences: recurrenceRows };
}

export async function eraseClient(db: DB, organizationId: string, clientId: string) {
  const [client] = await db.select().from(clients).where(and(eq(clients.organizationId, organizationId), eq(clients.id, clientId)));
  if (!client) throw new DomainError("Cliente não encontrado.");
  const saleRows = await db.select().from(sales).where(and(eq(sales.organizationId, organizationId), eq(sales.clientId, clientId)));
  const chargeRows = await db.select().from(charges).where(and(eq(charges.organizationId, organizationId), eq(charges.clientId, clientId)));
  const installmentRows = await db.select().from(installments).where(and(eq(installments.organizationId, organizationId), eq(installments.clientId, clientId)));
  const saleIds = saleRows.map((row) => row.id);
  const chargeIds = chargeRows.map((row) => row.id);
  const installmentIds = installmentRows.map((row) => row.id);
  await db.delete(campaignRecipients).where(and(eq(campaignRecipients.organizationId, organizationId), eq(campaignRecipients.clientId, clientId)));
  await db.delete(contacts).where(and(eq(contacts.organizationId, organizationId), eq(contacts.clientId, clientId)));
  if (chargeIds.length) await db.delete(payments).where(and(eq(payments.organizationId, organizationId), inArray(payments.chargeId, chargeIds)));
  if (installmentIds.length) await db.delete(dueChanges).where(and(eq(dueChanges.organizationId, organizationId), inArray(dueChanges.installmentId, installmentIds)));
  await db.delete(charges).where(and(eq(charges.organizationId, organizationId), eq(charges.clientId, clientId)));
  await db.delete(installments).where(and(eq(installments.organizationId, organizationId), eq(installments.clientId, clientId)));
  await db.delete(recurrences).where(and(eq(recurrences.organizationId, organizationId), eq(recurrences.clientId, clientId)));
  if (saleIds.length) {
    await db.delete(fiscalDocuments).where(and(eq(fiscalDocuments.organizationId, organizationId), inArray(fiscalDocuments.saleId, saleIds)));
    await db.delete(stockMoves).where(and(eq(stockMoves.organizationId, organizationId), inArray(stockMoves.saleId, saleIds)));
    await db.delete(saleItems).where(and(eq(saleItems.organizationId, organizationId), inArray(saleItems.saleId, saleIds)));
  }
  await db.delete(contracts).where(and(eq(contracts.organizationId, organizationId), eq(contracts.clientId, clientId)));
  await db.delete(sales).where(and(eq(sales.organizationId, organizationId), eq(sales.clientId, clientId)));
  await db.delete(clients).where(eq(clients.id, clientId));
}
