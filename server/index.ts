import express from "express"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { getIdentity } from "../cursor/identity.ts"
import { openDatabase, readBook, writeBook, type StoredBook } from "./bookStore.ts"
import type { RecebeFacilState } from "../src/types/recebefacil.ts"

const REQUIRED = [
  "clientes",
  "contatos",
  "catalogo",
  "vendas",
  "contratos",
  "parcelas",
  "recorrencias",
  "cobrancas",
  "asaas",
  "configuracoes",
] as const

function isBook(value: unknown): value is RecebeFacilState {
  if (!value || typeof value !== "object") return false
  const record = value as Record<string, unknown>
  return REQUIRED.every((key) => key in record)
}

async function viewerId(req: express.Request): Promise<string | null> {
  const identity = await getIdentity(req)
  if (!identity.verified) return null
  return `${identity.stage}:${identity.sub}`
}

const app = express()
app.use(express.json({ limit: "4mb" }))

const database = await openDatabase()

app.get("/api/book", async (req, res) => {
  const id = await viewerId(req)
  if (!id) {
    res.status(401).json({ error: "signed_out" })
    return
  }
  const book: StoredBook = await readBook(database, id)
  res.json(book)
})

app.put("/api/book", async (req, res) => {
  const id = await viewerId(req)
  if (!id) {
    res.status(401).json({ error: "signed_out" })
    return
  }
  const revision = Number(req.body?.revision)
  const document = req.body?.document
  if (!Number.isInteger(revision) || revision < 1 || !isBook(document)) {
    res.status(400).json({ error: "invalid_book" })
    return
  }
  const saved = await writeBook(database, id, revision, document)
  if (!saved.ok) {
    res.status(409).json({ error: "conflict" })
    return
  }
  res.json({ revision: saved.revision })
})

const dist = join(process.cwd(), "dist")
if (existsSync(join(dist, "index.html"))) {
  app.use(express.static(dist))
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(join(dist, "index.html"))
  })
}

const port = Number(process.env.PORT) || (process.env.NODE_ENV === "production" ? 3000 : 8787)
app.listen(port, "0.0.0.0", () => {
  console.log(`recebefacil book listening on ${port}`)
})
