import { openDashboard } from "../src/book"
import { formatCivilDate, formatReais, phrase, situationLabel } from "../src/phrase"

export default async function HomePage() {
  const result = await openDashboard()
  if (!result.ok) return <p className="bad">{phrase(result.error)}</p>
  const dash = result.value
  return (
    <main>
      <h1>Hoje</h1>
      <p className="lede">
        Em aberto é o que ainda falta receber. Vencido já está dentro desse número. Recebido no mês desconta estorno feito neste mês.
      </p>
      {dash.merchant === null ? (
        <p className="notice">
          <a href="/empresa">Cadastre a razão social e a chave PIX</a> antes de lançar uma venda.
        </p>
      ) : null}
      <section className="stats">
        <article className="stat">
          <span>Em aberto</span>
          <strong>{formatReais(dash.openCentavos)}</strong>
        </article>
        <article className="stat late">
          <span>Vencido</span>
          <strong>{formatReais(dash.overdueCentavos)}</strong>
        </article>
        <article className="stat">
          <span>Recebido no mês</span>
          <strong>{formatReais(dash.receivedThisMonthCentavos)}</strong>
        </article>
      </section>
      <section className="card">
        <h2>Próximos 7 dias</h2>
        {dash.dueSoon.length === 0 ? <p className="muted">Nenhuma parcela em aberto nesta janela.</p> : null}
        <ul className="list">
          {dash.dueSoon.map((item) => (
            <li key={item.id}>
              <a href={`/parcelas/${item.id}`}>
                <span>
                  {item.clientName}
                  <span className="muted">{formatCivilDate(item.dueOn)}</span>
                </span>
                <span>
                  {formatReais(item.openCentavos)} <span className={`pill ${item.situation}`}>{situationLabel(item.situation)}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
