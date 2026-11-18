import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { TERMS } from "@/lib/legal";

export const metadata: Metadata = { title: TERMS.title };

export default function TermosPage() {
  return <LegalPage document={TERMS} />;
}
