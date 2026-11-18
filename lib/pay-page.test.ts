process.env.RECEBEFACIL_SECRET = "p".repeat(40);

import assert from "node:assert/strict";
import test from "node:test";
import { and, eq } from "drizzle-orm";
import { createSale, registerPayment } from "./ledger";
import { cents } from "./money";
import { loadPayPage, photoPath, photoSignatureValid } from "./pay-page";
import { loadCatalogPhotoAnyOrg, parsePhoto, saveCatalogPhoto } from "./photos";
import { charges, organizations } from "./schema";
import { signToken } from "./secret";
import { addClient, addOrganization, saleInput, testDatabase } from "./test-support";
import { insertCatalog } from "./tenant";

async function setup(overrides: Parameters<typeof saleInput>[1] = {}) {
  const db = await testDatabase();
  const org = await addOrganization(db, "org-pay");
  await db.update(organizations).set({ pixKey: "pix@loja.com.br", paymentInstructions: "Mande o comprovante.", tradeName: "Estúdio Bella", phone: "(11) 3000-0000" }).where(eq(organizations.id, org));
  const client = await addClient(db, org, "Camila Rocha");
  const item = await insertCatalog(db, org, { kind: "produto", name: "Sérum", description: "", category: "", sku: "", priceCents: cents(40_000), stockQuantity: 5 });
  await saveCatalogPhoto(db, org, item, parsePhoto(Uint8Array.from([0xff, 0xd8, 0xff, 1, 2, 3])));
  const saleId = await createSale(db, org, saleInput(client, { soldOn: "2020-01-01", firstDue: "2020-02-01", installmentCount: 2, items: [{ catalogItemId: item, description: "Sérum", kind: "produto", quantity: 1, unitCents: cents(40_000) }], ...overrides }));
  const rows = await db.select().from(charges).where(and(eq(charges.organizationId, org), eq(charges.saleId, saleId)));
  rows.sort((a, b) => a.dueOn.localeCompare(b.dueOn));
  return { db, org, rows };
}

test("o link público mostra empresa, o que foi comprado com foto, a parcela e a chave Pix", async () => {
  const { db, rows } = await setup({ firstDue: "2099-02-01", soldOn: "2099-01-01" });
  const page = await loadPayPage(db, signToken(rows[0].id));
  assert.ok(page);
  assert.equal(page.company.name, "Estúdio Bella");
  assert.equal(page.company.pixKey, "pix@loja.com.br");
  assert.equal(page.company.instructions, "Mande o comprovante.");
  assert.equal(page.clientFirstName, "Camila");
  assert.equal(page.title, "Parcela 1 de 2");
  assert.equal(page.state, "open");
  assert.equal(page.feeCents, 0);
  assert.equal(page.totalCents, 20_000);
  assert.equal(page.items.length, 1);
  assert.ok(page.items[0].photoId);
});

test("cobrança atrasada soma multa de 2% e juros de 1% ao mês por dia ao valor do link", async () => {
  const { db, rows } = await setup();
  const page = await loadPayPage(db, signToken(rows[0].id));
  assert.ok(page);
  assert.equal(page.state, "open");
  assert.equal(page.badge.tone, "late");
  assert.equal(page.openCents, 20_000);
  assert.ok(page.feeCents > 400, "multa de 2% (R$ 4,00) mais juros dos dias de atraso");
  assert.equal(page.totalCents, page.openCents + page.feeCents);
});

test("pagamento recebido e cobrança cancelada mostram o estado e nenhum valor a pagar", async () => {
  const { db, org, rows } = await setup();
  await registerPayment(db, org, { chargeId: rows[0].id, amountCents: cents(20_000), paidOn: "2020-02-01", method: "Pix", note: "" });
  const paid = await loadPayPage(db, signToken(rows[0].id));
  assert.equal(paid?.state, "paid");
  assert.equal(paid?.totalCents, 0);
  await db.update(charges).set({ status: "cancelada" }).where(eq(charges.id, rows[1].id));
  assert.equal((await loadPayPage(db, signToken(rows[1].id)))?.state, "cancelled");
});

test("token adulterado, de outra assinatura ou de cobrança que não existe cai em nada", async () => {
  const { db, rows } = await setup();
  const token = signToken(rows[0].id);
  const [payload, signature] = token.split(".");
  assert.equal(await loadPayPage(db, `${Buffer.from(rows[1].id).toString("base64url")}.${signature}`), null);
  assert.equal(await loadPayPage(db, `${payload}.${signature.slice(1)}`), null);
  assert.equal(await loadPayPage(db, "lixo"), null);
  assert.equal(await loadPayPage(db, signToken("nao-existe")), null);
});

test("a foto da página pública só abre com a assinatura certa para aquele id", async () => {
  const { db, rows } = await setup();
  const page = await loadPayPage(db, signToken(rows[0].id));
  const photoId = page?.items[0].photoId;
  assert.ok(photoId);
  const path = photoPath(photoId);
  const signature = new URL(`http://x${path}`).searchParams.get("s");
  assert.equal(photoSignatureValid(photoId, signature), true);
  assert.equal(photoSignatureValid("outro-id", signature), false);
  assert.equal(photoSignatureValid(photoId, null), false);
  assert.equal(photoSignatureValid(photoId, signToken("foto:outro")), false);
  assert.equal(photoSignatureValid(photoId, signToken(photoId)), false);
  assert.ok(await loadCatalogPhotoAnyOrg(db, photoId));
});
