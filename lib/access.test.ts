import assert from "node:assert/strict";
import test from "node:test";
import { can } from "./access";

test("o papel limita a ação", () => {
  assert.equal(can("administrador", "equipe.convidar"), true);
  assert.equal(can("vendedor", "vendas.criar"), true);
  assert.equal(can("operador", "pagamentos.estornar"), false);
  assert.equal(can("financeiro", "fiscal.emitir"), true);
  assert.equal(can("vendedor", "assinatura.gerir"), false);
});
