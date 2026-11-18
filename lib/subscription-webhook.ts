import type { PaymentRoute } from "./asaas-webhook";
import { applyPayment, closeSubscription, forgetInvoice, subscriptionReference } from "./subscription";

const PREFIX = subscriptionReference("");

// As faturas e a assinatura do lojista na plataforma. O corpo do evento só aponta a empresa: o que foi pago vem da leitura no Asaas.
export const subscriptionRoute: PaymentRoute = {
  prefix: PREFIX,
  async handle(context) {
    if (context.kind === "subscription") {
      await closeSubscription(context.db, context.subscriptionId, context.remote);
      return;
    }
    if (context.effect === "forget") {
      await forgetInvoice(context.db, context.paymentId);
      return;
    }
    const { remote } = context;
    if (!remote?.externalReference?.startsWith(PREFIX)) return;
    await applyPayment(context.db, remote.externalReference.slice(PREFIX.length), remote, context.now);
  },
};
