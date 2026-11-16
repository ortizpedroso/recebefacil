import { boolean, index, integer, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";

export const organizations = pgTable(
  "organizations",
  {
    id: text("id").primaryKey(),
    viewerKey: text("viewer_key").notNull(),
    tradeName: text("trade_name").notNull(),
    legalName: text("legal_name").notNull(),
    document: text("document").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    address: text("address").notNull(),
    timezone: text("timezone").notNull(),
    asaasEnvironment: text("asaas_environment").notNull(),
    asaasConnected: boolean("asaas_connected").notNull(),
    asaasSyncedAt: text("asaas_synced_at"),
    asaasApiKeyCipher: text("asaas_api_key_cipher"),
    asaasWebhookCipher: text("asaas_webhook_cipher"),
    asaasWebhookHash: text("asaas_webhook_hash"),
    asaasKeyHint: text("asaas_key_hint"),
    passwordHash: text("password_hash"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [uniqueIndex("organizations_viewer_key").on(table.viewerKey)],
);

export const members = pgTable(
  "members",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    role: text("role").notNull(),
    active: boolean("active").notNull(),
  },
  (table) => [index("members_org").on(table.organizationId)],
);

export const clients = pgTable(
  "clients",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    kind: text("kind").notNull(),
    name: text("name").notNull(),
    document: text("document").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    whatsapp: text("whatsapp").notNull(),
    zip: text("zip").notNull(),
    state: text("state").notNull(),
    city: text("city").notNull(),
    district: text("district").notNull(),
    street: text("street").notNull(),
    number: text("number").notNull(),
    complement: text("complement").notNull(),
    notes: text("notes").notNull(),
    active: boolean("active").notNull(),
    createdAt: text("created_at").notNull(),
    asaasCustomerId: text("asaas_customer_id"),
  },
  (table) => [index("clients_org_name").on(table.organizationId, table.name)],
);

export const catalogItems = pgTable(
  "catalog_items",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    kind: text("kind").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    category: text("category").notNull(),
    sku: text("sku").notNull(),
    priceCents: integer("price_cents").notNull(),
    billing: text("billing").notNull(),
    stockQuantity: integer("stock_quantity"),
    active: boolean("active").notNull(),
  },
  (table) => [index("catalog_org").on(table.organizationId)],
);

export const sales = pgTable(
  "sales",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    code: text("code").notNull(),
    clientId: text("client_id").notNull(),
    soldOn: text("sold_on").notNull(),
    discountCents: integer("discount_cents").notNull(),
    totalCents: integer("total_cents").notNull(),
    notes: text("notes").notNull(),
    mode: text("mode").notNull(),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("sales_org_date").on(table.organizationId, table.soldOn)],
);

export const saleItems = pgTable(
  "sale_items",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    saleId: text("sale_id").notNull(),
    catalogItemId: text("catalog_item_id"),
    description: text("description").notNull(),
    kind: text("kind").notNull(),
    quantity: integer("quantity").notNull(),
    unitCents: integer("unit_cents").notNull(),
    totalCents: integer("total_cents").notNull(),
  },
  (table) => [index("sale_items_sale").on(table.organizationId, table.saleId)],
);

export const contracts = pgTable(
  "contracts",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    number: text("number").notNull(),
    clientId: text("client_id").notNull(),
    saleId: text("sale_id").notNull(),
    description: text("description").notNull(),
    totalCents: integer("total_cents").notNull(),
    startsOn: text("starts_on").notNull(),
    endsOn: text("ends_on"),
    status: text("status").notNull(),
    terms: text("terms").notNull(),
  },
  (table) => [index("contracts_org").on(table.organizationId)],
);

export const installments = pgTable(
  "installments",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    saleId: text("sale_id").notNull(),
    contractId: text("contract_id"),
    clientId: text("client_id").notNull(),
    number: integer("number").notNull(),
    count: integer("count").notNull(),
    label: text("label").notNull(),
    dueOn: text("due_on").notNull(),
    amountCents: integer("amount_cents").notNull(),
    paidCents: integer("paid_cents").notNull(),
    status: text("status").notNull(),
  },
  (table) => [index("installments_org_due").on(table.organizationId, table.dueOn)],
);

export const recurrences = pgTable(
  "recurrences",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    clientId: text("client_id").notNull(),
    catalogItemId: text("catalog_item_id"),
    description: text("description").notNull(),
    amountCents: integer("amount_cents").notNull(),
    periodicity: text("periodicity").notNull(),
    startsOn: text("starts_on").notNull(),
    nextOn: text("next_on").notNull(),
    endsOn: text("ends_on"),
    status: text("status").notNull(),
  },
  (table) => [index("recurrences_org").on(table.organizationId)],
);

