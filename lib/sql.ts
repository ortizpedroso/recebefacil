export const SCHEMA_SQL = `
create table if not exists organizations (
  id text primary key,
  viewer_key text not null unique,
  trade_name text not null,
  legal_name text not null,
  document text not null,
  email text not null,
  phone text not null,
  address text not null,
  timezone text not null,
  asaas_environment text not null,
  asaas_connected boolean not null,
  asaas_synced_at text,
  late_fine_bp integer not null default 200 check (late_fine_bp between 0 and 200),
  late_interest_monthly_bp integer not null default 100 check (late_interest_monthly_bp between 0 and 1000),
  created_at text not null
);
create table if not exists members (
  id text primary key,
  organization_id text not null references organizations(id),
  name text not null,
  email text not null,
  role text not null,
  active boolean not null
);
create index if not exists members_org on members (organization_id);
create table if not exists clients (
  id text primary key,
  organization_id text not null references organizations(id),
  kind text not null,
  name text not null,
  document text not null,
  email text not null,
  phone text not null,
  whatsapp text not null,
  zip text not null,
  state text not null,
  city text not null,
  district text not null,
  street text not null,
  number text not null,
  complement text not null,
  notes text not null,
  active boolean not null,
  created_at text not null
);
create index if not exists clients_org_name on clients (organization_id, name);
create table if not exists catalog_items (
  id text primary key,
  organization_id text not null references organizations(id),
  kind text not null,
  name text not null,
  description text not null,
  category text not null,
  sku text not null,
  price_cents integer not null,
  billing text not null,
  stock_quantity integer,
  active boolean not null
);
create index if not exists catalog_org on catalog_items (organization_id);
create table if not exists sales (
  id text primary key,
  organization_id text not null references organizations(id),
  code text not null,
  client_id text not null references clients(id),
  sold_on text not null,
  discount_cents integer not null,
  total_cents integer not null,
  notes text not null,
  mode text not null,
  status text not null,
  installment_count integer,
  periodicity text,
  interest_monthly_bp integer not null default 0,
  adjust_yearly_bp integer not null default 0,
  entry_cents integer not null default 0,
  created_at text not null,
  check (discount_cents >= 0),
  check (total_cents > 0)
);
create index if not exists sales_org_date on sales (organization_id, sold_on);
create table if not exists sale_items (
  id text primary key,
  organization_id text not null references organizations(id),
  sale_id text not null references sales(id),
  catalog_item_id text,
  description text not null,
  kind text not null,
  quantity integer not null,
  unit_cents integer not null,
  total_cents integer not null,
  check (quantity > 0),
  check (unit_cents > 0)
);
create index if not exists sale_items_sale on sale_items (organization_id, sale_id);
create table if not exists contracts (
  id text primary key,
  organization_id text not null references organizations(id),
  number text not null,
  client_id text not null references clients(id),
  sale_id text references sales(id),
  description text not null,
  total_cents integer not null,
  starts_on text not null,
  ends_on text,
  status text not null,
  terms text not null
);
create index if not exists contracts_org on contracts (organization_id);
create table if not exists recurrences (
  id text primary key,
  organization_id text not null references organizations(id),
  client_id text not null references clients(id),
  catalog_item_id text,
  description text not null,
  amount_cents integer not null,
  periodicity text not null,
  starts_on text not null,
  next_on text not null,
  ends_on text,
  status text not null
);
create index if not exists recurrences_org on recurrences (organization_id);
create table if not exists charges (
  id text primary key,
  organization_id text not null references organizations(id),
  code text not null,
  client_id text not null references clients(id),
  sale_id text,
  contract_id text,
  recurrence_id text,
  number integer,
  count integer,
  label text,
  amount_cents integer not null,
  paid_cents integer not null,
  due_on text not null,
  method text not null,
  status text not null,
  paid_on text,
  check (amount_cents > 0),
  check (paid_cents >= 0),
  check (paid_cents <= amount_cents)
);
create index if not exists charges_org_due on charges (organization_id, due_on);
create table if not exists payments (
  id text primary key,
  organization_id text not null references organizations(id),
  charge_id text not null references charges(id),
  amount_cents integer not null,
  fee_cents integer not null default 0 check (fee_cents >= 0),
  paid_on text not null,
  method text not null,
  note text not null,
  idempotency_key text,
  reversed_at text,
  check (amount_cents > 0)
);
create unique index if not exists payments_idempotency on payments (organization_id, idempotency_key);
create index if not exists payments_org on payments (organization_id, charge_id);
create table if not exists contacts (
  id text primary key,
  organization_id text not null references organizations(id),
  client_id text not null references clients(id),
  charge_id text,
  channel text not null,
  summary text not null,
  promise_on text,
  created_at text not null
);
create index if not exists contacts_org on contacts (organization_id);
create table if not exists due_changes (
  id text primary key,
  organization_id text not null references organizations(id),
  installment_id text,
  charge_id text references charges(id),
  previous_due text not null,
  next_due text not null,
  created_at text not null
);
create table if not exists integration_events (
  id text primary key,
  organization_id text not null references organizations(id),
  happened_at text not null,
  kind text not null,
  status text not null,
  description text not null
);
alter table catalog_items add column if not exists stock_quantity integer;
create table if not exists subscriptions (
  id text primary key,
  organization_id text not null references organizations(id),
  plan_code text not null,
  status text not null,
  trial_ends_on text not null,
  period_ends_on text not null
);
create table if not exists platform_invoices (
  id text primary key,
  organization_id text not null references organizations(id),
  subscription_id text not null references subscriptions(id),
  amount_cents integer not null,
  status text not null,
  due_on text not null,
  paid_on text
);
create table if not exists fiscal_documents (
  id text primary key,
  organization_id text not null references organizations(id),
  sale_id text not null references sales(id),
  number integer not null,
  series text not null,
  status text not null,
  total_cents integer not null,
  access_key text not null,
  issued_at text not null
);
create table if not exists stock_moves (
  id text primary key,
  organization_id text not null references organizations(id),
  catalog_item_id text not null references catalog_items(id),
  sale_id text references sales(id),
  quantity integer not null,
  reason text not null,
  created_at text not null
);
create table if not exists campaigns (
  id text primary key,
  organization_id text not null references organizations(id),
  body text not null,
  status text not null,
  created_at text not null
);
create table if not exists campaign_recipients (
  id text primary key,
  organization_id text not null references organizations(id),
  campaign_id text not null references campaigns(id),
  client_id text not null references clients(id),
  phone text not null,
  body text not null,
  status text not null
);
create table if not exists support_tickets (
  id text primary key,
  organization_id text not null references organizations(id),
  contact text not null,
  message text not null,
  created_at text not null
);
create table if not exists error_events (
  id text primary key,
  organization_id text not null references organizations(id),
  scope text not null,
  message text not null,
  created_at text not null
);
alter table contracts alter column sale_id drop not null;
alter table organizations add column if not exists late_fine_bp integer not null default 200 check (late_fine_bp between 0 and 200);
alter table organizations add column if not exists late_interest_monthly_bp integer not null default 100 check (late_interest_monthly_bp between 0 and 1000);
alter table sales add column if not exists installment_count integer;
alter table sales add column if not exists periodicity text;
alter table sales add column if not exists interest_monthly_bp integer not null default 0;
alter table sales add column if not exists adjust_yearly_bp integer not null default 0;
alter table sales add column if not exists entry_cents integer not null default 0;
alter table charges add column if not exists number integer;
alter table charges add column if not exists count integer;
alter table charges add column if not exists label text;
alter table payments add column if not exists fee_cents integer not null default 0 check (fee_cents >= 0);
alter table due_changes add column if not exists charge_id text references charges(id);
alter table due_changes alter column installment_id drop not null;
alter table organizations add column if not exists pix_key text not null default '';
alter table organizations add column if not exists payment_instructions text not null default '';
alter table catalog_items alter column billing set default 'pontual';
create table if not exists catalog_images (
  id text primary key,
  organization_id text not null references organizations(id),
  catalog_item_id text not null references catalog_items(id),
  mime text not null,
  bytes text not null,
  created_at text not null
);
create unique index if not exists catalog_images_item on catalog_images (catalog_item_id);
alter table organizations add column if not exists receiving_mode text not null default 'gestao' check (receiving_mode in ('gestao', 'integrado'));
alter table organizations add column if not exists asaas_wallet_id text not null default '';
alter table organizations add column if not exists asaas_account_name text not null default '';
alter table organizations alter column asaas_environment set default 'demonstracao';
alter table organizations alter column asaas_connected set default false;
alter table clients add column if not exists asaas_customer_id text;
alter table charges add column if not exists asaas_payment_id text;
alter table charges add column if not exists asaas_billing_type text;
alter table charges add column if not exists asaas_invoice_url text;
alter table charges add column if not exists asaas_bank_slip_url text;
alter table charges add column if not exists asaas_identification_field text;
alter table charges add column if not exists asaas_pix_payload text;
alter table charges add column if not exists asaas_pix_image text;
alter table charges add column if not exists asaas_pix_expires_at text;
alter table charges add column if not exists asaas_value_cents integer;
alter table charges add column if not exists asaas_synced_at text;
create unique index if not exists charges_org_asaas_payment on charges (organization_id, asaas_payment_id) where asaas_payment_id is not null;
create table if not exists platform_settings (
  id text primary key check (id = 'default'),
  asaas_environment text not null default 'sandbox' check (asaas_environment in ('sandbox', 'producao')),
  asaas_api_key_enc text not null default '',
  asaas_api_key_hint text not null default '',
  asaas_wallet_id text not null default '',
  asaas_account_name text not null default '',
  asaas_webhook_token_enc text not null default '',
  asaas_webhook_token_hint text not null default '',
  platform_fee_bp integer not null default 150 check (platform_fee_bp between 0 and 2000),
  plan_gestao_cents integer not null default 4990 check (plan_gestao_cents >= 0),
  plan_integrado_cents integer not null default 3990 check (plan_integrado_cents >= 0),
  updated_at text not null default '',
  updated_by text not null default ''
);
insert into platform_settings (id) values ('default') on conflict (id) do nothing;
create table if not exists asaas_webhook_events (
  id text primary key,
  event text not null,
  payment_id text,
  received_at text not null,
  processed_at text
);
`;

