import { organizations } from "./schema";
import type { DB } from "./db";

export async function dumpCompanies(db: DB) {
  const rows = await db.select().from(organizations);
  return JSON.stringify(rows);
}

export async function restoreCompanies(db: DB, dump: string) {
  const rows = JSON.parse(dump) as (typeof organizations.$inferSelect)[];
  for (const row of rows) {
    await db.insert(organizations).values(row).onConflictDoNothing();
  }
  return rows.length;
}
