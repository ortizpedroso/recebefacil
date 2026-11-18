import Link from "next/link";
import { Card, money, Table } from "@/components/ui";
import { FeeSimulator, WithdrawForm } from "@/components/withdraw";
import { can } from "@/lib/access";
import { formatDateTimeBR } from "@/lib/dates";
import { ASAAS_FEES } from "@/lib/fees";
import { formatPercentBp } from "@/lib/money";
import { loadPlatformSettings } from "@/lib/platform-settings";
import { requireSession } from "@/lib/session";
import { refreshSubaccountStatus, SUBACCOUNT_LABEL } from "@/lib/subaccount";
import { loadWallet, WITHDRAWAL_LABEL } from "@/lib/withdrawals";

export const dynamic = "force-dynamic";

const percent = (bp: number) => `${formatPercentBp(bp)}%`;

export default async function SaquePage() {
  const session = await requireSession();
  const { db, org } = session;
  const settings = await loadPlatformSettings(db);
  const status = org.asaasAccountId ? await refreshSubaccountStatus(db, org, settings).catch(() => org.asaasAccountStatus) : "";
  const wallet = org.asaasAccountId ? await loadWallet(db, { ...org, asaasAccountStatus: status }, settings) : null;
  const feeBp = settings.platformFeeBp;
  const rows: [string, string, string][] = [
    ["Pix recebido", `${money(ASAAS_FEES.pixCents)} por cobrança`, "Na hora"],
    ["Boleto pago", `${money(ASAAS_FEES.boletoCents)} por boleto`, `${ASAAS_FEES.boletoSettlementDays} dia útil depois do pagamento`],
    ...ASAAS_FEES.card.map((tier): [string, string, string] => [tier.label, `${money(tier.fixedCents)} + ${percent(tier.bp)} do valor`, `${ASAAS_FEES.cardSettlementDays} dias por parcela, ou antecipado`]),
    ["Antecipação do cartão à vista", `${percent(ASAAS_FEES.anticipation.cashMonthlyBp)} ao mês`, "Opcional"],
    ["Antecipação do cartão parcelado", `${percent(ASAAS_FEES.anticipation.installmentMonthlyBp)} ao mês por parcela antecipada`, "Opcional"],
    ["Saque por Pix", `${ASAAS_FEES.withdrawal.pixFreePerMonth} grátis por mês, depois ${money(ASAAS_FEES.withdrawal.pixCents)} cada`, "Em minutos"],
  ];

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <h2 className="font-bold text-slate-900">Sua conta de recebimento</h2>
        {!org.asaasAccountId ? (
          <div className="space-y-2 text-sm text-slate-600">
            <p>
              {org.asaasWalletId
                ? "Sua empresa recebe numa conta Asaas própria, ligada pela chave. O saldo e o saque dela ficam no app ou no site do Asaas."
                : "Você ainda não tem conta de recebimento. Abra a sua em Recebimentos, no modo Integrado."}
            </p>
            {org.asaasWalletId ? null : (
              <Link href="/recebimentos" className="font-semibold text-teal-700 hover:underline">
                Ir para Recebimentos
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm text-slate-500">Saldo disponível para saque</p>
                <p className="text-2xl font-bold tabular-nums text-slate-900">{wallet && wallet.balanceCents !== null ? money(wallet.balanceCents) : "Indisponível agora"}</p>
              </div>
              <p className="text-sm text-slate-600">
                {org.asaasAccountName} · <span className="font-semibold">{SUBACCOUNT_LABEL[status]}</span>
              </p>
            </div>
            {status === "aprovada" && wallet && wallet.balanceCents !== null ? (
              can(session.role, "saque.solicitar") ? (
                <WithdrawForm balanceCents={wallet.balanceCents} feeCents={wallet.nextFeeCents} defaultPixKey={org.pixKey} />
              ) : (
                <p className="text-sm text-slate-600">Só um administrador pode pedir saque.</p>
              )
            ) : (
              <p className="text-sm text-slate-600">
                {status === "reprovada"
                  ? "O Asaas reprovou a conta. Confira o e-mail do Asaas para saber o que falta ou fale com o suporte."
                  : "O saque fica liberado quando o Asaas aprovar sua conta. Fique de olho no e-mail: ele pode pedir documentos."}
              </p>
            )}
            {wallet ? (
              <p className="text-[13px] text-slate-500">
                Saques neste mês: {wallet.usedThisMonth}.{" "}
                {wallet.nextFeeCents === 0 ? `O próximo é grátis (${ASAAS_FEES.withdrawal.pixFreePerMonth} por mês).` : `O próximo custa ${money(wallet.nextFeeCents)}.`}
              </p>
            ) : null}
          </>
        )}
      </Card>

      {wallet && wallet.history.length > 0 ? (
        <Card className="space-y-3">
          <h2 className="font-bold text-slate-900">Saques</h2>
          <Table>
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 font-semibold">Pedido em</th>
                <th className="px-3 py-2 font-semibold">Valor</th>
                <th className="px-3 py-2 font-semibold">Tarifa</th>
                <th className="px-3 py-2 font-semibold">Destino</th>
                <th className="px-3 py-2 font-semibold">Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {wallet.history.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-2 tabular-nums text-slate-700">{formatDateTimeBR(row.createdAt)}</td>
                  <td className="px-3 py-2 font-medium tabular-nums text-slate-900">{money(row.amountCents)}</td>
                  <td className="px-3 py-2 tabular-nums text-slate-700">{row.feeCents === 0 ? "Grátis" : money(row.feeCents)}</td>
                  <td className="px-3 py-2 text-slate-700">{row.pixKey}</td>
                  <td className="px-3 py-2 text-slate-700">
                    {WITHDRAWAL_LABEL[row.status]}
                    {row.failReason ? <span className="block text-xs text-rose-700">{row.failReason}</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      ) : null}

      <Card className="space-y-3">
        <div>
          <h2 className="font-bold text-slate-900">Todas as taxas</h2>
          <p className="text-sm text-slate-500">
            As taxas do Asaas são cobradas pela instituição que guarda seu dinheiro. Além delas, a plataforma fica com <strong className="text-slate-900">{percent(feeBp)}</strong> de cada pagamento recebido pelo sistema. Não há outra cobrança.
          </p>
        </div>
        <Table>
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 font-semibold">O quê</th>
              <th className="px-3 py-2 font-semibold">Taxa</th>
              <th className="px-3 py-2 font-semibold">Quando o dinheiro fica disponível</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(([label, fee, when]) => (
              <tr key={label}>
                <td className="px-3 py-2 font-medium text-slate-900">{label}</td>
                <td className="px-3 py-2 text-slate-700">{fee}</td>
                <td className="px-3 py-2 text-slate-700">{when}</td>
              </tr>
            ))}
            <tr>
              <td className="px-3 py-2 font-medium text-slate-900">Taxa da plataforma</td>
              <td className="px-3 py-2 text-slate-700">{percent(feeBp)} de cada pagamento recebido pelo sistema, descontado automaticamente</td>
              <td className="px-3 py-2 text-slate-700">No momento do pagamento</td>
            </tr>
          </tbody>
        </Table>
        <p className="text-[13px] text-slate-500">
          Tabela pública do Asaas conferida em novembro de 2026. Os valores do Asaas podem mudar, e a fonte oficial é{" "}
          <a href="https://www.asaas.com/precos-e-taxas" target="_blank" rel="noopener noreferrer" className="font-semibold text-teal-700 hover:underline">
            asaas.com/precos-e-taxas
          </a>
          .
        </p>
      </Card>

      <Card className="space-y-3">
        <div>
          <h2 className="font-bold text-slate-900">Quanto chega na sua conta</h2>
          <p className="text-sm text-slate-500">Simule uma venda e veja cada taxa separada, inclusive a antecipação.</p>
        </div>
        <FeeSimulator platformFeeBp={feeBp} />
      </Card>
    </div>
  );
}
