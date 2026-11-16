import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { and, eq, isNotNull } from "drizzle-orm";
import { isValidCnpj } from "./documents";
import type { DB } from "./db";
import { DomainError } from "./ledger";
import { authSessions, members, organizations } from "./schema";
import { tokenHash } from "./secrets";

const scrypt = promisify(scryptCallback);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const derived = (await scrypt(password, salt, 32)) as Buffer;
  return `scrypt:${salt}:${derived.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [kind, salt, digest] = stored.split(":");
  if (kind !== "scrypt" || !salt || !digest) return false;
  const derived = (await scrypt(password, salt, 32)) as Buffer;
  const expected = Buffer.from(digest, "base64url");
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

export async function registerCompany(
  db: DB,
  input: { tradeName: string; legalName: string; document: string; email: string; password: string },
) {
  const email = input.email.trim().toLowerCase();
  if (input.tradeName.trim().length < 2 || input.legalName.trim().length < 2) throw new DomainError("Informe o nome da empresa.");
  if (!isValidCnpj(input.document)) throw new DomainError("CNPJ inválido.");
  if (!email.includes("@") || input.password.length < 8) throw new DomainError("Revise e-mail e senha. A senha precisa de 8 caracteres.");
  const [taken] = await db.select().from(organizations).where(and(eq(organizations.email, email), isNotNull(organizations.passwordHash)));
  if (taken) throw new DomainError("Já existe uma empresa com este e-mail.");
  const id = randomUUID();
  await db.insert(organizations).values({
    id,
    viewerKey: `conta:${email}`,
    tradeName: input.tradeName.trim(),
    legalName: input.legalName.trim(),
    document: input.document.trim(),
    email,
    phone: "",
    address: "",
    timezone: "America/Manaus",
    asaasEnvironment: "sandbox",
    asaasConnected: false,
    asaasSyncedAt: null,
    passwordHash: await hashPassword(input.password),
    createdAt: new Date().toISOString(),
  });
  await db.insert(members).values({
    id: randomUUID(),
    organizationId: id,
    name: input.tradeName.trim(),
    email,
    role: "administrador",
    active: true,
  });
  return id;
}

export async function authenticate(db: DB, email: string, password: string) {
  const normalized = email.trim().toLowerCase();
  const rows = await db.select().from(organizations).where(eq(organizations.email, normalized));
  const org = rows.find((row) => row.passwordHash);
  if (!org?.passwordHash) return null;
  if (!(await verifyPassword(password, org.passwordHash))) return null;
  return org;
}

export async function openAuthSession(db: DB, organizationId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await db.insert(authSessions).values({
    id: randomUUID(),
    organizationId,
    tokenHash: tokenHash(token),
    expiresAt,
  });
  return { token, expiresAt };
}
