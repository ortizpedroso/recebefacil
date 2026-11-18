import assert from "node:assert/strict";
import test from "node:test";
import { allowedInDemo, can } from "./access";

test("o papel limita a ação", () => {
  assert.equal(can("administrador", "equipe.convidar"), true);
  assert.equal(can("vendedor", "vendas.criar"), true);
  assert.equal(can("operador", "pagamentos.estornar"), false);
  assert.equal(can("financeiro", "fiscal.emitir"), true);
  assert.equal(can("vendedor", "assinatura.gerir"), false);
  assert.equal(can("vendedor", "vendas.editar"), true);
  assert.equal(can("operador", "vendas.editar"), false);
  assert.equal(can("vendedor", "vendas.excluir"), true);
  assert.equal(can("operador", "vendas.excluir"), false);
  assert.equal(can("financeiro", "cobrancas.gravar"), true);
  assert.equal(can("operador", "cobrancas.gravar"), false);
  assert.equal(can("vendedor", "cobrancas.gravar"), false);
});

test("a demonstração pública não muda o que o cliente final vê", () => {
  assert.equal(allowedInDemo("empresa.gravar"), false);
  assert.equal(allowedInDemo("equipe.convidar"), false);
  assert.equal(allowedInDemo("mensagens.enviar"), false);
  assert.equal(allowedInDemo("vendas.criar"), true);
  assert.equal(allowedInDemo("demo.resetar"), true);
});
