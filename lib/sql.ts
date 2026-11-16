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
  sale_id text not null references sales(id),
  description text not null,
  total_cents integer not null,
  starts_on text not null,
  ends_on text,
  status text not null,
  terms text not null
);
create index if not exists contracts_org on contracts (organization_id);
create table if not exists installments (
  id text primary key,
  organization_id text not null references organizations(id),
  sale_id text not null references sales(id),
  contract_id text,
  client_id text not null references clients(id),
  number integer not null,
  count integer not null,
  label text not null,
  due_on text not null,
  amount_cents integer not null,
  paid_cents integer not null,
  status text not null,
  check (amount_cents > 0),
  check (paid_cents >= 0),
  check (paid_cents <= amount_cents)
);
create index if not exists installments_org_due on installments (organization_id, due_on);
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
  installment_id text,
  recurrence_id text,
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
  installment_id text,
  amount_cents integer not null,
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
  installment_id text not null references installments(id),
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
`;
