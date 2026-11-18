import type { Metadata } from "next";
import "./globals.css";

const description = "Venda, mande o link de pagamento pelo WhatsApp e acompanhe quem pagou e quem está atrasado.";

export const metadata: Metadata = {
  ...(process.env.NEXT_PUBLIC_SITE_URL ? { metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL) } : {}),
  title: { default: "RecebeFácil", template: "%s · RecebeFácil" },
  description,
  applicationName: "RecebeFácil",
  openGraph: { type: "website", locale: "pt_BR", siteName: "RecebeFácil", title: "RecebeFácil", description },
  twitter: { card: "summary", title: "RecebeFácil", description },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
