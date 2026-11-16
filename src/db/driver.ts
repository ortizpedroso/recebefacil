import { mkdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import pg from "pg"
import { PGlite } from "@electric-sql/pglite"

pg.types.setTypeParser(20, (value) => value)
pg.types.setTypeParser(1082, (value) => value)

export type Sql = {
  query<T = Record<string, unknown>>(text: string, params?: readonly unknown[]): Promise<T[]>
  exec(text: string): Promise<void>
  transaction<T>(run: (sql: Sql) => Promise<T>): Promise<T>
}

export type Ledger = Sql & { close(): Promise<void> }

type Queryable = {
  query(text: string, params?: unknown[]): Promise<{ rows?: Record<string, unknown>[] }>
  exec?(text: string): Promise<unknown>
}

function wrap(db: Queryable, transaction: Sql["transaction"]): Sql {
  return {
    async query<T>(text: string, params: readonly unknown[] = []) {
      const result = await db.query(text, [...params])
      return (result.rows ?? []) as T[]
    },
    async exec(text: string) {
      if (db.exec) await db.exec(text)
      else await db.query(text)
    },
    transaction,
  }
}

async function migrate(sql: Sql): Promise<void> {
  const filename = "001_book.sql"
  const text = readFileSync(join(process.cwd(), "migrations", filename), "utf8")
  await sql.exec(text)
  await sql.query(`insert into schema_migration (filename) values ($1) on conflict (filename) do nothing`, [filename])
}

async function connectPglite(dir: string): Promise<Ledger> {
  mkdirSync(dir, { recursive: true })
  const db = new PGlite(dir)
  await db.waitReady
  const sql = wrap(db, (run) => db.transaction(async (tx) => run(wrap(tx, nested))))
  await migrate(sql)
  return { ...sql, close: () => db.close() }
}

async function connectPg(databaseUrl: string): Promise<Ledger> {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 4 })
  const sql = wrap(pool, async (run) => {
    const client = await pool.connect()
    try {
      await client.query("BEGIN")
      const result = await run(wrap(client, nested))
      await client.query("COMMIT")
      return result
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    } finally {
      client.release()
    }
  })
  await migrate(sql)
  return { ...sql, close: () => pool.end() }
}

const nested: Sql["transaction"] = () => Promise.reject(new Error("nested transaction"))

let singleton: Promise<Ledger> | null = null

export function openLedger(): Promise<Ledger> {
  if (!singleton) {
    const databaseUrl = process.env.DATABASE_URL
    const opening = databaseUrl
      ? connectPg(databaseUrl)
      : connectPglite(join(process.cwd(), "data", "recebefacil"))
    singleton = opening.catch((error: unknown) => {
      singleton = null
      throw error
    })
  }
  return singleton
}

export function openIsolatedLedger(dir: string): Promise<Ledger> {
  return connectPglite(dir)
}
