import { saveMerchantAction } from "../actions"
import { PlainForm } from "../../components/forms"
import { company } from "../../src/book"
import { canonicalPixKey } from "../../src/domain/money"
import { phrase } from "../../src/phrase"

export default async function EmpresaPage() {
  const result = await company()
  if (!result.ok) return <p className="bad">{phrase(result.error)}</p>
  const merchant = result.value
  return (
    <main>
      <h1>Empresa</h1>
      <p className="lede">A razão social entra no PIX. A cidade do código é São Paulo até você pedir outro campo.</p>
      <section className="card">
        <PlainForm action={saveMerchantAction} submitLabel="Salvar empresa">
          <label>
            Razão social
            <input name="legalName" required maxLength={80} defaultValue={merchant?.legalName ?? ""} />
          </label>
          <label>
            Chave PIX
            <input name="pixKey" required defaultValue={merchant ? canonicalPixKey(merchant.pixKey) : ""} placeholder="CPF, CNPJ, e-mail, celular ou chave aleatória" />
          </label>
        </PlainForm>
      </section>
    </main>
  )
}
