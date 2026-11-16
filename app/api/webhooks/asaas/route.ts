import { applyAsaasWebhook } from "@/lib/asaas-webhook";
import { getDb } from "@/lib/db";

export async function POST(request: Request) {
  const token = request.headers.get("asaas-access-token") || "";
  const body = await request.json().catch(() => ({}));
  const db = await getDb();
  const result = await applyAsaasWebhook(db, token, body);
  return Response.json(result.body, { status: result.status });
}
