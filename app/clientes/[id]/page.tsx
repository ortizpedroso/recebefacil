import { materializePeriodAction, recordContractAction, recordCrediarioAction } from "../../actions"
import { KeyedForm, PlainForm } from "../../../components/forms"
import { clientPage } from "../../../src/book"
import { formatCivilDate, formatReais, phrase, situationLabel } from "../../../src/phrase"
import { centavos } from "../../../src/domain/money"

export default async function ClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await clientPage(id)
  if (!result.ok) return <p className="bad">{phrase(result.error)}</p>
  const page = result.value
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" })
  return (
    <main className="stack">
      <section>
        <h1>{page.client.name}</h1>
        <p className="lede">
          Em aberto {formatReais(centavos(page.openCentavos))}. {page.client.taxId.kind.toUpperCase()} {page.client.taxId.digits}.
        </p>
      </section>
      <section className="card">
        <h2>Venda parcelada</h2>
        <KeyedForm action={recordCrediarioAction} storageKey={`crediario:${id}`} submitLabel="Lançar venda">
          <input type="hidden" name="clientId" value={page.client.id} />
          <label>
            Descrição
            <input name="description" required maxLength={120} />
          </label>
          <label>
            Valor total
            <input name="principalReais" required placeholder="1.234,56" inputMode="decimal" />
          </label>
          <label>
            Parcelas
            <input name="installmentCount" required defaultValue="3" inputMode="numeric" />
          </label>
          <label>
            Primeiro vencimento
            <input name="firstDue" type="date" required defaultValue={today} />
          </label>
        </KeyedForm>
      </section>
      {page.crediarios.map((sale) => (
        <section className="card" key={sale.agreement.id}>
          <h2>{sale.agreement.description}</h2>
          <p className="muted">Carnê de {formatReais(sale.agreement.principal)}</p>
          <ul className="list">
            {sale.installments.map((item) => (
              <li key={item.id}>
                <a className="parcel" href={`/parcelas/${item.id}`}>
                  <span>
                    {formatCivilDate(item.dueOn)} <span className={`pill ${item.situation}`}>{situationLabel(item.situation)}</span>
                  </span>
                  <span>{formatReais(item.openCentavos)}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <section className="card">
        <h2>Contrato mensal</h2>
        <p className="muted">O contrato não gera os meses futuros. Você gera a competência quando ela vence.</p>
        <KeyedForm action={recordContractAction} storageKey={`contrato:${id}`} submitLabel="Lançar contrato">
          <input type="hidden" name="clientId" value={page.client.id} />
          <label>
            Descrição
            <input name="description" required maxLength={120} />
          </label>
          <label>
            Valor do mês
            <input name="amountReais" required placeholder="150,00" inputMode="decimal" />
          </label>
          <label>
            Dia de vencimento
            <input name="dueDay" required defaultValue="5" inputMode="numeric" />
          </label>
          <label>
            Início
            <input name="openedOn" type="date" required defaultValue={today} />
          </label>
        </KeyedForm>
      </section>
      {page.contracts.map((contract) => (
        <section className="card" key={contract.agreement.id}>
          <h2>{contract.agreement.description}</h2>
          <p className="muted">Mensalidade {formatReais(contract.agreement.amountPerPeriod)}</p>
          <ul className="list">
            {contract.installments.map((item) => (
              <li key={item.id}>
                <a className="parcel" href={`/parcelas/${item.id}`}>
                  <span>
                    {formatCivilDate(item.dueOn)} <span className={`pill ${item.situation}`}>{situationLabel(item.situation)}</span>
                  </span>
                  <span>{formatReais(item.openCentavos)}</span>
                </a>
              </li>
            ))}
          </ul>
          {contract.generatable.length === 0 ? <p className="muted">Nenhum mês novo para gerar.</p> : null}
          <div className="actions">
            {contract.generatable.map((period) => (
              <PlainForm key={period} action={materializePeriodAction} submitLabel={`Gerar ${period}`}>
                <input type="hidden" name="contractId" value={contract.agreement.id} />
                <input type="hidden" name="periodKey" value={period} />
              </PlainForm>
            ))}
          </div>
        </section>
      ))}
    </main>
  )
}
