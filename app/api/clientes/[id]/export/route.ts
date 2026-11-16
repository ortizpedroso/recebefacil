import { exportClient } from "@/lib/privacy";
import { requireSession } from "@/lib/session";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await requireSession();
  if (session.publicDemo) return Response.json({ error: "O visitante não exporta dados." }, { status: 403 });
  const payload = await exportClient(session.db, session.org.id, id);
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="cliente-${id}.json"`,
    },
  });
}
