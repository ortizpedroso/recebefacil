import { handleAsaasWebhook } from "@/lib/asaas-webhook";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleAsaasWebhook(request, { db: await getDb() });
}
