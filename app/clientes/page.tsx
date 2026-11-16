import { saveClientAction } from "../actions"
import { PlainForm } from "../../components/forms"
import { clients } from "../../src/book"
import { phrase } from "../../src/phrase"

export default async function ClientesPage() {
  const result = await clients()
  if (!result.ok) return <p className="bad">{phrase(result.error)}</p>
  return (
    <main className="stack">
      <section>
        <h1>Clientes</h1>
        <p className="lede">O mesmo CPF atualiza nome e telefone. Não cria um segundo cliente.</p>
        {result.value.length === 0 ? <p className="muted">Nenhum cliente ainda.</p> : null}
        <ul className="list">
          {result.value.map((client) => (
            <li key={client.id}>
              <a href={`/clientes/${client.id}`}>
                <span>
                  {client.name}
                  <span className="muted">{client.taxId.digits}</span>
                </span>
                <span>{client.phone.digits}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
      <section className="card">
        <h2>Novo cliente</h2>
        <PlainForm action={saveClientAction} submitLabel="Salvar cliente">
          <label>
            Nome
            <input name="name" required maxLength={80} />
          </label>
          <label>
            CPF ou CNPJ
            <input name="taxId" required inputMode="numeric" />
          </label>
          <label>
            Celular
            <input name="phone" required placeholder="11988887777" />
          </label>
        </PlainForm>
      </section>
    </main>
  )
}
