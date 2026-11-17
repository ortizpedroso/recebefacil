import { z } from "zod";
import type { ClientInput } from "./clients";
import { documentKind, onlyDigits } from "./documents";
import { CATALOG_KINDS, PAYMENT_METHODS } from "./labels";
import { MAX_INSTALLMENTS } from "./money";
import { MAX_ADJUST_BP, MAX_FINANCE_INTEREST_BP } from "./schedule";

export function formResolver<T>(schema: z.ZodType<T>) {
  return async (values: unknown) => {
    const parsed = schema.safeParse(values);
    if (parsed.success) return { values: parsed.data, errors: {} };
    const errors: Record<string, { type: string; message: string }> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "root");
      if (!errors[key]) errors[key] = { type: issue.code, message: issue.message };
    }
    return { values: {}, errors };
  };
}

export const moneyField = z.string().trim().min(1);
export const dateField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const periodicityField = z.enum(["semanal", "quinzenal", "mensal", "trimestral", "semestral", "anual"]);
// "Cartão de crédito" segue aceito porque cobranças antigas guardam esse texto.
export const methodField = z.enum([...PAYMENT_METHODS, "Cartão de crédito"]);

const whatsappField = z
  .string()
  .trim()
  .refine((value) => [10, 11].includes(onlyDigits(value).length), "Informe o WhatsApp com DDD.");

// CPF ou CNPJ só é exigido quando preenchido.
const optionalDocument = z.string().trim().max(18).refine((value) => value === "" || documentKind(value) !== null, "CPF ou CNPJ inválido.");

export const clientSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome.").max(160),
  whatsapp: whatsappField,
  document: optionalDocument,
  email: z.string().trim().max(160).refine((value) => value === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), "Informe um e-mail."),
  zip: z.string().trim().max(12).default(""),
  state: z.string().trim().max(2).default(""),
  city: z.string().trim().max(80).default(""),
  district: z.string().trim().max(80).default(""),
  street: z.string().trim().max(120).default(""),
  number: z.string().trim().max(20).default(""),
  complement: z.string().trim().max(80).default(""),
  notes: z.string().trim().max(2000).default(""),
});

export function toClientInput(data: z.infer<typeof clientSchema>): ClientInput {
  return { ...data, kind: documentKind(data.document) ?? "pf", phone: data.whatsapp };
}

export const newClientSchema = z.object({ name: clientSchema.shape.name, whatsapp: whatsappField, document: optionalDocument });

export const catalogSchema = z.object({
  kind: z.enum(CATALOG_KINDS),
  name: z.string().trim().min(2, "Informe o nome.").max(160),
  price: moneyField,
  category: z.string().trim().max(80).default(""),
  sku: z.string().trim().max(40).default(""),
  stock: z.string().trim().max(8).default(""),
});

export const saleItemSchema = z.object({
  catalogItemId: z.string().uuid().nullable(),
  description: z.string().trim().min(2).max(180),
  kind: z.enum(["produto", "servico"]),
  quantity: z.number().int().min(1).max(999),
  unitCents: z.number().int().positive(),
});

export const saleSchema = z
  .object({
    clientId: z.string().uuid().optional(),
    newClient: newClientSchema.optional(),
    soldOn: dateField,
    discountCents: z.number().int().min(0),
    notes: z.string().trim().max(2000).default(""),
    mode: z.enum(["avista", "parcelado", "recorrente"]),
    entryCents: z.number().int().min(0),
    installmentCount: z.number().int().min(1).max(MAX_INSTALLMENTS),
    firstDue: dateField,
    periodicity: periodicityField,
    interestMonthlyBp: z.number().int().min(0).max(MAX_FINANCE_INTEREST_BP).default(0),
    adjustYearlyBp: z.number().int().min(0).max(MAX_ADJUST_BP).default(0),
    method: methodField,
    paidNow: z.object({ method: methodField, paidOn: dateField }).optional(),
    items: z.array(saleItemSchema).min(1),
  })
  .refine((value) => Boolean(value.clientId) !== Boolean(value.newClient), "Escolha o cliente da venda.");

export const paymentSchema = z.object({
  chargeId: z.string().uuid(),
  amount: moneyField,
  fee: z.string().trim().default("0"),
  paidOn: dateField,
  method: methodField,
  idempotencyKey: z.string().trim().min(8).max(100),
});

export const dueSchema = z.object({
  chargeId: z.string().uuid(),
  dueOn: dateField,
});

export const chargeSchema = z.object({
  clientId: z.string().uuid(),
  amount: moneyField,
  dueOn: dateField,
  method: methodField,
});
