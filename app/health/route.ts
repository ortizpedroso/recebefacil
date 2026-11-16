import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const db = await getDb();
    await db.execute(sql`select 1`);
    return Response.json({ ok: true, database: "up" });
  } catch {
    return Response.json({ ok: false, database: "down" }, { status: 503 });
  }
}
