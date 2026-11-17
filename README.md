# RecebeFácil

Gestão de vendas, parcelas e recebimentos. Os valores de demonstração são fictícios. O Asaas não cobra de verdade.

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

`DATABASE_URL` é opcional no desenvolvimento. Não coloque chave de Asaas.

`RECEBEFACIL_SECRET` (mínimo de 32 caracteres) assina os links de pagamento. Em produção ela é obrigatória, e trocá-la invalida os links já enviados. No desenvolvimento, sem a variável, um segredo é gerado e guardado em `.secret` na pasta de dados.

## O que é demonstrativo

Conexão do Asaas, link de cobrança, Pix, boleto e cartão. O pagamento registrado no app só atualiza o saldo local.
