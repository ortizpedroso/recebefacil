import assert from "node:assert/strict";
import test from "node:test";
import { decryptSecret, encryptSecret, safeEqual, SecretUnreadableError } from "./crypto";
import { cronSecret } from "./secret";

const master = "m".repeat(40);

test("o segredo cifrado volta igual e o texto guardado não mostra o original", () => {
  const token = encryptSecret("test-key-123", master);
  assert.match(token, /^v1:[\w-]+:[\w-]+:[\w-]+:[\w-]*$/);
  assert.ok(!token.includes("test-key-123"));
  assert.equal(decryptSecret(token, master), "test-key-123");
});

test("o mesmo valor cifrado duas vezes dá textos diferentes, e os dois abrem", () => {
  const first = encryptSecret("test-key-123", master);
  const second = encryptSecret("test-key-123", master);
  assert.notEqual(first, second);
  assert.equal(decryptSecret(first, master), decryptSecret(second, master));
});

test("adulterar qualquer parte do texto cifrado, ou trocar o segredo mestre, falha", () => {
  const parts = encryptSecret("test-key-123", master).split(":");
  const flip = (value: string) => `${value.startsWith("A") ? "B" : "A"}${value.slice(1)}`;
  for (const index of [1, 2, 3, 4]) {
    const tampered = parts.map((part, at) => (at === index ? flip(part) : part)).join(":");
    assert.throws(() => decryptSecret(tampered, master), SecretUnreadableError, `parte ${index}`);
  }
  assert.throws(() => decryptSecret(parts.join(":"), "x".repeat(40)), SecretUnreadableError);
});

test("formato desconhecido ou incompleto é recusado sem vazar nada", () => {
  for (const bad of ["", "texto-puro", "v2:a:b:c:d", "v1:a:b:c", "v1:a:b:c:d:e"]) {
    assert.throws(() => decryptSecret(bad, master), SecretUnreadableError);
  }
});

test("valor vazio também faz a viagem", () => {
  assert.equal(decryptSecret(encryptSecret("", master), master), "");
});

test("safeEqual aceita só o valor idêntico, de qualquer tamanho", () => {
  assert.equal(safeEqual("abc", "abc"), true);
  assert.equal(safeEqual("abc", "abd"), false);
  assert.equal(safeEqual("abc", "abcd"), false);
  assert.equal(safeEqual("", "abc"), false);
});

test("o segredo do agendador depende do segredo mestre e não o revela", () => {
  const a = cronSecret(master);
  assert.equal(a, cronSecret(master));
  assert.notEqual(a, cronSecret("y".repeat(40)));
  assert.ok(!a.includes(master));
});
