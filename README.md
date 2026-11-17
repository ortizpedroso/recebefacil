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

Chave de API e token do Asaas não vão em variável de ambiente, nem no código, nem em arquivo. Elas são digitadas na página Plataforma e ficam cifradas no banco.

## Asaas

### Como o dinheiro anda

A cobrança é criada na conta Asaas da plataforma. Um split manda para a carteira do lojista tudo menos a taxa da plataforma (padrão 1,5%), e a taxa é o que fica na conta da plataforma. O lojista não entrega a chave dele: cola uma vez, o app descobre a carteira e descarta a chave. O cartão é digitado no site do Asaas, nunca aqui. Dinheiro é inteiro em centavos por dentro e só vira reais na chamada ao Asaas.

### Configuração pelo dono da plataforma

1. Defina `RECEBEFACIL_SECRET` e `PLATFORM_OWNER_EMAILS` e publique.
2. Entre com um e-mail da lista, abra Mais e depois Plataforma.
3. Comece pelo ambiente Sandbox. Crie uma conta em `https://sandbox.asaas.com`, gere uma chave de API e cole no campo Chave de API.
4. Clique em Gerar token, copie o token que aparece (ele só aparece uma vez) e salve.
5. Clique em Testar conexão. O app consulta a conta, guarda a carteira da plataforma e mostra o nome da conta e o ambiente. Os lojistas só veem o modo Integrado quando chave, token e carteira estão prontos.
6. No Asaas, abra Configurações da conta, Integrações, Webhooks e crie um webhook de cobranças. Use o endereço mostrado na página (`<seu domínio>/api/webhooks/asaas`), o token do passo 4, fila sequencial, e ative os eventos listados na página (`PAYMENT_RECEIVED`, `PAYMENT_CONFIRMED`, estornos, chargebacks, `PAYMENT_RECEIVED_IN_CASH_UNDONE` e `PAYMENT_DELETED`).
7. Para ir à produção, troque o ambiente, cole a chave de produção, gere um novo token, atualize o webhook no Asaas de produção e teste a conexão de novo. Trocar de ambiente solta as cobranças ainda abertas, os clientes do Asaas e as contas ligadas pelos lojistas, que precisam conectar de novo com chave de produção.

A taxa (0% a 20%) e os preços dos planos também ficam nessa página.

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
