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
  profileName: string;
  profileRole: string;
  profileEmail: string;
  showAvatar: boolean;
};

function profileFor(name: string, demo: boolean) {
  if (!demo) {
    return { profileName: name, profileRole: "Conta", profileEmail: "", showAvatar: false };
  }
  return {
    profileName: "Camila Mendes",
    profileRole: "Gestora Comercial e Financeira",
    profileEmail: "camila@exemplo.com",
    showAvatar: true,
  };
}

export async function requireSession(): Promise<Session> {
  const headerList = await headers();
  const identity = await getIdentity({ headers: { get: (name: string) => headerList.get(name) } });
  const db = await getDb();
  if (!identity.verified) {
    const org = await ensureOrganization(db, "public:demonstracao", "Visitante");
    if (!org) throw new Error("Organização indisponível.");
    return { db, org, userName: "Visitante", publicDemo: true, ...profileFor("Visitante", true) };
  }
  const org = await ensureOrganization(db, `${identity.stage}:${identity.sub}`, identity.name || identity.email || "Conta");
  if (!org) throw new Error("Organização indisponível.");
  const userName = identity.name || identity.email || "Conta";
  return { db, org, userName, publicDemo: false, ...profileFor(userName, identity.simulated) };
}
