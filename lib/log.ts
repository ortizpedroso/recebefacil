import { randomUUID } from "node:crypto";
import type { DB } from "./db";
import { errorEvents } from "./schema";

export async function logError(db: DB, organizationId: string | null, scope: string, error: unknown) {
  const message = (error instanceof Error ? error.message : String(error)).slice(0, 500);
  console.error(JSON.stringify({ scope, message, at: new Date().toISOString() }));
  if (!organizationId) return;
  await db.insert(errorEvents).values({
    id: randomUUID(),
    organizationId,
    scope,
    message,
    createdAt: new Date().toISOString(),
  });
}
