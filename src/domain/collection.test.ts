import assert from "node:assert/strict"
import test from "node:test"
import { collectionText, crc16, pixPayload } from "./collection"
import {
  civilDate,
  crediarioId,
  installmentId,
  positiveCentavos,
  viewerId,
  type InstallmentView,
  type Merchant,
} from "./money"

const merchant: Merchant = {
  viewerId: viewerId("production:user:1"),
  legalName: "Açaí do João",
  pixKey: { kind: "email", address: "joao@loja.com" },
}

function view(open: number, situation: InstallmentView["situation"]): InstallmentView {
  return {
    id: installmentId("11111111-1111-4111-8111-111111111111"),
    principal: positiveCentavos(10_000),
    openCentavos: positiveCentavos(open),
    dueOn: civilDate("2026-11-20"),
    situation,
    parent: { kind: "crediario", crediarioId: crediarioId("c1"), sequence: 1 },
  }
}

test("crc16 matches the ccitt false check value", () => {
  assert.equal(crc16("123456789"), "29B1")
})

test("static pix carries the amount and a key, and the crc closes the payload", () => {
  const payload = pixPayload(merchant, positiveCentavos(3334), "abc")
  assert.match(payload, /010211/)
  assert.match(payload, /540533\.34/)
  assert.match(payload, /joao@loja.com/)
  assert.match(payload, /ACAI DO JOAO/)
  assert.equal(payload.slice(-4), crc16(payload.slice(0, -4)))
  assert.doesNotMatch(payload, /010212/)
})

test("collection text is a whatsapp link for the open balance", () => {
  const kit = collectionText({
    merchant,
    clientName: "Ada",
    phone: { digits: "11988887777" },
    installment: view(3334, "open"),
    today: civilDate("2026-11-16"),
  })
  assert.ok(!("code" in kit))
  if ("code" in kit) return
  assert.match(kit.whatsAppUrl, /^https:\/\/wa\.me\/5511988887777\?text=/)
  assert.match(kit.message, /R\$ 33,34/)
  assert.match(kit.message, /20\/11\/2026/)
})

test("a settled installment does not build a pix payload", () => {
  const closed = collectionText({
    merchant,
    clientName: "Ada",
    phone: { digits: "11988887777" },
    installment: { ...view(100, "open"), situation: "settled" },
    today: civilDate("2026-11-16"),
  })
  assert.deepEqual(closed, { code: "closed" })
})
