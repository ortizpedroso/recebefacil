# Plano de Implementação — RecebeFácil (ordenado por peso e tamanho)

Estado: verde (25/25 testes, `tsc` 0, build 0). Stack mantida: Next.js 16 + TypeScript + Drizzle + PGlite/Postgres. Sem Python, FastAPI nem Prisma.

Cores e disposição do PDF confirmadas e preservadas: fundo `#F8FAFC`, cards brancos, borda `#E2E8F0`, acento teal `#0F766E`/`#00786F`, texto `#0F172B`.

## Ordem de execução (mais difíceis primeiro)

1. [x] Editar venda (M4). Peso alto, tamanho grande. Concluído. `updateSale` só edita venda sem recebimento e refaz parcelas, cobranças e contrato em transação. Wizard em modo edição, botão "Editar" e rota `/vendas/[id]/editar`.
2. [x] Cadastro manual de contrato (M5). Peso alto, tamanho grande. Concluído. `createContract` gera contrato, parcelas e cobranças sem venda; `sale_id` de `contracts` e `installments` relaxado para aceitar nulo.
3. [x] Cadastro manual de recorrência (M7). Peso alto, tamanho grande. Concluído. `createRecurrence` gera a recorrência, a primeira cobrança e o próximo ciclo, sem migração.
4. [ ] Status rascunho de venda (M4). Peso médio, tamanho grande. Adiado: baixo valor para a demo e alto custo de ciclo de vida.
5. [x] Cobrança avulsa (M8). Peso médio, tamanho médio. Concluído. `createCharge` cria recebível sem origem, com permissão `cobrancas.gravar`.
6. [x] Relatórios extras (M10). Peso médio, tamanho médio. Concluído. Adicionei "Recebimentos por forma" e "Vendas por produto ou serviço" em `lib/read.ts` e na página de relatórios.
7. [x] Editar contrato (M5). Peso médio, tamanho pequeno. Concluído. Edita só descrição, início, término e observações.
8. [x] Editar recorrência (M7). Peso médio, tamanho pequeno. Concluído. Edita descrição, valor e encerramento.
9. [x] Abas de configurações (seção 9). Peso baixo, tamanho médio. Concluído parcial. Adicionei "Usuário e conta" com dados reais da sessão; notificações e preferências são demonstrativas e cobertas pelo sino de alertas, pelo fuso em empresa e pelo padrão BRL fixo.
10. [x] Ranking de clientes no dashboard (M1). Peso baixo, tamanho pequeno. Concluído. Seção "Clientes com maior volume" no dashboard.
11. [x] Colunas extras na listagem de vendas (M4). Peso baixo, tamanho pequeno. Concluído. Adicionei "Recebido" e "Saldo" com `saleBalance`.
12. [x] Exportar Excel (M10). Peso médio, tamanho pequeno. Concluído com `lib/xls.ts` (SpreadsheetML sem dependência).

## Divergências (não são lacunas)

- Contrato usa "encerrado" em vez de "concluído" e "cancelado".
- O spec manda não implementar estoque e notas fiscais, mas o código já tem. Mantidos pela regra de não remover funcionalidade existente.

## Pendências técnicas

- `recharts@2.x` está depreciado e com 1 vulnerabilidade alta. Não subo para v3 porque mudaria gráfico e cores.
- Node local 24 versus o 22 do CI. Não bloqueia.
