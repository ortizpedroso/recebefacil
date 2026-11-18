# Documento de Requisitos do Produto (PRD): RecebeFácil

Versão: 1.0 (estado atual do repositório, branch `main`, commit `82a7c88`)

Este documento descreve o sistema como ele é hoje. Nenhuma informação foi alterada. Ele segue a estrutura do PRD do NoCode Folio, adaptada à realidade do RecebeFácil. As escolhas do modelo (int8, JSONB, Supabase, RLS) não se aplicam aqui. O RecebeFácil usa UUIDs em texto, valores em centavos inteiros, Postgres ou PGlite, Drizzle ORM e autorização por papéis na aplicação.

---

## 1. Visão Geral (Overview)

O RecebeFácil é uma aplicação web de gestão de vendas, parcelas e recebimentos, multi-inquilino, com integração demonstrativa ao Asaas (README.md:1). Os valores de demonstração são fictícios e o Asaas não cobra de verdade (README.md:3).

Cada usuário é mapeado para uma organização (`organizations`). Os dados de todas as tabelas de negócio carregam a coluna `organization_id`, que isola um inquilino do outro (lib/schema.ts). Sem a variável `DATABASE_URL`, o app grava em PGlite na pasta `data/recebefacil`; com ela, usa Postgres (README.md:7, lib/db.ts:32).

O sistema cobre o ciclo completo: catálogo de produtos e serviços, vendas à vista, parceladas e recorrentes, contratos, parcelas, cobranças, recebimentos, inadimplência, notas fiscais, estoque, mensagens em massa, assinatura da plataforma e relatórios.

## 2. Metas do Projeto

O sistema entrega estas capacidades. Cada uma tem a fonte no código.

- Vendas em três modos: `avista`, `parcelado` e `recorrente` (lib/schemas.ts:67). A venda gera parcelas, cobranças, contrato e baixa de estoque em uma transação (lib/ledger.ts:66).
- Parcelas e recebimentos: cada parcela vira uma cobrança; o pagamento atualiza cobrança, parcela e o status da venda (lib/ledger.ts:167, lib/ledger.ts:253).
- Métodos de cobrança: Pix, Boleto, Cartão de crédito e Transferência (lib/schemas.ts:20).
- Contratos opcionais: criados quando a venda é parcelada, recorrente ou pede contrato explícito (lib/ledger.ts:131).
- Recorrências: cobranças periódicas geradas automaticamente até a data atual (lib/ledger.ts:376).
- Catálogo com estoque: produtos controlam quantidade, serviços não (lib/tenant.ts:103, lib/actions.ts:27).
- Notas fiscais demonstrativas com chave de acesso e numeração sequencial (lib/actions.ts:354).
- Inadimplência: cálculo de dias de atraso, faixa de atraso e histórico de contatos (lib/read.ts:173, lib/dates.ts:39).
- Mensagens em massa por WhatsApp com interpolação de `{nome}` (lib/actions.ts:417).
- Autorização por papéis com 4 papéis e 21 permissões (lib/access.ts).
- Assinatura da plataforma com 3 planos e faturamento próprio (lib/billing.ts).
- Painel com indicadores, gráfico mensal e próximos vencimentos (lib/read.ts:110).
- Ambiente demonstrativo com dados fictícios e botão de reset (lib/tenant.ts:133, lib/actions.ts:271).

### Regras de negócio centrais

- O desconto não pode zerar a venda; a entrada não pode passar do total; uma entrada que quita a venda deve usar o modo à vista (lib/ledger.ts:78, lib/ledger.ts:81, lib/ledger.ts:82).
- O saldo parcelado é dividido entre as parcelas e o centavo restante fica na primeira parcela (lib/money.ts:32).
- A soma das parcelas precisa fechar o total da venda (lib/ledger.ts:240).
- Um pagamento não pode passar do saldo aberto da cobrança (lib/ledger.ts:277).
- Pagamentos aceitam chave de idempotência; a mesma chave com outro valor é rejeitada (lib/ledger.ts:260).
- Para cancelar uma venda é preciso estornar os recebimentos antes (lib/ledger.ts:365).
- Parcela paga ou cancelada não muda de vencimento (lib/ledger.ts:337).
- A troca de papel nunca deixa a empresa sem administrador (lib/actions.ts:320).

