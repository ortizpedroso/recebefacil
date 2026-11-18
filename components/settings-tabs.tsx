"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Title } from "./ui";

export type SettingsTab = { href: string; label: string; hint?: string };

export function SettingsTabs({ tabs }: { tabs: SettingsTab[] }) {
  const pathname = usePathname();
  const current = tabs.find((tab) => pathname === tab.href || pathname.startsWith(`${tab.href}/`));
  return (
    <>
      {current ? <Title hint={current.hint}>{current.label}</Title> : null}
      <nav aria-label="Configurações" className="-mx-4 my-4 overflow-x-auto overflow-y-hidden border-b border-[#E2E8F0] px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-1">
          {tabs.map((tab) => {
            const on = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={on ? "page" : undefined}
                className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm ${on ? "border-teal-700 font-semibold text-teal-800" : "border-transparent font-medium text-slate-500 hover:text-slate-900"}`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
