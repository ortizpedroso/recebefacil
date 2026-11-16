import React, { useState } from 'react';
import {
  HelpCircle,
  ChevronDown,
  Send,
  CheckCircle2,
  BookOpen,
  ShieldCheck,
} from 'lucide-react';
import { useRecebeFacil } from '../context/RecebeFacilContext';

const FAQS = [
  {
    q: 'O RecebeFácil é um banco ou gateway de pagamento?',
    a: 'Não. O RecebeFácil é uma plataforma de gestão comercial e financeira que organiza clientes, vendas, contratos, parcelas e cobranças. Os meios de pagamento (Pix, boleto e cartão) e a confirmação automática de liquidações são planejados por meio da integração com o provedor externo Asaas.',
  },
  {
    q: 'Qual a diferença entre Parcelas e Recorrências?',
    a: 'O módulo de Parcelas controla vendas finitas com início e fim definidos (por exemplo, entrada + 5 ou 10 parcelas de imóveis, móveis planejados ou cursos). Já Recorrências gerencia assinaturas e mensalidades contínuas (mensais, trimestrais, anuais etc.) que seguem gerando cobranças até serem suspensas ou canceladas.',
  },
  {
    q: 'Posso vender itens que não estão no catálogo?',
    a: 'Sim. Na etapa de itens do fluxo "Nova venda", além de selecionar produtos e serviços cadastrados, você pode adicionar itens avulsos personalizados informando descrição, tipo, quantidade e valor unitário.',
  },
  {
    q: 'Os dados alterados nesta demonstração ficam salvos?',
    a: 'Sim. As alterações ficam salvas para você continuar a apresentação. Nenhuma cobrança, Pix, boleto ou cartão é real, e o Asaas é só uma simulação visual. Para voltar ao cenário original, clique em "Resetar" no rodapé do menu lateral.',
  },
  {
    q: 'O envio para WhatsApp e a integração com o Asaas executam ações reais?',
    a: 'O botão de WhatsApp abre o link oficial wa.me com a mensagem já preenchida para você revisar antes de enviar. Já a conexão com o Asaas, geração de links de cobrança, confirmações e estornos são simulações visuais sem movimentação financeira real.',
  },
];

export const AjudaSuportePage: React.FC = () => {
  const { showToast, state } = useRecebeFacil();
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const [assunto, setAssunto] = useState('');
  const [categoria, setCategoria] = useState('Dúvida comercial');
  const [mensagem, setMensagem] = useState('');
  const [enviado, setEnviado] = useState(false);

  const handleSubmitTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assunto.trim() || !mensagem.trim()) return;
    setEnviado(true);
    setAssunto('');
    setMensagem('');
    showToast('Solicitação registrada no ambiente de demonstração.');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
          Ajuda e suporte
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Guia rápido de operação do RecebeFácil, perguntas frequentes e canal demonstrativo de atendimento.
        </p>
      </div>

      {/* Guia rápido do fluxo */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="w-4 h-4 text-teal-700" />
          <h2 className="text-sm font-bold text-slate-900">
            Como funciona o fluxo no RecebeFácil
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[11px] font-bold text-teal-700">1. Cadastre</span>
            <p className="font-semibold text-slate-900 mt-1">Clientes e Catálogo</p>
            <p className="text-slate-600 mt-1 leading-relaxed">
              Organize produtos, serviços pontuais ou recorrentes e o histórico completo de cada cliente.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[11px] font-bold text-teal-700">2. Venda</span>
            <p className="font-semibold text-slate-900 mt-1">À vista, parcelado ou recorrente</p>
            <p className="text-slate-600 mt-1 leading-relaxed">
              Ao concluir a venda, o sistema gera automaticamente contrato, cronograma de parcelas e cobrança inicial.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[11px] font-bold text-teal-700">3. Receba</span>
            <p className="font-semibold text-slate-900 mt-1">Cobranças e provedor Asaas</p>
            <p className="text-slate-600 mt-1 leading-relaxed">
              Compartilhe links por WhatsApp, registre baixas parciais ou totais e sincronize com o provedor planejado.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[11px] font-bold text-teal-700">4. Acompanhe</span>
            <p className="font-semibold text-slate-900 mt-1">Inadimplência e Relatórios</p>
            <p className="text-slate-600 mt-1 leading-relaxed">
              Controle promessas de pagamento, contatos amigáveis e indicadores consolidados em tempo real.
            </p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        {/* FAQ Accordion */}
        <section className="lg:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-teal-700" />
            <h2 className="text-sm font-bold text-slate-900">Perguntas frequentes</h2>
          </div>

          <div className="divide-y divide-slate-100">
            {FAQS.map((item, idx) => {
              const isOpen = openIdx === idx;
              return (
                <div key={idx}>
                  <button
                    type="button"
                    onClick={() => setOpenIdx(isOpen ? null : idx)}
                    className="w-full text-left px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors"
                  >
                    <span className="text-xs font-semibold text-slate-900">{item.q}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-4 text-xs text-slate-600 leading-relaxed">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Formulário de suporte simulado */}
        <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-teal-700" />
            <h2 className="text-sm font-bold text-slate-900">Falar com o suporte (Demo)</h2>
          </div>

          {enviado ? (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-2">
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                <span>Mensagem registrada na demonstração</span>
              </div>
              <p>
                Em ambiente de produção com backend conectado, sua solicitação seria encaminhada para a equipe do RecebeFácil com resposta para{' '}
                <span className="font-semibold">{state.configuracoes.usuario.email}</span>.
              </p>
              <button
                type="button"
                onClick={() => setEnviado(false)}
                className="text-teal-800 font-semibold hover:underline pt-1"
              >
                Enviar outra mensagem
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmitTicket} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Assunto *</label>
                <input
                  type="text"
                  required
                  value={assunto}
                  onChange={(e) => setAssunto(e.target.value)}
                  placeholder="Ex: Dúvida sobre importação de contratos"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Categoria</label>
                <select
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                >
                  <option value="Dúvida comercial">Dúvida comercial</option>
                  <option value="Integração Asaas">Integração Asaas</option>
                  <option value="Sugestão de melhoria">Sugestão de melhoria</option>
                  <option value="Suporte técnico">Suporte técnico</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Mensagem *</label>
                <textarea
                  rows={4}
                  required
                  value={mensagem}
                  onChange={(e) => setMensagem(e.target.value)}
                  placeholder="Descreva sua dúvida ou cenário de uso..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>

              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-semibold transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Registrar solicitação (Demo)</span>
              </button>
            </form>
          )}
        </section>
      </div>
    </div>
  );
};