## 3. Stack Tecnológica

- Frontend: Next.js 16 (App Router), React 19, TypeScript (package.json:6).
- Estilo: Tailwind CSS 4, shadcn/ui (Radix UI), `class-variance-authority`, `clsx`, `tailwind-merge` (package.json).
- Formulários e validação: react-hook-form + zod (package.json:24, lib/schemas.ts).
- Gráficos: recharts (package.json:27).
- Ícones: lucide-react (package.json:21).
- Banco de dados: Drizzle ORM sobre Postgres (`pg`) ou PGlite embutido (`@electric-sql/pglite`) (package.json:13, lib/db.ts).
- Identidade: Cursor app identity v3, verifica token assinado no header `x-cursor-identity-v2` (cursor/identity.ts:1).
- Testes: `tsx --test lib/*.test.ts` (package.json:9).
- Verificação de tipos: `tsc --noEmit` (package.json:10).
- CI: GitHub Actions, Node 22, `npm ci --legacy-peer-deps`, teste, tipo e build (`.github/workflows/ci.yml`).
- Publicação: Cursor app com banco Postgres (`cursor-app.json`).

## 4. Estrutura de Páginas e Fluxo

O app usa o grupo de rota `(painel)`, que compartilha o layout `app/(painel)/layout.tsx`. Esse layout carrega a sessão, avança as recorrências, monta o índice de busca e os alertas, e renderiza o `Shell` (app/(painel)/layout.tsx:10).

### Navegação principal

O menu está em `components/shell.tsx:33` (seção principal) e `components/shell.tsx:48` (rodapé).

- `/` Visão geral: painel com indicadores, gráfico mensal e próximos vencimentos (app/(painel)/page.tsx).
- `/clientes` Clientes: listagem e cadastro (app/(painel)/clientes/page.tsx).
- `/clientes/[id]` Detalhe do cliente: finanças do cliente (app/(painel)/clientes/[id]/page.tsx).
- `/produtos` Produtos e serviços: catálogo com estoque (app/(painel)/produtos/page.tsx).
- `/vendas` Vendas: listagem (app/(painel)/vendas/page.tsx).
- `/vendas/nova` Nova venda: assistente de venda (app/(painel)/vendas/nova/page.tsx).
- `/contratos` Contratos (app/(painel)/contratos/page.tsx).
- `/parcelas` Parcelas: paginação e alteração de vencimento (app/(painel)/parcelas/page.tsx).
- `/recorrencias` Recorrências (app/(painel)/recorrencias/page.tsx).
- `/cobrancas` Cobranças e recebimentos: lançamento e estorno (app/(painel)/cobrancas/page.tsx).
- `/inadimplencia` Inadimplência: cobranças vencidas e registro de contato (app/(painel)/inadimplencia/page.tsx).
- `/relatorios` Relatórios: filtros por período, cliente e status, com download CSV/PDF (app/(painel)/relatorios/page.tsx).
- `/fiscal` Notas fiscais: emissão e cancelamento internos, sem transmissão para a SEFAZ (app/(painel)/fiscal/page.tsx).
- `/mensagens` Mensagens: campanhas em massa enfileiradas (app/(painel)/mensagens/page.tsx).
- `/integracoes` Integrações: conexão demonstrativa do Asaas com ambientes Demo, Sandbox e Produção (app/(painel)/integracoes/page.tsx).
- `/assinatura` Assinatura: planos e faturas da plataforma (app/(painel)/assinatura/page.tsx).
- `/configuracoes` Configurações: empresa e equipe (app/(painel)/configuracoes/page.tsx).
- `/ajuda` Ajuda e suporte: abertura de chamado (app/(painel)/ajuda/page.tsx).
- `/busca` Busca: pesquisa de clientes por nome ou documento (app/(painel)/busca/page.tsx).
- `/termos`, `/privacidade` Páginas legais (app/(painel)/termos/page.tsx, app/(painel)/privacidade/page.tsx).

### Rotas de API

- `app/api/relatorios/route.ts` Relatórios em CSV ou PDF, a partir dos filtros de período, cliente e status (app/api/relatorios/route.ts:17).
- `app/api/erros/route.ts` Recebe erros do `app/error.tsx` e os registra em `error_events` com escopo `tela` (app/api/erros/route.ts:5).
- `app/health/route.ts` Health check que executa `select 1` (app/health/route.ts:4).

