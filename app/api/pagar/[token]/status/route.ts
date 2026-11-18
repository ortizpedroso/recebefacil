import { getDb } from "@/lib/db";
import { payState } from "@/lib/pay-status";
import { verifyToken } from "@/lib/secret";

export const dynamic = "force-dynamic";

// A tela do Pix pergunta aqui a cada 4 segundos se o pagamento já entrou.
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const chargeId = verifyToken(token);
  const state = chargeId ? await payState(await getDb(), chargeId) : null;
  if (!state) return Response.json({ error: "Pagamento não encontrado." }, { status: 404, headers: { "cache-control": "no-store" } });
  return Response.json({ state }, { headers: { "cache-control": "no-store" } });
}
