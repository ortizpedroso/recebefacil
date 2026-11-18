import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { DB } from "./db";
import { DomainError } from "./errors";
import { catalogImages, catalogItems } from "./schema";

import { MAX_PHOTO_BYTES } from "./photo-limits";

export { MAX_PHOTO_BYTES };

const SIGNATURES: { mime: string; matches: (bytes: Uint8Array) => boolean }[] = [
  { mime: "image/jpeg", matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: "image/png", matches: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { mime: "image/webp", matches: (b) => b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 },
];

export type Photo = { mime: string; base64: string };

// O tipo vale pelo conteúdo do arquivo, não pelo que o navegador declarou: o mesmo tipo é devolvido ao servir a foto.
export function parsePhoto(bytes: Uint8Array): Photo {
  if (bytes.length === 0) throw new DomainError("A foto está vazia.");
  if (bytes.length > MAX_PHOTO_BYTES) throw new DomainError("A foto passa de 1 MB. Escolha uma foto menor.");
  const found = SIGNATURES.find((signature) => signature.matches(bytes));
  if (!found) throw new DomainError("Use uma foto JPG, PNG ou WebP.");
  return { mime: found.mime, base64: Buffer.from(bytes).toString("base64") };
}

export async function saveCatalogPhoto(db: DB, organizationId: string, itemId: string, photo: Photo) {
  const [item] = await db.select().from(catalogItems).where(and(eq(catalogItems.organizationId, organizationId), eq(catalogItems.id, itemId)));
  if (!item) throw new DomainError("Item não encontrado.");
  await db.transaction(async (tx) => {
    await tx.delete(catalogImages).where(eq(catalogImages.catalogItemId, itemId));
    await tx.insert(catalogImages).values({ id: randomUUID(), organizationId, catalogItemId: itemId, mime: photo.mime, bytes: photo.base64, createdAt: new Date().toISOString() });
  });
}

export async function loadCatalogPhoto(db: DB, organizationId: string, photoId: string) {
  const [row] = await db.select().from(catalogImages).where(and(eq(catalogImages.organizationId, organizationId), eq(catalogImages.id, photoId)));
  return row ? { mime: row.mime, bytes: Buffer.from(row.bytes, "base64") } : null;
}

// Só para a rota que já provou o acesso por assinatura. Qualquer outra leitura passa por loadCatalogPhoto, que confere a empresa.
export async function loadCatalogPhotoAnyOrg(db: DB, photoId: string) {
  const [row] = await db.select().from(catalogImages).where(eq(catalogImages.id, photoId));
  return row ? { mime: row.mime, bytes: Buffer.from(row.bytes, "base64") } : null;
}
