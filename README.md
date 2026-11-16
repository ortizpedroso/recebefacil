# RecebeFácil

Livro de vendas parceladas e contratos mensais para quem cobra no Brasil.

O saldo em aberto é o valor da parcela menos os recebimentos confirmados. Um estorno devolve esse valor. O atraso não fica gravado: a parcela está vencida quando ainda há saldo e a data de vencimento é anterior a hoje em São Paulo.

## Usar

1. Abra Empresa e salve a razão social e a chave PIX.
2. Cadastre o cliente com CPF ou CNPJ e celular.
3. Lance uma venda parcelada ou um contrato mensal.
4. No contrato, gere o mês quando ele estiver em aberto.
5. Na parcela, copie o PIX ou abra o WhatsApp e confirme o recebimento quando o dinheiro entrar.

O PIX é um copia e cola estático. O app não registra boleto nem cartão em banco. Boleto e cartão, na baixa, significam que você já recebeu fora daqui.

Valores usam vírgula nos centavos, como em `1.234,56`.

## Rodar

```bash
npm install
npm test
npm run dev
```

Com `DATABASE_URL`, o app usa esse Postgres. Sem a variável, usa um Postgres local em `data/recebefacil`. A publicação pede um Postgres pelo `cursor-app.json`.
