import assert from "node:assert/strict"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { INITIAL_RECEBEFACIL_STATE } from "../src/data/mockData.ts"
import { openIsolatedDatabase, readBook, writeBook } from "./bookStore.ts"

test("the book survives a restart and rejects a stale revision", async () => {
  const parent = await mkdtemp(join(tmpdir(), "recebefacil-book-"))
  const dir = join(parent, "missing", "ledger")
  const first = await openIsolatedDatabase(dir)
  const opened = await readBook(first, "production:user:dev")
  assert.equal(opened.revision, 1)
  assert.equal(opened.document.clientes[0].nome, INITIAL_RECEBEFACIL_STATE.clientes[0].nome)

  const next = structuredClone(opened.document)
  next.clientes[0].nome = "Helena Prado"
  const saved = await writeBook(first, "production:user:dev", 1, next)
  assert.deepEqual(saved, { ok: true, revision: 2 })
  const stale = await writeBook(first, "production:user:dev", 1, opened.document)
  assert.deepEqual(stale, { ok: false })
  await first.close()

  const second = await openIsolatedDatabase(dir)
  const again = await readBook(second, "production:user:dev")
  assert.equal(again.revision, 2)
  assert.equal(again.document.clientes[0].nome, "Helena Prado")
  const other = await readBook(second, "preview:user:other")
  assert.equal(other.revision, 1)
  assert.notEqual(other.document.clientes[0].nome, "Helena Prado")
  await second.close()
  await rm(parent, { recursive: true, force: true })
})
