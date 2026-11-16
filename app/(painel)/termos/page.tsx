import { Card, Title } from "@/components/ui";

export default function TermosPage() {
  return (
    <div className="space-y-4">
      <Title hint="Vigente para quem usa o RecebeFácil.">Termos de uso</Title>
      <Card>
        <div className="space-y-3 text-sm leading-6 text-[#334155]">
          <p>O RecebeFácil organiza clientes, vendas, parcelas e a fila de cobrança da empresa. Ele não é banco, não guarda saldo de cliente e não substitui o gateway de pagamento.</p>
          <p>A empresa responde pelos dados que cadastra e pelas cobranças que registra. O plano da plataforma, quando assinado, gera uma fatura interna do próprio RecebeFácil.</p>
          <p>A nota emitida aqui é um documento da empresa. Ela não é transmitida à SEFAZ nesta versão.</p>
          <p>O suporte recebe chamados pela tela de ajuda e pelo e-mail suporte@recebefacil.app.</p>
        </div>
      </Card>
    </div>
  );
}
