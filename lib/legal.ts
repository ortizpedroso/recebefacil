// Roteiro do "Guia de Elaboração de Termo de Uso e Política de Privacidade" do Governo Digital (gov.br)
// e dos arts. 7, 9, 18 e 41 da LGPD (Lei 13.709/2018). Mudou o texto, mude a data de vigência.

export type LegalSection = { title: string; paragraphs: string[]; items?: string[] };
export type LegalDocument = { title: string; hint: string; updatedOn: string; sections: LegalSection[] };

const CONTACT = "suporte@recebefacil.app";

export const TERMS: LegalDocument = {
  title: "Termos de uso",
  hint: "As regras para usar o RecebeFácil.",
  updatedOn: "18/11/2026",
  sections: [
    {
      title: "1. Aceitação",
      paragraphs: [
        "Ao criar uma conta ou usar o RecebeFácil, você concorda com estes Termos de uso e com a Política de privacidade. Se não concordar, não use o serviço.",
        "Quem aceita em nome de uma empresa declara que tem poderes para isso.",
      ],
    },
    {
      title: "2. Definições",
      paragraphs: [],
      items: [
        "Plataforma: o RecebeFácil, software de gestão de vendas, cobranças e recebimentos.",
        "Lojista: a empresa ou pessoa que contrata a plataforma para organizar as próprias vendas.",
        "Cliente final: quem compra do lojista e recebe o link de pagamento.",
        "Asaas: a instituição de pagamento parceira (Asaas Gestão Financeira S.A.), que processa Pix, boleto e cartão e mantém as contas de pagamento.",
        "Subconta: a conta de pagamento do lojista aberta no Asaas pela plataforma.",
      ],
    },
    {
      title: "3. Leis aplicáveis",
      paragraphs: [
        "Estes termos seguem a legislação brasileira, em especial o Código Civil, o Código de Defesa do Consumidor (Lei 8.078/1990) quando houver relação de consumo, o Marco Civil da Internet (Lei 12.965/2014) e a Lei Geral de Proteção de Dados (Lei 13.709/2018).",
      ],
    },
    {
      title: "4. O que o serviço faz",
      paragraphs: [
        "O RecebeFácil organiza clientes, produtos, vendas à vista, parceladas e por mensalidade, contratos, recibos e a lista do que falta receber. O plano Gestão serve para quem recebe por conta própria e marca o recebimento à mão.",
        "No plano Integrado, o cliente final paga por Pix, boleto ou cartão pelo Asaas e a baixa é automática. O dinheiro cai na subconta do lojista. A plataforma não guarda saldo, não é banco e não é instituição de pagamento.",
        "A nota emitida na plataforma é um documento interno do lojista e não é transmitida à Secretaria da Fazenda nesta versão.",
      ],
    },
    {
      title: "5. Planos, taxas e pagamentos",
      paragraphs: [
        "O lojista paga a mensalidade do plano escolhido, cobrada pelo Asaas. Os primeiros 14 dias são grátis. Sem pagamento, a criação de vendas novas fica bloqueada, mas o acesso ao que já foi registrado continua.",
        "Quem recebe pela plataforma paga as taxas do Asaas de cada cobrança, saque e antecipação, mais a taxa da plataforma sobre cada pagamento recebido. Todas as taxas aparecem na aba Saque e taxas antes de qualquer cobrança.",
        "A abertura da subconta e cada saque dependem da análise e das regras do Asaas, que podem pedir documentos ou recusar a conta.",
      ],
    },
    {
      title: "6. Direitos de quem usa",
      paragraphs: [],
      items: [
        "Usar o serviço contratado durante o período pago.",
        "Ver, a qualquer momento, todas as taxas cobradas.",
        "Exportar seus relatórios e pedir a exclusão da conta.",
        "Ter seus dados pessoais tratados conforme a Política de privacidade.",
      ],
    },
    {
      title: "7. Responsabilidades de quem usa",
      paragraphs: [],
      items: [
        "Cadastrar dados verdadeiros e manter a conta segura.",
        "Ter base legal para cadastrar os dados dos próprios clientes e cobrá-los. Para esses dados, o lojista é o controlador e a plataforma atua como operadora.",
        "Não usar o serviço para vendas ilícitas, cobranças indevidas ou envio de mensagens não autorizadas.",
        "Cumprir as obrigações fiscais da própria empresa.",
      ],
    },
    {
      title: "8. Responsabilidades da plataforma",
      paragraphs: [],
      items: [
        "Manter o serviço funcionando e proteger os dados com medidas técnicas adequadas, como criptografia de credenciais e separação dos dados por empresa.",
        "Avisar sobre mudanças relevantes nestes termos e nas taxas com antecedência.",
        "A plataforma não responde por falhas do Asaas, de bancos ou da internet, nem por decisões comerciais do lojista.",
      ],
    },
    {
      title: "9. Mudanças nestes termos",
      paragraphs: [
        "Os termos podem mudar. A data de vigência no topo indica a versão atual. Mudanças em taxas valem só depois do aviso na plataforma.",
      ],
    },
    {
      title: "10. Contato",
      paragraphs: [`Dúvidas, pedidos e reclamações: ${CONTACT} ou pela aba Ajuda.`],
    },
    {
      title: "11. Foro",
      paragraphs: [
        "Fica eleito o foro do domicílio do lojista para resolver qualquer questão sobre estes termos, salvo regra legal diferente.",
      ],
    },
  ],
};

