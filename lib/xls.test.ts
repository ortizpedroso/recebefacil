import assert from "node:assert/strict";
import test from "node:test";
import { xlsDocument } from "./xls";

test("o Excel vira SpreadsheetML com as células escapadas", () => {
  const xml = xlsDocument([
    ["codigo", "cliente"],
    ["VND-0001", "João & Silva"],
  ]);
  assert.match(xml, /Excel\.Sheet/);
  assert.match(xml, /<Data ss:Type="String">VND-0001<\/Data>/);
  assert.match(xml, /João &amp; Silva/);
});

test("a planilha vazia emite uma célula em branco em vez de quebrar", () => {
  const xml = xlsDocument([]);
  assert.match(xml, /<Data ss:Type="String"><\/Data>/);
});
