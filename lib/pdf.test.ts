import assert from "node:assert/strict";
import test from "node:test";
import { pdfDocument } from "./pdf";

test("o PDF passa de uma página quando o relatório passa de 45 linhas", () => {
  const lines = Array.from({ length: 50 }, (_, index) => `linha ${index + 1}`);
  const pdf = pdfDocument(lines);
  const pages = pdf.match(/\/Type \/Page /g) || [];
  assert.equal(pages.length, 2);
  assert.match(pdf, /linha 50/);
});