export const PRIVACY: LegalDocument = {
  title: "Política de privacidade",
  hint: "Quais dados tratamos, por quê e como você exerce seus direitos.",
  updatedOn: "18/11/2026",
  sections: [
    {
      title: "1. Quem trata os dados",
      paragraphs: [
        "Para os dados da conta do lojista (nome, e-mail, documento, equipe e assinatura), o RecebeFácil é o controlador.",
        "Para os dados dos clientes finais que o lojista cadastra, o lojista é o controlador e o RecebeFácil é o operador: tratamos esses dados só para prestar o serviço ao lojista e conforme as instruções dele.",
      ],
    },
    {
      title: "2. Dados que tratamos",
      paragraphs: [],
      items: [
        "Conta e equipe: nome, e-mail e papel de cada pessoa.",
        "Empresa: razão social, nome fantasia, CPF ou CNPJ, telefone, endereço, chave Pix e instruções de pagamento.",
        "Subconta Asaas: dados pedidos pelo Asaas para abrir a conta, como data de nascimento, faturamento mensal, telefone e endereço.",
        "Clientes finais: nome, CPF ou CNPJ, telefone, e-mail, endereço, vendas, parcelas e pagamentos.",
        "Uso técnico: mensagens de erro e chamados de suporte.",
      ],
    },
    {
      title: "3. Para que usamos e com qual base legal",
      paragraphs: [],
      items: [
        "Prestar o serviço contratado, gerar cobranças, recibos e contratos (execução de contrato, art. 7º, V, da LGPD).",
        "Abrir a subconta, processar pagamentos, saques e prevenir fraude junto ao Asaas (execução de contrato e cumprimento de obrigação legal ou regulatória, art. 7º, II e V).",
        "Guardar registros de acesso e de pagamentos pelo prazo da lei (obrigação legal, art. 7º, II, e Marco Civil da Internet).",
        "Melhorar o serviço e corrigir erros (legítimo interesse, art. 7º, IX).",
      ],
    },
    {
      title: "4. Com quem compartilhamos",
      paragraphs: [],
      items: [
        "Asaas, para cobranças, subcontas, saques e antecipações.",
        "O provedor de hospedagem e banco de dados que mantém a plataforma no ar.",
        "Autoridades públicas, quando a lei ou uma ordem judicial exigir.",
      ],
    },
    {
      title: "5. Por quanto tempo guardamos",
      paragraphs: [
        "Os dados ficam guardados enquanto a conta estiver ativa. Depois do encerramento, mantemos só o que a lei obriga, como registros fiscais e de pagamento, pelo prazo legal, e apagamos o resto.",
      ],
    },
    {
      title: "6. Como protegemos",
      paragraphs: [
        "Cada empresa vê só os próprios dados. Chaves e tokens do Asaas ficam cifrados no banco. Os links de pagamento são assinados e não revelam o cadastro. Os dados de cartão são digitados no ambiente do Asaas e nunca passam pelo RecebeFácil.",
      ],
    },
    {
      title: "7. Seus direitos (art. 18 da LGPD)",
      paragraphs: ["Você pode pedir, sem custo:"],
      items: [
        "Confirmação de que tratamos seus dados e acesso a eles.",
        "Correção de dados incompletos, inexatos ou desatualizados.",
        "Anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desacordo com a lei.",
        "Portabilidade dos dados a outro fornecedor.",
        "Informação sobre com quem compartilhamos seus dados.",
        "Revogação do consentimento, quando ele for a base legal.",
        "Reclamação à Autoridade Nacional de Proteção de Dados (ANPD).",
      ],
    },
    {
      title: "8. Clientes finais",
      paragraphs: [
        "Se você é cliente de um lojista e quer exercer seus direitos, fale primeiro com o lojista, que é o controlador. Também pode escrever para nós e encaminharemos o pedido.",
      ],
    },
    {
      title: "9. Cookies",
      paragraphs: [
        "Usamos só cookies necessários para manter a sessão e a segurança. Não usamos cookies de publicidade.",
      ],
    },
    {
      title: "10. Encarregado (art. 41 da LGPD)",
      paragraphs: [`O canal do encarregado pelo tratamento de dados pessoais é ${CONTACT}. Respondemos em até 15 dias.`],
    },
    {
      title: "11. Mudanças nesta política",
      paragraphs: ["Esta política pode mudar. A data de vigência no topo indica a versão atual, e mudanças relevantes são avisadas na plataforma."],
    },
  ],
};
