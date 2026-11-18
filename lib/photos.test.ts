import assert from "node:assert/strict";
import test from "node:test";
import { DomainError } from "./errors";
import { MAX_PHOTO_BYTES, parsePhoto } from "./photos";

const jpeg = (size = 16) => Uint8Array.from({ length: size }, (_, index) => (index === 0 ? 0xff : index === 1 ? 0xd8 : index === 2 ? 0xff : 0));
const png = () => Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const webp = () => Uint8Array.from([0x52, 0x49, 0x46, 0x46, 1, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);

test("aceita JPEG, PNG e WebP pelo conteúdo do arquivo", () => {
  assert.equal(parsePhoto(jpeg()).mime, "image/jpeg");
  assert.equal(parsePhoto(png()).mime, "image/png");
  assert.equal(parsePhoto(webp()).mime, "image/webp");
});

test("devolve o arquivo em base64 sem perder bytes", () => {
  const photo = parsePhoto(png());
  assert.deepEqual([...Buffer.from(photo.base64, "base64")], [...png()]);
});

test("recusa tipo estranho, mesmo com extensão de imagem", () => {
  const gif = Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0, 0, 0]);
  const svg = new TextEncoder().encode("<svg onload=alert(1)></svg>");
  assert.throws(() => parsePhoto(gif), (error) => error instanceof DomainError && /JPG, PNG ou WebP/.test(error.message));
  assert.throws(() => parsePhoto(svg), /JPG, PNG ou WebP/);
});

test("recusa foto acima de 1 MB e arquivo vazio, aceitando o limite exato", () => {
  assert.equal(parsePhoto(jpeg(MAX_PHOTO_BYTES)).mime, "image/jpeg");
  assert.throws(() => parsePhoto(jpeg(MAX_PHOTO_BYTES + 1)), /passa de 1 MB/);
  assert.throws(() => parsePhoto(new Uint8Array()), /vazia/);
});
