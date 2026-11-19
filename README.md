# RecebeFácil

Gestão de vendas, parcelas e recebimentos. Cada lojista escolhe como recebe: no modo Gestão ele mesmo marca "Recebi", e no modo Integrado o cliente paga por Pix, boleto ou cartão pelo Asaas e a baixa é automática. Os dados de demonstração são fictícios.

## Requisitos

Node 22 e um Postgres quando `DATABASE_URL` existir. Sem essa variável, o app grava em PGlite na pasta `data/recebefacil`.

## Instalação

```bash
npm install --legacy-peer-deps
npm test
npm run dev
```

Abra `http://127.0.0.1:3000`.

## Produção

```bash
npm run build
npm start
```

`DATABASE_URL` aponta para o Postgres. O arquivo `cursor-app.json` pede esse banco na publicação.

## Variáveis

`DATABASE_URL` é opcional no desenvolvimento.

`RECEBEFACIL_SECRET` (mínimo de 32 caracteres) assina os links de pagamento e cifra as credenciais do Asaas guardadas no banco. Em produção ela é obrigatória. Trocá-la invalida os links já enviados e torna ilegíveis a chave e o token salvos, que o dono precisa informar de novo. No desenvolvimento, sem a variável, um segredo é gerado e guardado em `.secret` na pasta de dados.

`PLATFORM_OWNER_EMAILS` lista, separados por vírgula, os e-mails que podem abrir a página Plataforma (sem diferenciar maiúsculas). Só vale para identidade verificada. No desenvolvimento local, o visitante simulado também é dono. Em produção nunca é, e a demonstração pública nunca é.

`NEXT_PUBLIC_SITE_URL` é o endereço público do app, por exemplo `https://recebefacil.com.br`. Com ela, as prévias de link (Open Graph) usam endereço absoluto e o `robots.txt` aponta para o `sitemap.xml`. Sem ela, o sitemap sai vazio.

Na demonstração pública (visitante sem login), dados da empresa, equipe, assinatura, nota fiscal, mensagens e suporte ficam desligados, e o link de pagamento avisa que é demonstração.

Chave de API e token do Asaas não vão em variável de ambiente, nem no código, nem em arquivo. Elas são digitadas na página Plataforma e ficam cifradas no banco.

## Asaas

### Como o dinheiro anda

A cobrança é criada na conta Asaas da plataforma. Um split manda para a carteira do lojista tudo menos a taxa da plataforma (padrão 1,5%), e a taxa é o que fica na conta da plataforma. O lojista não entrega a chave dele: cola uma vez, o app descobre a carteira e descarta a chave. O cartão é digitado no site do Asaas, nunca aqui. Dinheiro é inteiro em centavos por dentro e só vira reais na chamada ao Asaas.

### Configuração pelo dono da plataforma

1. Defina `RECEBEFACIL_SECRET` e `PLATFORM_OWNER_EMAILS` e publique.
2. Entre com um e-mail da lista, abra Mais e depois Plataforma.
3. Comece pelo ambiente Sandbox. Crie uma conta em `https://sandbox.asaas.com`, gere uma chave de API e cole no campo Chave de API. A chave de Sandbox tem `_hmlg_` e a de Produção tem `_prod_`. O app recusa salvar uma chave no ambiente errado.
4. Clique em Gerar token, copie o token que aparece (ele só aparece uma vez) e salve.
5. Ao salvar, o app consulta a conta no Asaas, guarda a carteira da plataforma e mostra o nome da conta e o ambiente. Se o Asaas recusar, a configuração fica salva e o motivo aparece em Testar a conexão. O botão Testar conexão confere de novo. Os lojistas só veem o modo Integrado quando chave, token e carteira estão prontos.
6. No Asaas, abra Configurações da conta, Integrações, Webhooks e crie um webhook de cobranças e assinaturas. Use o endereço mostrado na página (`<seu domínio>/api/webhooks/asaas`), o token do passo 4, fila sequencial, e ative os eventos listados na página (veja a lista completa em Planos e assinatura abaixo).
7. Para ir à produção, troque o ambiente, cole a chave de produção, gere um novo token, salve e atualize o webhook no Asaas de produção. Trocar de ambiente solta as cobranças ainda abertas, os clientes do Asaas e as contas ligadas pelos lojistas, que precisam conectar de novo com chave de produção.

**Lista de IPs autorizados.** Se a conta Asaas tiver essa lista ligada, todo pedido que sai de um IP fora dela volta com `not_allowed_ip`, e o app mostra "IP deste servidor não está na lista de IPs autorizados". No Asaas, abra Integrações, Mecanismos de segurança, Lista de IPs autorizados e adicione o IP público de saída do servidor. Em produção o servidor precisa de IP de saída fixo. Na máquina local, o IP é o da sua internet e muda quando o provedor quiser. O mesmo vale para a conta própria que um lojista conecta: se ela tiver a lista ligada, o IP do servidor precisa estar lá também.

A taxa (0% a 20%) e os preços dos planos também ficam nessa página, junto com a lista de assinantes (empresa, plano, situação e próximo vencimento).

