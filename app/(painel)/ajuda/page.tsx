import Link from "next/link";
import { SupportForm } from "@/components/forms";
import { Card, Title } from "@/components/ui";

const faqs = [
  ["O RecebeFácil é um banco?", "Não. Ele organiza vendas e o que falta receber. O dinheiro não fica aqui."],
  ["O Asaas cobra de verdade?", "Não nesta versão. O cartão só mostra o estado da simulação."],
  ["Como o centavo é tratado?", "A divisão é inteira. O que sobra entra na primeira parcela, e a soma fecha o total."],
  ["A nota fiscal vai para a SEFAZ?", "Não. O documento fica na empresa, com número e situação. A transmissão exige certificado digital."],
];

export default function AjudaPage() {
  return (
    <div className="space-y-4">
      <Title hint="O canal de suporte é o chamado abaixo e o e-mail suporte@recebefacil.app.">Ajuda e suporte</Title>
      {faqs.map(([question, answer]) => (
        <Card key={question}>
          <p className="font-medium">{question}</p>
          <p className="mt-1 text-sm text-[#64748B]">{answer}</p>
        </Card>
      ))}
      <Card>
        <p className="mb-3 font-medium">Chamado</p>
        <SupportForm />
        <p className="mt-3 text-sm text-[#64748B]">
          <Link className="text-teal-700" href="/termos">Termos de uso</Link>
          {" · "}
          <Link className="text-teal-700" href="/privacidade">Política de privacidade</Link>
        </p>
      </Card>
    </div>
  );
}
