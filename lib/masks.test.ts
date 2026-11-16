import assert from "node:assert/strict";
import test from "node:test";
import { addressFromViaCep } from "./cep";
import { maskCep, maskCnpj, maskCpf, maskMoney, maskPhone, maskUf } from "./masks";

test("documento, telefone, CEP e valor recebem a máscara brasileira", () => {
  assert.equal(maskCpf("52998224725"), "529.982.247-25");
  assert.equal(maskCnpj("34567890000112"), "34.567.890/0001-12");
  assert.equal(maskPhone("92988887777"), "(92) 98888-7777");
  assert.equal(maskPhone("9230000000"), "(92) 3000-0000");
  assert.equal(maskCep("69010060"), "69010-060");
  assert.equal(maskMoney("150000"), "1.500,00");
  assert.equal(maskUf("am"), "AM");
});

test("o retorno do ViaCEP vira rua, bairro, cidade e UF", () => {
  const address = addressFromViaCep({
    logradouro: "Rua 10 de Julho",
    bairro: "Centro",
    localidade: "Manaus",
    uf: "AM",
    complemento: "",
  });
  assert.equal(address?.street, "Rua 10 de Julho");
  assert.equal(address?.city, "Manaus");
  assert.equal(address?.state, "AM");
  assert.equal(addressFromViaCep({ erro: true }), null);
});
