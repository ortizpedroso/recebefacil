export type OwnerView = {
  publicDemo: boolean;
  viewerEmail: string;
  simulatedViewer: boolean;
};

// Só o dono da plataforma vê as credenciais. A conta de teste local conta como dono para quem desenvolve, nunca em produção.
export function isPlatformOwner(viewer: OwnerView, env: Record<string, string | undefined> = process.env): boolean {
  if (viewer.publicDemo) return false;
  if (viewer.simulatedViewer) return env.NODE_ENV !== "production";
  const email = viewer.viewerEmail.trim().toLowerCase();
  if (!email) return false;
  const owners = (env.PLATFORM_OWNER_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return owners.includes(email);
}
