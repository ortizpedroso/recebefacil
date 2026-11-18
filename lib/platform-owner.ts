export type OwnerView = {
  publicDemo: boolean;
  viewerEmail: string;
  simulatedViewer: boolean;
};

// Só o dono da plataforma vê as credenciais. A conta de teste local conta como dono para quem desenvolve.
// Em produção ela só é dona com RECEBEFACIL_LOCAL_OWNER=1, porque fora do Cursor e da Vercel todo visitante vira essa conta.
export function isPlatformOwner(viewer: OwnerView, env: Record<string, string | undefined> = process.env): boolean {
  if (viewer.publicDemo) return false;
  if (viewer.simulatedViewer) return env.NODE_ENV !== "production" || env.RECEBEFACIL_LOCAL_OWNER === "1";
  const email = viewer.viewerEmail.trim().toLowerCase();
  if (!email) return false;
  const owners = (env.PLATFORM_OWNER_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return owners.includes(email);
}
