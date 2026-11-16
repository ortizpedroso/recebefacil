import assert from "node:assert/strict";
import test from "node:test";
import { isValidCnpj, isValidCpf } from "./documents";

test("CPF e CNPJ inválidos são recusados e os dígitos certos passam", () => {
  assert.equal(isValidCpf("111.444.777-35"), true);
  assert.equal(isValidCpf("111.111.111-11"), false);
  assert.equal(isValidCpf("222.333.444-55"), false);
  assert.equal(isValidCnpj("34.567.890/0001-30"), true);
  assert.equal(isValidCnpj("34.567.890/0001-12"), false);
});
