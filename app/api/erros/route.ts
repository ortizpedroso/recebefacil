import { logError } from "@/lib/log";
import { requireSession } from "@/lib/session";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const message = String((body as { message?: unknown }).message || "erro sem detalhe").slice(0, 500);
  try {
    const session = await requireSession();
    await logError(session.db, session.org.id, "tela", new Error(message));
  } catch {
    console.error(JSON.stringify({ scope: "tela", message, at: new Date().toISOString() }));
  }
  return Response.json({ ok: true });
}
