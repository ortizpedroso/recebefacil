import { formatDateBR } from "./dates";
import { cents, formatBRL } from "./money";

export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || "tudo bem";
}

export type CollectionFacts = {
  clientName: string;
  company: string;
  title: string;
  dueOn: string;
  openCents: number;
  late: number;
  link: string;
};

export function collectionMessage(facts: CollectionFacts): string {
  const amount = formatBRL(cents(facts.openCents));
  const hello = `Olá, ${firstName(facts.clientName)}! Aqui é da ${facts.company}.`;
  if (facts.late > 0) {
    return `${hello} Seu pagamento (${facts.title}) de ${amount} venceu em ${formatDateBR(facts.dueOn)} e ainda está em aberto. Pague por este link: ${facts.link}`;
  }
  return `${hello} Segue o link do seu pagamento (${facts.title}) de ${amount}, com vencimento em ${formatDateBR(facts.dueOn)}: ${facts.link}`;
}