### Fluxos principais

- Nova venda: o usuário preenche o assistente (`components/sale-wizard.tsx`), que chama `createSaleAction`. A ação valida com `saleSchema` e delega para `createSale` (app/actions.ts:98). A venda cria parcelas, cobranças, contrato e baixa de estoque (lib/ledger.ts:84).
- Recebimento: em `/cobrancas` o usuário lança um pagamento via `payAction`, que chama `registerPayment` (app/actions.ts:125). O pagamento atualiza cobrança, parcela e status da venda (lib/ledger.ts:291).
- Inadimplência: `delinquency` cruza cobranças vencidas com dias de atraso e último contato (lib/read.ts:173). O usuário registra contato via `contactAction` (app/actions.ts:198).
- Asaas: `asaasAction` apenas marca a organização como conectada ou altera o ambiente visual, sem guardar chave nem enviar cobrança (app/actions.ts:224).
- Relatórios: filtros de período, cliente e status geram download em CSV ou PDF via `/api/relatorios` (app/(painel)/relatorios/page.tsx:45).
- Fiscal: emissão e cancelamento de notas são internos e não transmitem para a SEFAZ (app/(painel)/fiscal/page.tsx:13).
- Mensagens: a campanha é enfileirada em `campaigns` e `campaign_recipients`; não há provedor que envie de fato (app/actions.ts:427).

## 5. Modelo de Dados (Schema do Banco)

O schema é declarado em `lib/schema.ts` (Drizzle) e o DDL em `lib/sql.ts`. As migrações rodam a partir do SQL na inicialização (lib/db.ts:14).

### Convenções

- Chave primária: `id` em `text`, um UUID gerado na aplicação com `randomUUID` ou `crypto.randomUUID` (lib/tenant.ts:51, lib/actions.ts:204). Não é int8.
- Chave estrangeira: `text` apontando para o `id` de outra tabela. O DDL declara `references` (lib/sql.ts). O schema Drizzle não declara relações.
- Dinheiro: inteiro em centavos, em colunas `*_cents` (lib/money.ts:3).
- Datas: texto no formato ISO `YYYY-MM-DD`. Registros de criação usam `new Date().toISOString()`.
- Status e enums: `text`, validados pela aplicação, não pelo banco.
- Multi-inquilino: toda tabela de negócio tem `organization_id`.

### Tabelas

**organizations**. O inquilino. `id`, `viewer_key` (única), `trade_name`, `legal_name`, `document`, `email`, `phone`, `address`, `timezone`, `asaas_environment`, `asaas_connected`, `asaas_synced_at`, `created_at` (lib/schema.ts:3).

**members**. A equipe e os papéis. `id`, `organization_id`, `name`, `email`, `role`, `active` (lib/schema.ts:23).

**clients**. Clientes. `id`, `organization_id`, `kind` (`pf`|`pj`), `name`, `document`, `email`, `phone`, `whatsapp`, `zip`, `state`, `city`, `district`, `street`, `number`, `complement`, `notes`, `active`, `created_at` (lib/schema.ts:36).

**catalog_items**. Produtos e serviços. `id`, `organization_id`, `kind` (`produto`|`servico`), `name`, `description`, `category`, `sku`, `price_cents`, `billing` (`pontual`|`recorrente`), `stock_quantity`, `active` (lib/schema.ts:61).

**sales**. Vendas. `id`, `organization_id`, `code`, `client_id`, `sold_on`, `discount_cents`, `total_cents`, `notes`, `mode` (`avista`|`parcelado`|`recorrente`), `status`, `created_at` (lib/schema.ts:79).

**sale_items**. Itens da venda. `id`, `organization_id`, `sale_id`, `catalog_item_id`, `description`, `kind`, `quantity`, `unit_cents`, `total_cents` (lib/schema.ts:97).

**contracts**. Contratos. `id`, `organization_id`, `number`, `client_id`, `sale_id`, `description`, `total_cents`, `starts_on`, `ends_on`, `status`, `terms` (lib/schema.ts:113).

**installments**. Parcelas. `id`, `organization_id`, `sale_id`, `contract_id`, `client_id`, `number`, `count`, `label`, `due_on`, `amount_cents`, `paid_cents`, `status` (lib/schema.ts:131).

