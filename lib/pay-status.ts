import { eq } from "drizzle-orm";
import { refreshCharge } from "./asaas-settle";
import type { DB } from "./db";
import { logWarning } from "./log";
import { platformClient } from "./platform-settings";
import { charges } from "./schema";
import { isOpen } from "./status";

export type PayState = "open" | "paid" | "cancelled";

const RECHECK_AFTER_MS = 15_000;

// A tela do pagador pergunta a cada poucos segundos. Quando há cobrança viva, o Asaas é conferido no máximo a cada 15 segundos,
// então o pagamento aparece mesmo se o webhook atrasar ou não alcançar este endereço.
export async function payState(db: DB, chargeId: string, now: Date = new Date(), fetchImpl?: typeof fetch): Promise<PayState | null> {
  let [charge] = await db.select().from(charges).where(eq(charges.id, chargeId));
  if (!charge) return null;
  if (charge.status === "cancelada") return "cancelled";
  const checkedAt = charge.asaasSyncedAt ? Date.parse(charge.asaasSyncedAt) : 0;
  if (isOpen(charge) && charge.asaasPaymentId && now.getTime() - checkedAt >= RECHECK_AFTER_MS) {
    try {
      const { client } = await platformClient(db, fetchImpl);
      await refreshCharge(db, charge, client, now);
      [charge] = await db.select().from(charges).where(eq(charges.id, chargeId));
    } catch (error) {
      logWarning("asaas.status", error);
    }
  }
  if (!charge) return null;
  if (charge.status === "cancelada") return "cancelled";
  return isOpen(charge) ? "open" : "paid";
}
