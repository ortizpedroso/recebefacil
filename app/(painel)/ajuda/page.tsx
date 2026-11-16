import { Card, Title } from "@/components/ui";

const faqs = [
  ["O RecebeFácil é um banco?", "Não. Ele organiza vendas e o que falta receber. O dinheiro não fica aqui."],
  ["O Asaas cobra de verdade?", "Não nesta versão. O cartão só mostra o estado da simulação."],
  ["Como o centavo é tratado?", "A divisão é inteira. O que sobra entra na primeira parcela, e a soma fecha o total."],
];

export default function AjudaPage() {
  return (
    <div className="space-y-4">
      <Title hint="Não há telefone oficial de suporte nesta versão.">Ajuda e suporte</Title>
      {faqs.map(([question, answer]) => (
        <Card key={question}>
          <p className="font-medium">{question}</p>
          <p className="mt-1 text-sm text-[#64748B]">{answer}</p>
        </Card>
      ))}
    </div>
  );
}