**recurrences**. Recorrências. `id`, `organization_id`, `client_id`, `catalog_item_id`, `description`, `amount_cents`, `periodicity`, `starts_on`, `next_on`, `ends_on`, `status` (lib/schema.ts:150).

**charges**. Cobranças. `id`, `organization_id`, `code`, `client_id`, `sale_id`, `contract_id`, `installment_id`, `recurrence_id`, `amount_cents`, `paid_cents`, `due_on`, `method`, `status`, `paid_on` (lib/schema.ts:168).

**payments**. Recebimentos. `id`, `organization_id`, `charge_id`, `installment_id`, `amount_cents`, `paid_on`, `method`, `note`, `idempotency_key`, `reversed_at` (lib/schema.ts:189).

**contacts**. Contatos de cobrança. `id`, `organization_id`, `client_id`, `charge_id`, `channel`, `summary`, `promise_on`, `created_at` (lib/schema.ts:206).

**due_changes**. Histórico de mudança de vencimento. `id`, `organization_id`, `installment_id`, `previous_due`, `next_due`, `created_at` (lib/schema.ts:221).

**integration_events**. Eventos de integração. `id`, `organization_id`, `happened_at`, `kind`, `status`, `description` (lib/schema.ts:230).

**subscriptions**. Assinatura da plataforma. `id`, `organization_id`, `plan_code`, `status`, `trial_ends_on`, `period_ends_on` (lib/schema.ts:239).

**platform_invoices**. Faturas da plataforma. `id`, `organization_id`, `subscription_id`, `amount_cents`, `status`, `due_on`, `paid_on` (lib/schema.ts:248).

**fiscal_documents**. Notas fiscais. `id`, `organization_id`, `sale_id`, `number`, `series`, `status`, `total_cents`, `access_key`, `issued_at` (lib/schema.ts:258).

**stock_moves**. Movimentos de estoque. `id`, `organization_id`, `catalog_item_id`, `sale_id`, `quantity`, `reason`, `created_at` (lib/schema.ts:270).

**campaigns**. Campanhas de mensagem. `id`, `organization_id`, `body`, `status`, `created_at` (lib/schema.ts:280).

**campaign_recipients**. Destinatários da campanha. `id`, `organization_id`, `campaign_id`, `client_id`, `phone`, `body`, `status` (lib/schema.ts:288).

**support_tickets**. Chamados de suporte. `id`, `organization_id`, `contact`, `message`, `created_at` (lib/schema.ts:298).

**error_events**. Erros registrados. `id`, `organization_id`, `scope`, `message`, `created_at` (lib/schema.ts:306).

### Restrições e índices

- `sales` exige `discount_cents >= 0` e `total_cents > 0` (lib/sql.ts:73).
- `sale_items` exige `quantity > 0` e `unit_cents > 0` (lib/sql.ts:87).
- `installments` e `charges` exigem `amount_cents > 0`, `paid_cents >= 0` e `paid_cents <= amount_cents` (lib/sql.ts:118, lib/sql.ts:152).
- `payments` exige `amount_cents > 0` e unicidade em `(organization_id, idempotency_key)` (lib/sql.ts:168, lib/sql.ts:170).
- `organizations.viewer_key` é única (lib/sql.ts:4).
- `catalog_items.stock_quantity` é adicionada por `alter table ... add column if not exists` (lib/sql.ts:199).

## 6. Segurança

A segurança é por autorização na aplicação, não por RLS do banco.

- Papéis: `administrador`, `financeiro`, `vendedor`, `operador` (lib/access.ts:1).
- Permissões: 21 verbos nomeados, de `clientes.gravar` a `demo.resetar` (lib/access.ts:4).
- Cada papel carrega um conjunto de permissões; o administrador tem todas (`*`) (lib/access.ts:27).
- A função `can(role, permission)` decide o acesso (lib/access.ts:38).
- Toda server action que escreve passa por `allow(permission)`, que recarrega a sessão e rejeita o papel sem a permissão (app/actions.ts:21).
- O papel do usuário é resolvido pelo e-mail na tabela `members`, com padrão `administrador` quando não há correspondência (lib/session.ts:33).
- A identidade vem do token assinado do Cursor no header `x-cursor-identity-v2`; localmente, sem `CURSOR_APP_ID` nem `VERCEL`, um viewer simulado é usado (cursor/identity.ts:137, cursor/identity.dev.ts:7).
- O isolamento entre inquilinos é por filtro de `organization_id` em toda consulta (lib/read.ts:24, lib/tenant.ts:83). A criação do inquilino usa `pg_advisory_xact_lock` sobre a `viewer_key` para evitar corrida (lib/tenant.ts:314).
- O modo demonstrativo usa a chave `public:demonstracao` quando não há identidade verificada (lib/session.ts:45).
- Nenhuma chave do Asaas é armazenada; a tela de integrações não lê segredo (README.md:30, app/actions.ts:228).

