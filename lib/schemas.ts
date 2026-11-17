import { z } from "zod";
import { isValidDocument } from "./documents";
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
export const methodField = z.enum(["Pix", "Boleto", "Cartão de crédito", "Transferência"]);

export const clientSchema = z.object({
  kind: z.enum(["pf", "pj"]),
  name: z.string().trim().min(2).max(160),
  document: z.string().trim().min(11).max(18),
  email: z.string().trim().max(160).refine((value) => value === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), "Informe um e-mail."),
  phone: z.string().trim().min(8).max(20),
  whatsapp: z.string().trim().max(20),
  zip: z.string().trim().max(12),
  state: z.string().trim().max(2),
  city: z.string().trim().max(80),
  district: z.string().trim().max(80),
  street: z.string().trim().max(120),
  number: z.string().trim().max(20),
  complement: z.string().trim().max(80),
  notes: z.string().trim().max(2000),
}).superRefine((value, context) => {
  if (!isValidDocument(value.document, value.kind)) {
    context.addIssue({ code: "custom", path: ["document"], message: value.kind === "pj" ? "CNPJ inválido." : "CPF inválido." });
  }
});

export const catalogSchema = z.object({
  kind: z.enum(["produto", "servico"]),
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000),
  category: z.string().trim().min(2).max(80),
  sku: z.string().trim().max(40),
  price: moneyField,
  billing: z.enum(["pontual", "recorrente"]),
  stock: z.string().trim().max(8),
});

export const saleItemSchema = z.object({
  catalogItemId: z.string().uuid().nullable(),
  description: z.string().trim().min(2).max(180),
  kind: z.enum(["produto", "servico"]),
  quantity: z.number().int().min(1).max(999),
  unitCents: z.number().int().positive(),
});

export const saleSchema = z.object({
  clientId: z.string().uuid(),
  soldOn: dateField,
  discount: moneyField,
  notes: z.string().trim().max(2000),
  mode: z.enum(["avista", "parcelado", "recorrente"]),
  entry: moneyField,
  installmentCount: z.number().int().min(1).max(MAX_INSTALLMENTS),
  firstDue: dateField,
  periodicity: periodicityField,
  interestMonthlyBp: z.number().int().min(0).max(MAX_FINANCE_INTEREST_BP).default(0),
  adjustYearlyBp: z.number().int().min(0).max(MAX_ADJUST_BP).default(0),
  method: methodField,
  makeContract: z.boolean(),
  items: z.array(saleItemSchema).min(1),
});

export const paymentSchema = z.object({
  chargeId: z.string().uuid(),
  amount: moneyField,
  fee: z.string().trim().default("0"),
  paidOn: dateField,
  method: methodField,
  note: z.string().trim().max(500),
  idempotencyKey: z.string().trim().min(8).max(100),
});

export const contactSchema = z.object({
  clientId: z.string().uuid(),
  chargeId: z.string().uuid().nullable(),
  channel: z.enum(["WhatsApp", "Ligação", "E-mail"]),
  summary: z.string().trim().min(3).max(2000),
  promiseOn: dateField.or(z.literal("")),
});

export const dueSchema = z.object({
  chargeId: z.string().uuid(),
  dueOn: dateField,
});
