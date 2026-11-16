import { mkdirSync } from "node:fs"
import { join } from "node:path"
import pg from "pg"
import { PGlite } from "@electric-sql/pglite"
import { INITIAL_RECEBEFACIL_STATE } from "../src/data/mockData.ts"
import type { RecebeFacilState } from "../src/types/recebefacil.ts"

const SCHEMA = `
create table if not exists book (
  id text primary key,
  revision integer not null,
  document jsonb not null,
  updated_at timestamptz not null default now()
);
`

export type StoredBook = {
  revision: number
  document: RecebeFacilState
}

type Sql = {
  query<T = Record<string, unknown>>(text: string, params?: readonly unknown[]): Promise<T[]>
  close(): Promise<void>
}

function asDocument(value: unknown): RecebeFacilState {
  if (typeof value === "string") return JSON.parse(value) as RecebeFacilState
  return value as RecebeFacilState
}

async function migrate(sql: Sql): Promise<void> {
  await sql.query(SCHEMA)
}

function wrapPg(pool: pg.Pool): Sql {
  return {
    async query<T>(text: string, params: readonly unknown[] = []) {
      const result = await pool.query(text, [...params])
      return result.rows as T[]
    },
    close: () => pool.end(),
  }
}

function wrapPglite(db: PGlite): Sql {
  return {
    async query<T>(text: string, params: readonly unknown[] = []) {
      const result = await db.query(text, [...params])
      return (result.rows ?? []) as T[]
    },
    close: () => db.close(),
  }
}

export async function openDatabase(databaseUrl = process.env.DATABASE_URL): Promise<Sql> {
  if (databaseUrl) {
    const pool = new pg.Pool({ connectionString: databaseUrl, max: 4 })
    const sql = wrapPg(pool)
    await migrate(sql)
    return sql
  }
  const dir = join(process.cwd(), "data", "recebefacil")
  mkdirSync(dir, { recursive: true })
  const db = new PGlite(dir)
  await db.waitReady
  const sql = wrapPglite(db)
  await migrate(sql)
  return sql
}

export async function openIsolatedDatabase(dir: string): Promise<Sql> {
  mkdirSync(dir, { recursive: true })
  const db = new PGlite(dir)
  await db.waitReady
  const sql = wrapPglite(db)
  await migrate(sql)
  return sql
}

export async function readBook(sql: Sql, id: string): Promise<StoredBook> {
  await sql.query(
    `insert into book (id, revision, document) values ($1, 1, $2::jsonb) on conflict (id) do nothing`,
    [id, JSON.stringify(INITIAL_RECEBEFACIL_STATE)],
  )
  const rows = await sql.query<{ revision: number; document: unknown }>(
    `select revision, document from book where id = $1`,
    [id],
  )
  const row = rows[0]
  return { revision: Number(row.revision), document: asDocument(row.document) }
}

export async function writeBook(
  sql: Sql,
  id: string,
  revision: number,
  document: RecebeFacilState,
): Promise<{ ok: true; revision: number } | { ok: false }> {
  const rows = await sql.query<{ revision: number }>(
    `update book set document = $3::jsonb, revision = revision + 1, updated_at = now() where id = $1 and revision = $2 returning revision`,
    [id, revision, JSON.stringify(document)],
  )
  if (!rows[0]) return { ok: false }
  return { ok: true, revision: Number(rows[0].revision) }
}
