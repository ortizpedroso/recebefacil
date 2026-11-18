import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite"],
  agentRules: false,
  // Sem isto o Next bloqueia o JavaScript da página em http://127.0.0.1 durante o desenvolvimento e nenhum botão responde.
  allowedDevOrigins: ["127.0.0.1"],
  experimental: {
    // A foto do produto pode ter 1 MB, e o limite padrão das ações do servidor também é 1 MB.
    serverActions: { bodySizeLimit: "2mb" },
  },
  // Cobranças, parcelas, inadimplência, contratos e recorrências viraram a lista A receber.
  // A página de impressão do contrato continua em /contratos/[id]/imprimir.
  async headers() {
    const everywhere = [
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
    ];
    // Só a página do cliente final se recusa a abrir dentro de outro site. O painel pode precisar da prévia do host.
    const payPage = [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
    ];
    return [
      { source: "/:path*", headers: everywhere },
      { source: "/pagar/:path*", headers: payPage },
    ];
  },
  async redirects() {
    return [
      { source: "/cobrancas", destination: "/receber", permanent: false },
      { source: "/parcelas", destination: "/receber", permanent: false },
      { source: "/inadimplencia", destination: "/receber?filtro=atrasadas", permanent: false },
      { source: "/contratos", destination: "/receber", permanent: false },
      { source: "/recorrencias", destination: "/receber", permanent: false },
      { source: "/recorrencias/:path*", destination: "/receber", permanent: false },
      { source: "/contratos/:id/editar", destination: "/receber", permanent: false },
    ];
  },
};

export default nextConfig;
