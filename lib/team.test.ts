import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { eq } from "drizzle-orm";
import { members } from "./schema";
import { removeMember, updateMember } from "./team";
import { addOrganization, testDatabase } from "./test-support";

async function team() {
  const db = await testDatabase();
  const org = await addOrganization(db, randomUUID());
  const add = async (name: string, email: string, role: string) => {
    const id = randomUUID();
    await db.insert(members).values({ id, organizationId: org, name, email, role, active: true });
    return id;
  };
  const ana = await add("Ana", "ana@loja.com", "administrador");
  const bruno = await add("Bruno", "bruno@loja.com", "vendedor");
  const list = async () => db.select().from(members).where(eq(members.organizationId, org));
  return { db, org, ana, bruno, list };
}

test("editar muda nome, e-mail e papel", async () => {
  const { db, org, bruno, list } = await team();
  await updateMember(db, org, bruno, { name: "Bruno Lima", email: "BRUNO.LIMA@loja.com", role: "financeiro" });
  const row = (await list()).find((member) => member.id === bruno);
  assert.deepEqual([row?.name, row?.email, row?.role], ["Bruno Lima", "bruno.lima@loja.com", "financeiro"]);
});

test("editar recusa e-mail repetido e tirar o último administrador", async () => {
  const { db, org, ana, bruno } = await team();
  await assert.rejects(updateMember(db, org, bruno, { name: "Bruno", email: "ana@loja.com", role: "vendedor" }), /mesmo e-mail|este e-mail/);
  await assert.rejects(updateMember(db, org, ana, { name: "Ana", email: "ana@loja.com", role: "vendedor" }), /administrador/);
});

test("excluir tira a pessoa, mas não a si mesmo nem o último administrador", async () => {
  const { db, org, ana, bruno, list } = await team();
  await assert.rejects(removeMember(db, org, ana, "ana@loja.com"), /si mesmo/);
  await assert.rejects(removeMember(db, org, ana, "outra@loja.com"), /administrador/);
  await removeMember(db, org, bruno, "ana@loja.com");
  assert.deepEqual((await list()).map((member) => member.name), ["Ana"]);
});

test("excluir ou editar alguém de outra empresa não acha a pessoa", async () => {
  const { db, bruno } = await team();
  const other = await addOrganization(db, randomUUID());
  await assert.rejects(removeMember(db, other, bruno, ""), /não encontrada/);
  await assert.rejects(updateMember(db, other, bruno, { name: "X Y", email: "x@y.com", role: "vendedor" }), /não encontrada/);
});
