import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { getIdentity } from "../cursor/identity";
import { isRole, type Role } from "./access";
import { getDb, type DB } from "./db";
import { members, type organizations } from "./schema";
import { ensureOrganization } from "./tenant";

export type Session = {
  db: DB;
  org: typeof organizations.$inferSelect;
  userName: string;
  publicDemo: boolean;
  profileName: string;
  profileRole: string;
  profileEmail: string;
  showAvatar: boolean;
  role: Role;
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

async function actorRole(db: DB, organizationId: string, email: string): Promise<Role> {
  const rows = await db.select().from(members).where(eq(members.organizationId, organizationId));
  const match = rows.find((row) => row.active && row.email.toLowerCase() === email.toLowerCase());
  if (match && isRole(match.role)) return match.role;
  return "administrador";
}

export async function requireSession(): Promise<Session> {
  const headerList = await headers();
  const identity = await getIdentity({ headers: { get: (name: string) => headerList.get(name) } });
  const db = await getDb();
  if (!identity.verified) {
    const org = await ensureOrganization(db, "public:demonstracao", "Visitante");
    if (!org) throw new Error("Organização indisponível.");
    const role = await actorRole(db, org.id, "camila@exemplo.com");
    return { db, org, userName: "Visitante", publicDemo: true, role, ...profileFor("Visitante", true) };
  }
  const org = await ensureOrganization(db, `${identity.stage}:${identity.sub}`, identity.name || identity.email || "Conta", identity.email || undefined);
  if (!org) throw new Error("Organização indisponível.");
  const userName = identity.name || identity.email || "Conta";
  const actorEmail = identity.simulated ? "camila@exemplo.com" : identity.email || "";
  const role = await actorRole(db, org.id, actorEmail);
  return { db, org, userName, publicDemo: false, role, ...profileFor(userName, identity.simulated) };
}
