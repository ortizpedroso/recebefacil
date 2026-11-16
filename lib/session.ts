import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { roleLabel, isRole, type Role } from "./access";
import { getDb, type DB } from "./db";
import { authSessions, members, organizations } from "./schema";
import { tokenHash } from "./secrets";
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

async function companySession(db: DB, org: typeof organizations.$inferSelect, email: string): Promise<Session> {
  const role = await actorRole(db, org.id, email);
  return {
    db,
    org,
    userName: org.tradeName,
    publicDemo: false,
    role,
    profileName: org.tradeName,
    profileRole: roleLabel(role),
    profileEmail: email,
    showAvatar: false,
  };
}

export async function requireSession(): Promise<Session> {
  const jar = await cookies();
  const token = jar.get("recebe_session")?.value;
  const db = await getDb();
  if (token) {
    const [auth] = await db.select().from(authSessions).where(eq(authSessions.tokenHash, tokenHash(token)));
    if (auth && auth.expiresAt > new Date().toISOString()) {
      const [org] = await db.select().from(organizations).where(eq(organizations.id, auth.organizationId));
      if (org) return companySession(db, org, org.email);
    }
  }
  const org = await ensureOrganization(db, "public:demonstracao", "Visitante");
  if (!org) throw new Error("Organização indisponível.");
  const role = await actorRole(db, org.id, "camila@exemplo.com");
  return { db, org, userName: "Visitante", publicDemo: true, role, ...profileFor("Visitante", true) };
}
