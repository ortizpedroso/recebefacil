import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";
import { MIGRATION_STATEMENTS, SCHEMA_SQL } from "./sql";

export type DB = NodePgDatabase<typeof schema>;

const globalDb = globalThis as unknown as { recebefacilDb?: Promise<DB> };

export function dataDir() {
  return process.env.RECEBEFACIL_DATA || "/tmp/recebefacil-data";
}

export async function migrate(exec: (statement: string) => Promise<void>) {
  const statements = [
    ...SCHEMA_SQL.split(";")
      .map((statement) => statement.trim())
      .filter(Boolean),
    ...MIGRATION_STATEMENTS,
  ];
  for (const statement of statements) {
    await exec(statement);
  }
}

export async function openIsolatedDatabase(dir: string): Promise<DB> {
  mkdirSync(dir, { recursive: true });
  const client = new PGlite(dir);
  await client.waitReady;
  const db = drizzlePglite(client, { schema }) as unknown as DB;
  await migrate((statement) => client.exec(statement).then(() => undefined));
  return db;
}

async function openDatabase(): Promise<DB> {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    const pool = new pg.Pool({ connectionString: databaseUrl, max: 4 });
    const db = drizzlePg(pool, { schema });
    await migrate(async (statement) => {
      await pool.query(statement);
    });
    return db;
  }
  return openIsolatedDatabase(dataDir());
}

export function getDb(): Promise<DB> {
  if (!globalDb.recebefacilDb) globalDb.recebefacilDb = openDatabase();
  return globalDb.recebefacilDb;
}
