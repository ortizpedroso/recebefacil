import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { masterSecret, signToken, verifyToken } from "./secret";

const secret = "s".repeat(40);

test("o token assinado volta ao mesmo valor", () => {
  const token = signToken("charge-123", secret);
  assert.equal(verifyToken(token, secret), "charge-123");
});

test("trocar o conteúdo, a assinatura ou o segredo invalida o token", () => {
  const token = signToken("charge-123", secret);
  const [payload, signature] = token.split(".");
  const forged = `${Buffer.from("charge-999").toString("base64url")}.${signature}`;
  assert.equal(verifyToken(forged, secret), null);
  assert.equal(verifyToken(`${payload}.${signature.slice(0, -2)}AA`, secret), null);
  assert.equal(verifyToken(token, "t".repeat(40)), null);
  assert.equal(verifyToken(`${token}.extra`, secret), null);
  assert.equal(verifyToken(payload, secret), null);
  assert.equal(verifyToken("", secret), null);
  assert.equal(verifyToken("lixo", secret), null);
});

test("o segredo vem do ambiente e exige 32 caracteres", () => {
  assert.equal(masterSecret({ RECEBEFACIL_SECRET: secret }, "/nao/usa"), secret);
  assert.throws(() => masterSecret({ RECEBEFACIL_SECRET: "curto" }, "/nao/usa"), /32 caracteres/);
});

test("em produção sem segredo dá erro claro", () => {
  assert.throws(() => masterSecret({ NODE_ENV: "production" }, "/nao/usa"), /RECEBEFACIL_SECRET/);
});

test("em desenvolvimento o segredo é gerado uma vez e guardado na pasta de dados", async () => {
  const dir = await mkdtemp(join(tmpdir(), "recebefacil-secret-"));
  const env = { NODE_ENV: "development" };
  const first = masterSecret(env, dir);
  assert.ok(first.length >= 32);
  assert.equal(masterSecret(env, dir), first);
  assert.equal((await readFile(join(dir, ".secret"), "utf8")).trim(), first);
});