### Planos e assinatura

O RecebeFácil cobra uma mensalidade de cada lojista, pela mesma conta Asaas da plataforma.

| Plano | O que é | Preço |
| --- | --- | --- |
| Gestão | O lojista recebe do jeito dele e marca Recebi. Só a mensalidade. | `plan_gestao_cents` |
| Integrado | O cliente paga por Pix, boleto ou cartão e a baixa é automática. Mensalidade mais a taxa da plataforma por pagamento recebido pelo sistema. | `plan_integrado_cents` mais `platform_fee_bp` |

Os preços e a taxa são editados em Mais, Plataforma. A página pública `/planos` (sem login) mostra os dois planos com esses valores, e o botão Contratar leva a `/assinatura?plano=gestao` ou `/assinatura?plano=integrado`.

**Teste grátis.** Toda empresa nova ganha 14 dias de teste, com tudo liberado, criado junto com a empresa. A demonstração pública não tem plano. Empresas criadas antes dos planos ganham o teste na migração.

**Contratar.** O lojista informa o CPF ou CNPJ da empresa (se faltar) e confirma. O app cria o cliente no Asaas (`organizations.asaas_customer_id`) e uma assinatura mensal na conta da plataforma (`POST /subscriptions`, `billingType` `UNDEFINED`, `externalReference` `sub:<id da empresa>`), e leva o lojista à fatura do Asaas, onde ele escolhe Pix, boleto ou cartão. Trocar de plano muda o valor da mesma assinatura. Cancelar apaga a assinatura no Asaas, e o acesso segue até o fim do período pago.

**Situações.** `teste`, `aguardando_pagamento`, `ativa`, `inadimplente` e `cancelada`, lidas por `accessFor` junto com a data de hoje. Sem plano ativo, o teste vencido, a mensalidade em atraso depois do período pago e o plano cancelado depois do período bloqueiam só a criação de venda e de cobrança nova (aparece um aviso no topo com o botão Ver planos). Ver tudo, dar baixa, desfazer, recibos, links já enviados e o webhook continuam funcionando: o dinheiro do lojista nunca fica preso. O modo Integrado exige o plano Integrado em dia ou o teste ativo. Quem cai para Gestão mantém os links de pagamento já gerados, mas não gera novos pelo Asaas.

**Eventos do webhook** (o app só aceita estes, o resto é ignorado):

| Evento | Efeito na mensalidade |
| --- | --- |
| `PAYMENT_RECEIVED`, `PAYMENT_CONFIRMED` | Fatura paga, plano `ativa`, fim do período no vencimento mais um mês |
| `PAYMENT_OVERDUE` | Plano `inadimplente` |
| `PAYMENT_REFUNDED`, `PAYMENT_CHARGEBACK_REQUESTED`, `PAYMENT_CHARGEBACK_DISPUTE`, `PAYMENT_AWAITING_CHARGEBACK_REVERSAL`, `PAYMENT_RECEIVED_IN_CASH_UNDONE` | Fatura estornada, e `inadimplente` se nenhum outro período pago cobrir hoje |
| `PAYMENT_DELETED` | Fatura em aberto marcada como cancelada |
| `SUBSCRIPTION_DELETED`, `SUBSCRIPTION_INACTIVATED` | Plano `cancelada`, com acesso até o fim do período pago |

Os mesmos eventos de `PAYMENT_*` já servem às cobranças dos lojistas. O prefixo `sub:` do `externalReference` separa as duas coisas. O corpo do evento só aponta a empresa: o que foi pago é sempre lido de novo no Asaas, e cada evento é gravado junto com o seu efeito, então repetições não contam duas vezes. Abrir Plano depois de pagar também confere as faturas no Asaas, o que cobre um webhook perdido.

### Conciliação

O webhook baixa as cobranças na hora. Para cobrir webhook perdido, `POST /api/cron/asaas` relê no Asaas as cobranças vivas e abertas sem conferência há mais de uma hora e baixa as que já foram pagas. A rota exige o cabeçalho `x-cron-secret`, que é um HMAC-SHA256 do `RECEBEFACIL_SECRET`. Para calcular o valor:

```bash
node -e "console.log(require('node:crypto').createHmac('sha256', process.env.RECEBEFACIL_SECRET).update('cron:asaas').digest('hex'))"
```

Agende uma chamada por hora (cron do servidor, GitHub Actions ou o agendador da hospedagem):

```bash
curl -X POST https://seu-dominio/api/cron/asaas -H "x-cron-secret: <valor calculado>"
```

Abrir a tela A receber também confere o Asaas em segundo plano, no máximo uma vez a cada 10 minutos por empresa.

### Segurança

O webhook confere o token em tempo constante antes de ler o corpo, aceita até 512 KB, grava o evento junto com o efeito dele numa transação e responde 503 quando falha, para o Asaas reenviar. O corpo do evento nunca decide o que foi pago: a cobrança é lida de novo no Asaas. Mensagens de erro do Asaas passam por limpeza e nunca repetem a chave.
