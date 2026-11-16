import { confirmReceiptAction, reverseReceiptAction } from "../../actions"
import { CopyButton, KeyedForm, PlainForm } from "../../../components/forms"
import { installmentPage } from "../../../src/book"
import { centavos, civilDate } from "../../../src/domain/money"
import { reaisField } from "../../../src/domain/format"
import { formatCivilDate, formatReais, methodLabel, phrase, situationLabel } from "../../../src/phrase"

export default async function ParcelaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await installmentPage(id)
  if (!result.ok) return <p className="bad">{phrase(result.error)}</p>
  const page = result.value
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" })
  return (
    <main className="stack">
      <section>
        <p className="muted">
          <a href={`/clientes/${page.clientId}`}>{page.clientName}</a>
        </p>
        <h1>{formatReais(page.view.openCentavos)}</h1>
        <p className="lede">
          Vencimento {formatCivilDate(page.view.dueOn)}. Principal {formatReais(page.view.principal)}.{" "}
          <span className={`pill ${page.view.situation}`}>{situationLabel(page.view.situation)}</span>
        </p>
      </section>
      <section className="card">
        <h2>Cobrar</h2>
        {page.notice === "merchant_missing" ? <p className="notice">Cadastre a chave PIX da empresa para montar o copia e cola.</p> : null}
        {page.notice === "closed" ? <p className="notice">Parcela quitada. Não há PIX em aberto.</p> : null}
        {page.notice === "pix_manual" && page.pixPayload && page.whatsAppUrl ? (
          <>
            <p className="notice">O PIX é manual. O app monta o copia e cola e não registra boleto nem cartão no banco.</p>
            <textarea readOnly value={page.pixPayload} aria-label="PIX copia e cola" />
            <div className="actions">
              <CopyButton value={page.pixPayload} />
              <a className="button secondary" href={page.whatsAppUrl}>
                Abrir WhatsApp
              </a>
            </div>
          </>
        ) : null}
      </section>
      {page.view.situation === "settled" ? null : (
        <section className="card">
          <h2>Confirmar recebimento</h2>
          <KeyedForm
            key={page.view.openCentavos}
            action={confirmReceiptAction}
            storageKey={`recebimento:${id}`}
            submitLabel="Confirmar"
          >
            <input type="hidden" name="installmentId" value={page.view.id} />
            <label>
              Valor
              <input name="amountReais" required defaultValue={reaisField(page.view.openCentavos)} inputMode="decimal" />
            </label>
            <label>
              Forma
              <select name="method" defaultValue="pix">
                <option value="pix">PIX</option>
                <option value="boleto">Boleto</option>
                <option value="card">Cartão</option>
                <option value="cash">Dinheiro</option>
                <option value="transfer">Transferência</option>
              </select>
            </label>
            <label>
              Data
              <input name="confirmedOn" type="date" required defaultValue={today} />
            </label>
          </KeyedForm>
        </section>
      )}
      <section className="card">
        <h2>Recebimentos</h2>
        {page.receipts.length === 0 ? <p className="muted">Nenhum recebimento nesta parcela.</p> : null}
        <ul className="list">
          {page.receipts.map((receipt) => (
            <li key={receipt.id} className="parcel">
              <span>
                {formatCivilDate(civilDate(receipt.confirmedOn))} {methodLabel(receipt.method)} {formatReais(centavos(receipt.amount))}
                {receipt.reversed ? " · estornado" : ""}
              </span>
              {receipt.reversed ? null : (
                <PlainForm action={reverseReceiptAction} submitLabel="Estornar">
                  <input type="hidden" name="receiptId" value={receipt.id} />
                </PlainForm>
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
