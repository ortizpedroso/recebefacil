import assert from "node:assert/strict";
import test from "node:test";
import { isPlatformOwner } from "./platform-owner";

const env = { PLATFORM_OWNER_EMAILS: " Dono@Plataforma.com.br , outra@pessoa.com " };
const person = (viewerEmail: string) => ({ publicDemo: false, viewerEmail, simulatedViewer: false });

test("o e-mail verificado na lista é dono, sem diferenciar maiúsculas nem espaços", () => {
  assert.equal(isPlatformOwner(person("dono@plataforma.com.br"), env), true);
  assert.equal(isPlatformOwner(person("OUTRA@pessoa.com"), env), true);
});

test("quem não está na lista, ou não tem e-mail, não é dono", () => {
  assert.equal(isPlatformOwner(person("lojista@loja.com"), env), false);
  assert.equal(isPlatformOwner(person(""), env), false);
  assert.equal(isPlatformOwner(person("dono@plataforma.com.br"), {}), false);
  assert.equal(isPlatformOwner(person("dono@plataforma.com.br"), { PLATFORM_OWNER_EMAILS: "" }), false);
});

test("a demonstração pública nunca é dona, nem com o e-mail na lista", () => {
  assert.equal(isPlatformOwner({ publicDemo: true, viewerEmail: "dono@plataforma.com.br", simulatedViewer: false }, env), false);
  assert.equal(isPlatformOwner({ publicDemo: true, viewerEmail: "", simulatedViewer: true }, env), false);
});

test("o visitante simulado do desenvolvimento é dono fora de produção e nunca em produção", () => {
  const simulated = { publicDemo: false, viewerEmail: "dev@example.com", simulatedViewer: true };
  assert.equal(isPlatformOwner(simulated, { NODE_ENV: "development" }), true);
  assert.equal(isPlatformOwner(simulated, {}), true);
  assert.equal(isPlatformOwner(simulated, { NODE_ENV: "production" }), false);
  assert.equal(isPlatformOwner(simulated, { NODE_ENV: "production", PLATFORM_OWNER_EMAILS: "dev@example.com" }), false);
});

test("em produção o visitante simulado só é dono com a liberação local explícita", () => {
  const simulated = { publicDemo: false, viewerEmail: "dev@example.com", simulatedViewer: true };
  assert.equal(isPlatformOwner(simulated, { NODE_ENV: "production", RECEBEFACIL_LOCAL_OWNER: "1" }), true);
  assert.equal(isPlatformOwner(simulated, { NODE_ENV: "production", RECEBEFACIL_LOCAL_OWNER: "true" }), false);
  assert.equal(isPlatformOwner({ publicDemo: true, viewerEmail: "", simulatedViewer: true }, { NODE_ENV: "production", RECEBEFACIL_LOCAL_OWNER: "1" }), false);
});
