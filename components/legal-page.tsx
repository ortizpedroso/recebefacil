import { Card } from "@/components/ui";
import type { LegalDocument } from "@/lib/legal";

export function LegalPage({ document }: { document: LegalDocument }) {
  return (
    <Card>
      <p className="mb-4 text-[13px] text-slate-500">Vigente desde {document.updatedOn}.</p>
        <div className="space-y-5 text-sm leading-6 text-[#334155]">
          {document.sections.map((section) => (
            <section key={section.title} className="space-y-2">
              <h2 className="font-bold text-slate-900">{section.title}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {section.items ? (
                <ul className="list-disc space-y-1 pl-5">
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>
    </Card>
  );
}
