import { z } from "zod";
import { getDb } from "@/lib/db";
import { logWarning } from "@/lib/log";
import { checkWebhookToken, loadPlatformSettings } from "@/lib/platform-settings";
import { authorizeTransfer } from "@/lib/withdrawals";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  type: z.string().optional(),
  transfer: z.object({ id: z.string().nullish(), value: z.number().nullish(), externalReference: z.string().nullish() }),
});

const refuse = (refuseReason: string) => Response.json({ status: "REFUSED", refuseReason });

// Mecanismo de validação de saque do Asaas: cada transferência da subconta pergunta aqui antes de sair.
export async function POST(request: Request) {
  const db = await getDb();
  const settings = await loadPlatformSettings(db);
  const check = checkWebhookToken(settings, request.headers.get("asaas-access-token") ?? "");
  if (check !== "match") return Response.json({ error: "Token inválido." }, { status: 401 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return refuse("Corpo inválido.");
  const decision = await authorizeTransfer(db, parsed.data.transfer);
  if (!decision.approved) {
    logWarning("saque.autorizacao", decision.reason);
    return refuse(decision.reason);
  }
  return Response.json({ status: "APPROVED" });
}
