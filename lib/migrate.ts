export const MIGRATIONS = [
  {
    id: "001_account_and_asaas",
    statements: [
      "alter table organizations add column if not exists password_hash text",
      "alter table organizations add column if not exists asaas_api_key_cipher text",
      "alter table organizations add column if not exists asaas_webhook_cipher text",
      "alter table organizations add column if not exists asaas_webhook_hash text",
      "alter table organizations add column if not exists asaas_key_hint text",
      "alter table clients add column if not exists asaas_customer_id text",
      "alter table charges add column if not exists asaas_payment_id text",
      "alter table charges add column if not exists invoice_url text",
      "alter table charges add column if not exists bank_slip_url text",
      "alter table charges add column if not exists pix_payload text",
      "alter table catalog_items add column if not exists stock_quantity integer",
      `create table if not exists auth_sessions (
        id text primary key,
        organization_id text not null references organizations(id),
        token_hash text not null unique,
        expires_at text not null
      )`,
      `create table if not exists webhook_events (
        id text primary key,
        organization_id text not null references organizations(id),
        event_id text not null,
        created_at text not null,
        unique (event_id)
      )`,
    ],
  },
] as const;

export async function applyMigrations(exec: (statement: string) => Promise<void>, appliedIds: () => Promise<string[]>) {
  await exec("create table if not exists schema_migrations (id text primary key, applied_at text not null)");
  const applied = new Set(await appliedIds());
  for (const migration of MIGRATIONS) {
    if (applied.has(migration.id)) continue;
    for (const statement of migration.statements) await exec(statement);
    const appliedAt = new Date().toISOString().replace(/'/g, "");
    await exec(`insert into schema_migrations (id, applied_at) values ('${migration.id}', '${appliedAt}')`);
  }
}
