export const DEFAULT_COMPANY_NAME = "Minha empresa";

export type Step = { key: string; label: string; href: string; done: boolean };

export function onboardingSteps(facts: { tradeName: string; pixKey: string; products: number; sales: number }): Step[] {
  return [
    { key: "empresa", label: "Preencher os dados da sua empresa", href: "/configuracoes", done: facts.tradeName.trim() !== "" && facts.tradeName !== DEFAULT_COMPANY_NAME },
    { key: "produto", label: "Cadastrar um produto ou serviço", href: "/produtos", done: facts.products > 0 },
    { key: "venda", label: "Fazer a primeira venda", href: "/vendas/nova", done: facts.sales > 0 },
    { key: "recebimentos", label: "Dizer como seus clientes pagam (chave Pix)", href: "/recebimentos", done: facts.pixKey.trim() !== "" },
  ];
}

export function allDone(steps: Step[]) {
  return steps.every((step) => step.done);
}
