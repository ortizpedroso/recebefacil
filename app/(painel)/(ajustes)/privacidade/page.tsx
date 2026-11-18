import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { PRIVACY } from "@/lib/legal";

export const metadata: Metadata = { title: PRIVACY.title };

export default function PrivacidadePage() {
  return <LegalPage document={PRIVACY} />;
}
