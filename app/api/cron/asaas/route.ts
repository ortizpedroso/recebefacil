import { reconcileAsaas } from "@/lib/asaas-settle";
import { safeEqual } from "@/lib/crypto";
import { getDb } from "@/lib/db";
import { cronSecret } from "@/lib/secret";

export const dynamic = "force-dynamic";

// Chamado por um agendador externo (ver o README). O cabeçalho carrega só um resumo do segredo mestre.
export async function POST(request: Request) {
  if (!safeEqual(request.headers.get("x-cron-secret") ?? "", cronSecret())) return Response.json({ error: "Não autorizado." }, { status: 401 });
  const report = await reconcileAsaas(await getDb(), new Date());
  return Response.json(report);
}
