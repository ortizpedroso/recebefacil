import type { Metadata } from "next"
import { Fraunces, Source_Sans_3 } from "next/font/google"
import "./globals.css"

const display = Fraunces({ subsets: ["latin"], variable: "--font-display" })
const body = Source_Sans_3({ subsets: ["latin"], variable: "--font-body" })

export const metadata: Metadata = {
  title: "RecebeFácil",
  description: "Livro de vendas parceladas e contratos recorrentes.",
}

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={`${display.variable} ${body.variable}`}>
        <div className="shell">
          <header className="top">
            <p className="brand">
              <a href="/">RecebeFácil</a>
            </p>
            <nav className="nav">
              <a href="/">Hoje</a>
              <a href="/clientes">Clientes</a>
              <a href="/empresa">Empresa</a>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  )
}