export const charges = pgTable(
  "charges",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    code: text("code").notNull(),
    clientId: text("client_id").notNull(),
    saleId: text("sale_id"),
    contractId: text("contract_id"),
    installmentId: text("installment_id"),
    recurrenceId: text("recurrence_id"),
    amountCents: integer("amount_cents").notNull(),
    paidCents: integer("paid_cents").notNull(),
    dueOn: text("due_on").notNull(),
    method: text("method").notNull(),
    status: text("status").notNull(),
    paidOn: text("paid_on"),
    asaasPaymentId: text("asaas_payment_id"),
    invoiceUrl: text("invoice_url"),
    bankSlipUrl: text("bank_slip_url"),
    pixPayload: text("pix_payload"),
  },
  (table) => [index("charges_org_due").on(table.organizationId, table.dueOn)],
);

export const authSessions = pgTable("auth_sessions", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  tokenHash: text("token_hash").notNull(),
  expiresAt: text("expires_at").notNull(),
});

export const webhookEvents = pgTable("webhook_events", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  eventId: text("event_id").notNull(),
  createdAt: text("created_at").notNull(),
});

export const payments = pgTable(
  "payments",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    chargeId: text("charge_id").notNull(),
    installmentId: text("installment_id"),
    amountCents: integer("amount_cents").notNull(),
    paidOn: text("paid_on").notNull(),
    method: text("method").notNull(),
    note: text("note").notNull(),
    idempotencyKey: text("idempotency_key"),
    reversedAt: text("reversed_at"),
  },
  (table) => [index("payments_org").on(table.organizationId, table.chargeId)],
);

export const contacts = pgTable(
  "contacts",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    clientId: text("client_id").notNull(),
    chargeId: text("charge_id"),
    channel: text("channel").notNull(),
    summary: text("summary").notNull(),
    promiseOn: text("promise_on"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("contacts_org").on(table.organizationId)],
);

export const dueChanges = pgTable("due_changes", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  installmentId: text("installment_id").notNull(),
  previousDue: text("previous_due").notNull(),
  nextDue: text("next_due").notNull(),
  createdAt: text("created_at").notNull(),
});

export const integrationEvents = pgTable("integration_events", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  happenedAt: text("happened_at").notNull(),
  kind: text("kind").notNull(),
  status: text("status").notNull(),
  description: text("description").notNull(),
});

export const subscriptions = pgTable("subscriptions", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  planCode: text("plan_code").notNull(),
  status: text("status").notNull(),
  trialEndsOn: text("trial_ends_on").notNull(),
  periodEndsOn: text("period_ends_on").notNull(),
});

export const platformInvoices = pgTable("platform_invoices", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  subscriptionId: text("subscription_id").notNull(),
  amountCents: integer("amount_cents").notNull(),
  status: text("status").notNull(),
  dueOn: text("due_on").notNull(),
  paidOn: text("paid_on"),
});

export const fiscalDocuments = pgTable("fiscal_documents", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  saleId: text("sale_id").notNull(),
  number: integer("number").notNull(),
  series: text("series").notNull(),
  status: text("status").notNull(),
  totalCents: integer("total_cents").notNull(),
  accessKey: text("access_key").notNull(),
  issuedAt: text("issued_at").notNull(),
});

export const stockMoves = pgTable("stock_moves", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  catalogItemId: text("catalog_item_id").notNull(),
  saleId: text("sale_id"),
  quantity: integer("quantity").notNull(),
  reason: text("reason").notNull(),
  createdAt: text("created_at").notNull(),
});

export const campaigns = pgTable("campaigns", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  body: text("body").notNull(),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
});

export const campaignRecipients = pgTable("campaign_recipients", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  campaignId: text("campaign_id").notNull(),
  clientId: text("client_id").notNull(),
  phone: text("phone").notNull(),
  body: text("body").notNull(),
  status: text("status").notNull(),
});

export const supportTickets = pgTable("support_tickets", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  contact: text("contact").notNull(),
  message: text("message").notNull(),
  createdAt: text("created_at").notNull(),
});

export const errorEvents = pgTable("error_events", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  scope: text("scope").notNull(),
  message: text("message").notNull(),
  createdAt: text("created_at").notNull(),
});
