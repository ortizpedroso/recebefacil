import { sql } from "drizzle-orm";
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
    lateFineBp: integer("late_fine_bp").notNull().default(200),
    lateInterestMonthlyBp: integer("late_interest_monthly_bp").notNull().default(100),
    pixKey: text("pix_key").notNull().default(""),
    paymentInstructions: text("payment_instructions").notNull().default(""),
    receivingMode: text("receiving_mode").$type<"gestao" | "integrado">().notNull().default("gestao"),
    asaasWalletId: text("asaas_wallet_id").notNull().default(""),
    asaasAccountName: text("asaas_account_name").notNull().default(""),
    asaasCustomerId: text("asaas_customer_id"),
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
    asaasCustomerId: text("asaas_customer_id"),
    createdAt: text("created_at").notNull(),
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
    billing: text("billing").notNull().default("pontual"),
    stockQuantity: integer("stock_quantity"),
    active: boolean("active").notNull(),
  },
  (table) => [index("catalog_org").on(table.organizationId)],
);

export const catalogImages = pgTable(
  "catalog_images",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    catalogItemId: text("catalog_item_id").notNull(),
    mime: text("mime").notNull(),
    bytes: text("bytes").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [uniqueIndex("catalog_images_item").on(table.catalogItemId)],
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
    installmentCount: integer("installment_count"),
    periodicity: text("periodicity"),
    interestMonthlyBp: integer("interest_monthly_bp").notNull().default(0),
    adjustYearlyBp: integer("adjust_yearly_bp").notNull().default(0),
    entryCents: integer("entry_cents").notNull().default(0),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("sales_org_date").on(table.organizationId, table.soldOn),
    uniqueIndex("sales_org_code").on(table.organizationId, table.code),
  ],
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
    saleId: text("sale_id"),
    description: text("description").notNull(),
    totalCents: integer("total_cents").notNull(),
    startsOn: text("starts_on").notNull(),
    endsOn: text("ends_on"),
    status: text("status").notNull(),
    terms: text("terms").notNull(),
  },
  (table) => [index("contracts_org").on(table.organizationId), uniqueIndex("contracts_org_number").on(table.organizationId, table.number)],
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
    recurrenceId: text("recurrence_id"),
    number: integer("number"),
    count: integer("count"),
    label: text("label"),
    amountCents: integer("amount_cents").notNull(),
    paidCents: integer("paid_cents").notNull(),
    dueOn: text("due_on").notNull(),
    method: text("method").notNull(),
    status: text("status").notNull(),
    paidOn: text("paid_on"),
    asaasPaymentId: text("asaas_payment_id"),
    asaasBillingType: text("asaas_billing_type"),
    asaasInvoiceUrl: text("asaas_invoice_url"),
    asaasBankSlipUrl: text("asaas_bank_slip_url"),
    asaasIdentificationField: text("asaas_identification_field"),
    asaasPixPayload: text("asaas_pix_payload"),
    asaasPixImage: text("asaas_pix_image"),
    asaasPixExpiresAt: text("asaas_pix_expires_at"),
    asaasValueCents: integer("asaas_value_cents"),
    asaasSyncedAt: text("asaas_synced_at"),
  },
  (table) => [
    index("charges_org_due").on(table.organizationId, table.dueOn),
    uniqueIndex("charges_org_code").on(table.organizationId, table.code),
    uniqueIndex("charges_recurrence_due").on(table.recurrenceId, table.dueOn).where(sql`recurrence_id is not null`),
    uniqueIndex("charges_org_asaas_payment").on(table.organizationId, table.asaasPaymentId).where(sql`asaas_payment_id is not null`),
  ],
);

export const payments = pgTable(
  "payments",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    chargeId: text("charge_id").notNull(),
    amountCents: integer("amount_cents").notNull(),
    feeCents: integer("fee_cents").notNull().default(0),
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
  chargeId: text("charge_id"),
  previousDue: text("previous_due").notNull(),
  nextDue: text("next_due").notNull(),
  createdAt: text("created_at").notNull(),
});

export type PlanCode = "gestao" | "integrado";
export type SubscriptionStatus = "teste" | "aguardando_pagamento" | "ativa" | "inadimplente" | "cancelada";
export type InvoiceStatus = "aberta" | "vencida" | "paga" | "estornada" | "cancelada";

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    planCode: text("plan_code").$type<PlanCode>().notNull(),
    status: text("status").$type<SubscriptionStatus>().notNull(),
    trialEndsOn: text("trial_ends_on").notNull(),
    periodEndsOn: text("period_ends_on").notNull(),
    asaasSubscriptionId: text("asaas_subscription_id"),
  },
  (table) => [
    uniqueIndex("subscriptions_organization").on(table.organizationId),
    uniqueIndex("subscriptions_asaas_subscription").on(table.asaasSubscriptionId).where(sql`asaas_subscription_id is not null`),
  ],
);

export const platformInvoices = pgTable(
  "platform_invoices",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    subscriptionId: text("subscription_id").notNull(),
    amountCents: integer("amount_cents").notNull(),
    status: text("status").$type<InvoiceStatus>().notNull(),
    dueOn: text("due_on").notNull(),
    paidOn: text("paid_on"),
    asaasPaymentId: text("asaas_payment_id"),
    invoiceUrl: text("invoice_url"),
  },
  (table) => [uniqueIndex("platform_invoices_asaas_payment").on(table.asaasPaymentId).where(sql`asaas_payment_id is not null`)],
);

export const fiscalDocuments = pgTable(
  "fiscal_documents",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    saleId: text("sale_id").notNull(),
    number: integer("number").notNull(),
    series: text("series").notNull(),
    status: text("status").notNull(),
    totalCents: integer("total_cents").notNull(),
    accessKey: text("access_key").notNull(),
    issuedAt: text("issued_at").notNull(),
  },
  (table) => [uniqueIndex("fiscal_documents_org_series_number").on(table.organizationId, table.series, table.number)],
);

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

export const platformSettings = pgTable("platform_settings", {
  id: text("id").primaryKey(),
  asaasEnvironment: text("asaas_environment").$type<"sandbox" | "producao">().notNull().default("sandbox"),
  asaasApiKeyEnc: text("asaas_api_key_enc").notNull().default(""),
  asaasApiKeyHint: text("asaas_api_key_hint").notNull().default(""),
  asaasWalletId: text("asaas_wallet_id").notNull().default(""),
  asaasAccountName: text("asaas_account_name").notNull().default(""),
  asaasWebhookTokenEnc: text("asaas_webhook_token_enc").notNull().default(""),
  asaasWebhookTokenHint: text("asaas_webhook_token_hint").notNull().default(""),
  platformFeeBp: integer("platform_fee_bp").notNull().default(150),
  planGestaoCents: integer("plan_gestao_cents").notNull().default(4990),
  planIntegradoCents: integer("plan_integrado_cents").notNull().default(3990),
  updatedAt: text("updated_at").notNull().default(""),
  updatedBy: text("updated_by").notNull().default(""),
});

export const asaasWebhookEvents = pgTable("asaas_webhook_events", {
  id: text("id").primaryKey(),
  event: text("event").notNull(),
  paymentId: text("payment_id"),
  receivedAt: text("received_at").notNull(),
  processedAt: text("processed_at"),
});