// Blocos com ponto e vírgula interno rodam inteiros, na ordem, depois do SCHEMA_SQL.
// Todos convergem para o mesmo estado se rodarem de novo.
const dedupe = (table: string, column: string, order: string) =>
  `update ${table} t set ${column} = t.${column} || '-' || d.rn from (select id, row_number() over (partition by organization_id, ${column} order by ${order}) rn from ${table}) d where t.id = d.id and d.rn > 1`;

// Duplicata antiga não se funde sozinha (há pagamento pendurado). O índice fica de fora e o aviso vai ao log.
const bestEffortUnique = (ddl: string) =>
  `do $$ begin ${ddl}; exception when unique_violation then raise warning 'indice unico ignorado: dados antigos duplicados'; end $$`;

export const MIGRATION_STATEMENTS = [
  `do $$ declare r record; begin
    if to_regclass('installments') is not null then
      for r in select conname from pg_constraint where conrelid = 'installments'::regclass and contype = 'f' loop
        execute format('alter table installments drop constraint %I', r.conname);
      end loop;
      execute 'update charges c set number = i.number, count = i.count, label = i.label from installments i where c.installment_id = i.id and c.number is null';
      execute 'update due_changes d set charge_id = c.id from charges c where d.charge_id is null and d.installment_id is not null and c.installment_id = d.installment_id and c.organization_id = d.organization_id';
    end if;
  end $$`,
  `update charges set status = case when paid_cents > 0 then 'parcial' else 'pendente' end where status = 'estornada'`,
  `update sales s set
    installment_count = case when s.mode = 'parcelado' then (select count(*) from charges c where c.organization_id = s.organization_id and c.sale_id = s.id and c.number is not null and coalesce(c.label, '') <> 'Entrada') else 1 end,
    entry_cents = coalesce((select sum(c.amount_cents) from charges c where c.organization_id = s.organization_id and c.sale_id = s.id and c.label = 'Entrada'), 0)
    where s.installment_count is null`,
  dedupe("sales", "code", "created_at, id"),
  dedupe("charges", "code", "id"),
  dedupe("contracts", "number", "id"),
  "create unique index if not exists sales_org_code on sales (organization_id, code)",
  "create unique index if not exists charges_org_code on charges (organization_id, code)",
  "create unique index if not exists contracts_org_number on contracts (organization_id, number)",
  bestEffortUnique("create unique index if not exists fiscal_documents_org_series_number on fiscal_documents (organization_id, series, number)"),
  bestEffortUnique("create unique index if not exists charges_recurrence_due on charges (recurrence_id, due_on) where recurrence_id is not null"),
  // "Mensalidade" virou um tipo do catálogo. A coluna billing fica só como espelho do tipo.
  `update catalog_items set kind = 'mensalidade' where billing = 'recorrente' and kind <> 'mensalidade'`,
  `update catalog_items set billing = 'recorrente' where kind = 'mensalidade' and billing <> 'recorrente'`,
  `update catalog_items set billing = 'pontual' where kind <> 'mensalidade' and billing <> 'pontual'`,
];
