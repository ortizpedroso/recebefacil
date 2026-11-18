import { SettingsTabs, type SettingsTab } from "@/components/settings-tabs";
import { isPlatformOwner } from "@/lib/platform-owner";
import { PRIVACY, TERMS } from "@/lib/legal";
import { requireSession } from "@/lib/session";

const TABS: SettingsTab[] = [
  { href: "/configuracoes", label: "Minha empresa", hint: "Estes dados aparecem no recibo, no contrato e no link de pagamento." },
  { href: "/recebimentos", label: "Recebimentos", hint: "Como você recebe e o que seu cliente vê quando abre o link de pagamento." },
  { href: "/saque", label: "Saque e taxas", hint: "Seu saldo no Asaas, saque por Pix e todas as taxas, sem letra miúda." },
  { href: "/equipe", label: "Equipe", hint: "Quem usa o RecebeFácil na sua empresa e o que cada pessoa pode fazer." },
  { href: "/ajuda", label: "Ajuda", hint: "Respostas rápidas e um jeito de falar com a gente." },
  { href: "/termos", label: "Termos", hint: TERMS.hint },
  { href: "/privacidade", label: "Privacidade", hint: PRIVACY.hint },
];

export default async function AjustesLayout({ children }: { children: React.ReactNode }) {
  const owner = isPlatformOwner(await requireSession());
  return (
    <>
      <SettingsTabs tabs={owner ? [...TABS, { href: "/plataforma", label: "Plataforma", hint: "Credenciais do Asaas, taxa e planos. Só o dono da plataforma vê esta página." }] : TABS} />
      {children}
    </>
  );
}
