export const roles = ["administrador", "financeiro", "vendedor", "operador"] as const;
export type Role = (typeof roles)[number];

export const permissions = [
  "clientes.gravar",
  "catalogo.gravar",
  "vendas.criar",
  "vendas.cancelar",
  "vendas.editar",
  "vendas.excluir",
  "pagamentos.registrar",
  "pagamentos.estornar",
  "contratos.alterar",
  "recorrencias.alterar",
  "equipe.convidar",
  "empresa.gravar",
  "assinatura.gerir",
  "fiscal.emitir",
  "estoque.ajustar",
  "mensagens.enviar",
  "cobrancas.contatar",
  "cobrancas.gravar",
  "suporte.abrir",
  "relatorios.ler",
  "demo.resetar",
] as const;

export type Permission = (typeof permissions)[number];

const grants: Record<Role, readonly Permission[] | "*"> = {
  administrador: "*",
  financeiro: ["pagamentos.registrar", "pagamentos.estornar", "relatorios.ler", "fiscal.emitir", "contratos.alterar", "recorrencias.alterar", "suporte.abrir", "assinatura.gerir", "cobrancas.contatar", "cobrancas.gravar"],
  vendedor: ["clientes.gravar", "vendas.criar", "vendas.cancelar", "vendas.editar", "vendas.excluir", "catalogo.gravar", "mensagens.enviar", "suporte.abrir", "estoque.ajustar", "cobrancas.contatar"],
  operador: ["pagamentos.registrar", "mensagens.enviar", "suporte.abrir", "relatorios.ler", "cobrancas.contatar"],
};

export function isRole(value: string): value is Role {
  return (roles as readonly string[]).includes(value);
}

export function can(role: Role, permission: Permission) {
  const allowed = grants[role];
  return allowed === "*" || allowed.includes(permission);
}

export function roleLabel(role: Role) {
  if (role === "administrador") return "Administrador";
  if (role === "financeiro") return "Financeiro";
  if (role === "vendedor") return "Vendedor";
  return "Operador";
}
