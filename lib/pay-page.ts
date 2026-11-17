import { and, eq } from "drizzle-orm";
import { todayIn } from "./dates";
import type { DB } from "./db";
import { chargeBadge, chargeTitle, type Badge } from "./labels";
import { lateCharges } from "./late";
import { catalogImages, charges, clients, contracts, organizations, recurrences, saleItems } from "./schema";
import { signToken, verifyToken } from "./secret";

export type PayPage = {
  company: { name: string; phone: string; email: string; pixKey: string; instructions: string };
  clientFirstName: string;
  title: string;
  dueOn: string;
  state: "open" | "paid" | "cancelled";
  badge: Badge;
  openCents: number;
  feeCents: number;
  totalCents: number;
  items: { description: string; quantity: number; unitCents: number; photoId: string | null }[];
};

export function photoPath(photoId: string): string {
  return `/api/fotos/${photoId}?s=${signToken(`foto:${photoId}`)}`;
}

export function photoSignatureValid(photoId: string, signature: string | null): boolean {
  return signature !== null && verifyToken(signature) === `foto:${photoId}`;
}

// Endereço público: só o que está na assinatura chega ao banco. Nada de sessão nem de criar empresa.
export async function loadPayPage(db: DB, token: string): Promise<PayPage | null> {
  const chargeId = verifyToken(token);
  if (!chargeId) return null;
  const [charge] = await db.select().from(charges).where(eq(charges.id, chargeId));
  if (!charge) return null;
  const [org] = await db.select().from(organizations).where(eq(organizations.id, charge.organizationId));
  const [client] = await db.select().from(clients).where(and(eq(clients.organizationId, charge.organizationId), eq(clients.id, charge.clientId)));
  if (!org || !client) return null;

  const today = todayIn(org.timezone);
  const badge = chargeBadge(charge, today);
  const state = charge.status === "cancelada" ? "cancelled" : badge.tone === "paid" ? "paid" : "open";
  const openCents = state === "open" ? charge.amountCents - charge.paidCents : 0;
  const fee = state === "open" ? lateCharges(openCents, charge.dueOn, today, org) : { fineCents: 0, interestCents: 0 };
  const feeCents = fee.fineCents + fee.interestCents;

  let items: PayPage["items"] = [];
  if (charge.saleId) {
    const rows = await db.select().from(saleItems).where(and(eq(saleItems.organizationId, org.id), eq(saleItems.saleId, charge.saleId)));
    const photos = await db.select({ id: catalogImages.id, itemId: catalogImages.catalogItemId }).from(catalogImages).where(eq(catalogImages.organizationId, org.id));
    const photoOf = new Map(photos.map((photo) => [photo.itemId, photo.id]));
    items = rows.map((row) => ({ description: row.description, quantity: row.quantity, unitCents: row.unitCents, photoId: row.catalogItemId ? photoOf.get(row.catalogItemId) ?? null : null }));
  } else {
    const [contract] = charge.contractId ? await db.select().from(contracts).where(eq(contracts.id, charge.contractId)) : [];
    const [recurrence] = charge.recurrenceId ? await db.select().from(recurrences).where(eq(recurrences.id, charge.recurrenceId)) : [];
    const text = contract?.description ?? recurrence?.description;
    if (text) items = [{ description: text, quantity: 1, unitCents: charge.amountCents, photoId: null }];
  }

  return {
    company: { name: org.tradeName, phone: org.phone, email: org.email, pixKey: org.pixKey, instructions: org.paymentInstructions },
    clientFirstName: client.name.trim().split(/\s+/)[0] ?? "",
    title: chargeTitle(charge),
    dueOn: charge.dueOn,
    state,
    badge,
    openCents,
    feeCents,
    totalCents: openCents + feeCents,
    items,
  };
}
