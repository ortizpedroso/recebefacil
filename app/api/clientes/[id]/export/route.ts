import { allowedInDemo, can } from "@/lib/access";
import { DomainError } from "@/lib/ledger";
import { exportClient } from "@/lib/privacy";
import { requireSession } from "@/lib/session";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await requireSession();
  if (!can(session.role, "clientes.dados") || (session.publicDemo && !allowedInDemo("clientes.dados"))) {
    return Response.json({ error: "Seu papel não pode exportar dados de cliente." }, { status: 403 });
  }
  try {
    const payload = await exportClient(session.db, session.org.id, id);
    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="cliente-${id}.json"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof DomainError) return Response.json({ error: error.message }, { status: 404 });
    throw error;
  }
}
