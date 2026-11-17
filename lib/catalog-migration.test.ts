import assert from "node:assert/strict";
import test from "node:test";
import { eq, sql } from "drizzle-orm";
import { migrate } from "./db";
import { catalogItems } from "./schema";
import { addOrganization, testDatabase } from "./test-support";

test("o catálogo antigo migra: recorrente vira Mensalidade, o resto fica pontual, e rodar de novo não muda nada", async () => {
  const db = await testDatabase();
  const org = await addOrganization(db, "org-cat");
  const row = (id: string, kind: string, billing: string) => ({ id, organizationId: org, kind, name: id, description: "", category: "", sku: "", priceCents: 1_000, billing, stockQuantity: null, active: true });
  await db.insert(catalogItems).values([row("curso", "servico", "recorrente"), row("kit", "produto", "pontual"), row("limpeza", "servico", "pontual"), row("torto", "produto", "recorrente")]);
  const exec = async (statement: string) => {
    await db.execute(sql.raw(statement));
  };
  await migrate(exec);
  await migrate(exec);
  const rows = await db.select().from(catalogItems).where(eq(catalogItems.organizationId, org));
  const byId = new Map(rows.map((item) => [item.id, item]));
  assert.deepEqual([byId.get("curso")?.kind, byId.get("curso")?.billing], ["mensalidade", "recorrente"]);
  assert.deepEqual([byId.get("kit")?.kind, byId.get("kit")?.billing], ["produto", "pontual"]);
  assert.deepEqual([byId.get("limpeza")?.kind, byId.get("limpeza")?.billing], ["servico", "pontual"]);
  assert.deepEqual([byId.get("torto")?.kind, byId.get("torto")?.billing], ["mensalidade", "recorrente"]);
});
