import { and, eq } from "drizzle-orm";
import { isRole, type Role } from "./access";
import type { DB } from "./db";
import { DomainError } from "./errors";
import { members } from "./schema";

export type MemberInput = { name: string; email: string; role: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseMember(input: MemberInput): { name: string; email: string; role: Role } {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (name.length < 2) throw new DomainError("Informe o nome.");
  if (!EMAIL.test(email)) throw new DomainError("Informe um e-mail válido.");
  if (!isRole(input.role)) throw new DomainError("Escolha o que a pessoa pode fazer.");
  return { name: name.slice(0, 120), email: email.slice(0, 200), role: input.role };
}

async function teamOf(db: DB, organizationId: string) {
  return db.select().from(members).where(eq(members.organizationId, organizationId));
}

// A empresa nunca fica sem alguém que possa administrar a equipe e a assinatura.
function keepsAnAdmin(team: { id: string; role: string; active: boolean }[], changedId: string, nextRole: Role | null): boolean {
  return team.some((member) => member.active && (member.id === changedId ? nextRole === "administrador" : member.role === "administrador"));
}

export async function updateMember(db: DB, organizationId: string, memberId: string, input: MemberInput): Promise<void> {
  const next = parseMember(input);
  const team = await teamOf(db, organizationId);
  if (!team.some((member) => member.id === memberId)) throw new DomainError("Pessoa não encontrada.");
  if (team.some((member) => member.id !== memberId && member.email.toLowerCase() === next.email)) throw new DomainError("Já existe alguém na equipe com este e-mail.");
  if (!keepsAnAdmin(team, memberId, next.role)) throw new DomainError("A empresa precisa de um administrador.");
  await db.update(members).set(next).where(and(eq(members.organizationId, organizationId), eq(members.id, memberId)));
}

export async function removeMember(db: DB, organizationId: string, memberId: string, actorEmail: string): Promise<void> {
  const team = await teamOf(db, organizationId);
  const target = team.find((member) => member.id === memberId);
  if (!target) throw new DomainError("Pessoa não encontrada.");
  if (actorEmail && target.email.toLowerCase() === actorEmail.toLowerCase()) throw new DomainError("Você não pode excluir a si mesmo. Peça a outro administrador.");
  if (!keepsAnAdmin(team, memberId, null)) throw new DomainError("A empresa precisa de um administrador.");
  await db.delete(members).where(and(eq(members.organizationId, organizationId), eq(members.id, memberId)));
}