## 7. UI/UX Guidelines

O tema é claro, não o Dark/Neon do modelo NoCode Folio.

- Fundo da aplicação: `#f8fafc` (slate-50) no corpo e no painel; texto `#0f172a` (slate-900) (app/globals.css:3, components/shell.tsx:156).
- Cor primária: `teal-700` para botões e destaque de foco (components/ui.tsx:50, components/shell.tsx:100).
- Componentes base em `components/ui.tsx`: `Card` (fundo branco, borda `#E2E8F0`, `rounded-xl`, `shadow-sm`), `Status` (pílulas de status com tons emerald/red/amber/slate), `Table`, `Field`, `Title`, `Empty`.
- Biblioteca de UI: shadcn/ui, estilo `new-york`, base `slate`, sem CSS variables (components.json:3).
- Navegação: barra lateral fixa de 260px com menu principal e menu de rodapé, ícones lucide-react (components/shell.tsx:157, components/shell.tsx:33).
- Cabeçalho: breadcrumb, busca global (cliente, venda, cobrança), sino de alertas e menu de perfil (components/shell.tsx:165).
- Logo: quadrado `#0F766E` com check branco e o slogan "Venda. Receba. Acompanhe." (components/shell.tsx:293, app/layout.tsx:6).
- Status visuais usam as classes de `Status` para `paga`, `vencida`, `parcial`, `cancelada`, `estornada`, `ativo`, `suspensa` (components/ui.tsx:20).
- Fonte: a fonte padrão do navegador; o `layout` raiz não carrega fonte customizada (app/layout.tsx:9).

## 8. Instruções para o Desenvolvedor

- Dinheiro sempre em centavos inteiros (`Cents`). Nunca use `float`. Converta com `parseReais` e formate com `formatBRL` (lib/money.ts).
- Datas em texto ISO. Use os helpers de `lib/dates.ts` (`todayIn`, `addPeriod`, `shiftDays`, `daysLate`). Não concatene datas à mão.
- Toda consulta e escrita precisa filtrar `organization_id`. O padrão está em `lib/read.ts` e `lib/tenant.ts`.
- Server actions que escrevem precisam passar por `allow(permission)` antes de tocar o banco (app/actions.ts:21).
- Pagamentos devem aceitar chave de idempotência quando houver risco de reenvio (lib/ledger.ts:260).
- A divisão de parcelas coloca o centavo restante na primeira parcela (`splitBalance`, lib/money.ts:32).
- O status `vencida` é derivado na leitura por `displayStatus`, não gravado no banco (lib/read.ts:84).
- Recorrências são avançadas por `advanceRecurrences`, chamado no layout do painel, com guarda de 24 iterações (app/(painel)/layout.tsx:12, lib/ledger.ts:381).
- Cancelar venda exige estornar os recebimentos antes (lib/ledger.ts:365).
- O status da venda começa em `aguardando`, enquanto parcela e cobrança sem pagamento ficam `pendente`; são semânticas diferentes (lib/ledger.ts:52, lib/ledger.ts:59).
- O código de venda, cobrança e contrato usa o total de linhas (`length + 1`), não o maior código; remover linhas pode repetir um código (lib/ledger.ts:42).
- O estoque só baixa quando o item tem `catalogItemId`; `stock_quantity` nulo não controla estoque (lib/ledger.ts:112, lib/ledger.ts:117).
- Não coloque chave do Asaas no `.env`; a integração é apenas visual (README.md:30).
- Comandos: `npm install --legacy-peer-deps`, `npm test`, `npm run dev` (porta 3000), `npm run build`, `npm start`. Verificação de tipos com `npx tsc --noEmit` (README.md:12, package.json:5).
