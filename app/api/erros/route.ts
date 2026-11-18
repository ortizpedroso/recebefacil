import { logError } from "@/lib/log";
import { requireSession } from "@/lib/session";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { message: text, digest } = body as { message?: unknown; digest?: unknown };
  const message = `${String(text || "erro sem detalhe")}${digest ? ` (digest ${String(digest)})` : ""}`.slice(0, 500);
  const session = await requireSession().catch(() => null);
  // A demonstração é anônima: o que ela manda vai só ao log, para ninguém encher a tabela de erros.
  if (session && !session.publicDemo) await logError(session.db, session.org.id, "tela", new Error(message)).catch(() => undefined);
  else console.error(JSON.stringify({ scope: "tela", message, at: new Date().toISOString() }));
  return Response.json({ ok: true });
}
