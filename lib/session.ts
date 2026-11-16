import { headers } from "next/headers";
import { getIdentity } from "../cursor/identity";
import { getDb, type DB } from "./db";
import { ensureOrganization } from "./tenant";
import type { organizations } from "./schema";

export type Session = {
  db: DB;
  org: typeof organizations.$inferSelect;
  userName: string;
  publicDemo: boolean;
};

export async function requireSession(): Promise<Session> {
  const headerList = await headers();
  const identity = await getIdentity({ headers: { get: (name: string) => headerList.get(name) } });
  const db = await getDb();
  if (!identity.verified) {
    const org = await ensureOrganization(db, "public:demonstracao", "Visitante");
    if (!org) throw new Error("Organização indisponível.");
    return { db, org, userName: "Visitante", publicDemo: true };
  }
  const org = await ensureOrganization(db, `${identity.stage}:${identity.sub}`, identity.name || identity.email || "Conta");
  if (!org) throw new Error("Organização indisponível.");
  return { db, org, userName: identity.name || identity.email || "Conta", publicDemo: false };
}
