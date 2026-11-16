import { Card, Title } from "@/components/ui";

export default function PrivacidadePage() {
  return (
    <div className="space-y-4">
      <Title hint="O que a empresa guarda sobre clientes e sobre a própria conta.">Política de privacidade</Title>
      <Card>
        <div className="space-y-3 text-sm leading-6 text-[#334155]">
          <p>Cada empresa vê só o próprio livro. Cliente, documento, telefone, endereço, venda e pagamento ficam ligados à organização.</p>
          <p>O CPF e o CNPJ são conferidos pelo dígito antes de gravar um cadastro novo. O documento não é enviado a um birô nesta versão.</p>
          <p>O chamado de suporte guarda o contato e a mensagem que a pessoa escreveu. O erro de tela guarda a mensagem técnica para o alerta da empresa.</p>
          <p>A fila de WhatsApp guarda telefone e texto. Sem um provedor configurado, a mensagem permanece na fila e não sai do RecebeFácil.</p>
        </div>
      </Card>
    </div>
  );
}
