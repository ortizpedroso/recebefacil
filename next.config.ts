import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite"],
  agentRules: false,
  experimental: {
    // A foto do produto pode ter 1 MB, e o limite padrão das ações do servidor também é 1 MB.
    serverActions: { bodySizeLimit: "2mb" },
  },
  // Cobranças, parcelas, inadimplência, contratos e recorrências viraram a lista A receber.
  // A página de impressão do contrato continua em /contratos/[id]/imprimir.
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
