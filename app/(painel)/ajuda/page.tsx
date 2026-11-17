import Link from "next/link";
import { SupportForm } from "@/components/settings-forms";
import { Card, Title } from "@/components/ui";

const FAQS: [string, string][] = [
  ["Como faço uma venda?", "Toque em Nova venda. Escolha o cliente, toque nos produtos e diga como vai receber: à vista, parcelado ou mensalidade. Ao concluir, o link de pagamento já fica pronto para enviar."],
  ["Como marco que o cliente me pagou?", "Em A receber, toque em Recebi na linha do pagamento. O valor e a data já vêm preenchidos. Se o cliente pagou com atraso, a multa e os juros aparecem sugeridos e você pode ajustar."],
  ["Como cobro um cliente?", "Toque em Cobrar na linha do pagamento. O WhatsApp abre com a mensagem pronta e o link de pagamento. Você só envia. Se o cliente não tem WhatsApp, copie o link e mande por onde preferir."],
  ["Onde o cliente paga?", "O link de pagamento mostra o que ele comprou, o valor e a sua chave Pix. Cadastre a chave e as instruções em Mais, Recebimentos. Depois de pagar, o cliente envia o comprovante para você, e você marca Recebi."],
  ["Errei ao marcar um pagamento. E agora?", "Abra a venda ou o cliente, toque nos três pontos da linha e escolha Desfazer recebimento. O pagamento volta a ficar em aberto."],
  ["Como vendo um terreno em até 240 parcelas?", "Na Nova venda, escolha Parcelado e o número de parcelas. Em Financiamento longo, informe os juros ao mês e o reajuste anual. Você vê as parcelas antes de concluir, e depois pode gerar o contrato na página da venda."],
  ["Como funciona a mensalidade?", "Escolha Mensalidade na venda. Uma cobrança nova nasce a cada mês até você encerrar, em Mais, na página da venda."],
  ["Para que serve o contrato?", "Na página da venda, toque em Mais e Gerar contrato. Ele abre pronto para imprimir, com as partes, o preço, as parcelas e a multa por atraso. Confira com seu advogado antes de usar."],
  ["O RecebeFácil guarda meu dinheiro?", "Não. Ele organiza o que você vendeu e o que falta receber. O dinheiro vai direto para você, pela forma que você combinou com o cliente."],
];

export default function AjudaPage() {
  return (
    <div className="space-y-4">
      <Title hint="Respostas rápidas e um jeito de falar com a gente.">Ajuda</Title>
      <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-sm">
        {FAQS.map(([question, answer]) => (
          <details key={question} className="group px-4 py-3">
            <summary className="cursor-pointer list-none font-semibold text-slate-900 marker:hidden">{question}</summary>
            <p className="mt-1.5 text-sm text-slate-600">{answer}</p>
          </details>
        ))}
      </div>
      <Card className="space-y-3">
        <h2 className="font-bold text-slate-900">Falar com o suporte</h2>
        <SupportForm />
        <p className="text-sm text-slate-500">
          Ou escreva para suporte@recebefacil.app. <Link className="font-semibold text-teal-700" href="/termos">Termos de uso</Link>
          {" · "}
          <Link className="font-semibold text-teal-700" href="/privacidade">Política de privacidade</Link>
        </p>
      </Card>
    </div>
  );
}
