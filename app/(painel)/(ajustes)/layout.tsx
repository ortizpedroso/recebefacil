import { SettingsTabs, type SettingsTab } from "@/components/settings-tabs";
import { isPlatformOwner } from "@/lib/platform-owner";
import { requireSession } from "@/lib/session";

const TABS: SettingsTab[] = [
  { href: "/configuracoes", label: "Minha empresa" },
  { href: "/recebimentos", label: "Recebimentos" },
  { href: "/equipe", label: "Equipe" },
  { href: "/ajuda", label: "Ajuda" },
];

export default async function AjustesLayout({ children }: { children: React.ReactNode }) {
  const owner = isPlatformOwner(await requireSession());
  return (
    <>
      <SettingsTabs tabs={owner ? [...TABS, { href: "/plataforma", label: "Plataforma" }] : TABS} />
      {children}
    </>
  );
}
