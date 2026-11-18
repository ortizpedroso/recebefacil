import { getDb } from "@/lib/db";
import { photoSignatureValid } from "@/lib/pay-page";
import { loadCatalogPhoto, loadCatalogPhotoAnyOrg } from "@/lib/photos";
import { requireSession } from "@/lib/session";

const IMMUTABLE = "max-age=31536000, immutable";

function image(photo: { mime: string; bytes: Buffer }, id: string, scope: "public" | "private") {
  return new Response(new Uint8Array(photo.bytes), {
    headers: {
      "content-type": photo.mime,
      "cache-control": `${scope}, ${IMMUTABLE}`,
      etag: `"${id}"`,
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; sandbox",
    },
  });
}

const missing = () => new Response("Foto não encontrada.", { status: 404 });

// A foto troca de id quando o produto ganha outra foto, então o cache nunca fica velho.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const signature = new URL(request.url).searchParams.get("s");
  if (signature !== null) {
    // Link assinado, usado na página pública de pagamento: o cliente final não tem sessão.
    if (!photoSignatureValid(id, signature)) return missing();
    const photo = await loadCatalogPhotoAnyOrg(await getDb(), id);
    return photo ? image(photo, id, "public") : missing();
  }
  const { db, org } = await requireSession();
  const photo = await loadCatalogPhoto(db, org.id, id);
  return photo ? image(photo, id, "private") : missing();
}
