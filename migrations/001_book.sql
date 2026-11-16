create table if not exists schema_migration (
  filename text primary key
);

create table if not exists merchant (
  viewer_id text primary key,
  legal_name text not null,
  pix_kind text not null,
  pix_value text not null
);

create table if not exists client (
  id text primary key,
  viewer_id text not null references merchant (viewer_id),
  name text not null,
  tax_kind text not null,
  tax_digits text not null,
  phone_digits text not null,
  unique (viewer_id, tax_digits)
);

create table if not exists crediario (
  id text primary key,
  viewer_id text not null references merchant (viewer_id),
  client_id text not null references client (id),
  idempotency_key text not null,
  description text not null,
  principal_centavos bigint not null check (principal_centavos > 0),
  installment_count int not null check (installment_count between 1 and 60),
  first_due date not null,
  unique (viewer_id, idempotency_key)
);

create table if not exists contract (
  id text primary key,
  viewer_id text not null references merchant (viewer_id),
  client_id text not null references client (id),
  idempotency_key text not null,
  description text not null,
  amount_per_period_centavos bigint not null check (amount_per_period_centavos > 0),
  due_day int not null check (due_day between 1 and 31),
  opened_on date not null,
  unique (viewer_id, idempotency_key)
);

create table if not exists installment (
  id text primary key,
  viewer_id text not null references merchant (viewer_id),
  crediario_id text references crediario (id),
  contract_id text references contract (id),
  sequence int,
  period_key text,
  principal_centavos bigint not null check (principal_centavos > 0),
  due_on date not null,
  check ((crediario_id is not null) <> (contract_id is not null)),
  check (
    (crediario_id is not null and sequence is not null and period_key is null)
    or
    (contract_id is not null and period_key is not null and sequence is null)
  )
);

create unique index if not exists installment_crediario_seq
  on installment (crediario_id, sequence) where crediario_id is not null;

create unique index if not exists installment_contract_period
  on installment (contract_id, period_key) where contract_id is not null;

create index if not exists installment_viewer on installment (viewer_id, due_on);

create table if not exists receipt (
  id text primary key,
  viewer_id text not null references merchant (viewer_id),
  installment_id text not null references installment (id),
  idempotency_key text not null,
  amount_centavos bigint not null check (amount_centavos > 0),
  method text not null check (method in ('pix', 'boleto', 'card', 'cash', 'transfer')),
  confirmed_on date not null,
  unique (viewer_id, idempotency_key)
);

create index if not exists receipt_installment on receipt (installment_id);

create table if not exists reversal (
  id text primary key,
  viewer_id text not null references merchant (viewer_id),
  receipt_id text not null unique references receipt (id),
  reversed_on date not null
);
