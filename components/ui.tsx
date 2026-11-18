import Link from "next/link";
import { TONE_CLASS, type Badge } from "@/lib/labels";
import { cents, formatBRL, type Cents } from "@/lib/money";

export function money(value: number) {
  return formatBRL(cents(value));
}

export function Title({ children, hint, action }: { children: React.ReactNode; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{children}</h1>
        {hint ? <p className="mt-0.5 text-sm text-slate-500">{hint}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm ${className}`}>{children}</section>;
}

export function Pill({ badge }: { badge: Badge }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE_CLASS[badge.tone]}`}>{badge.label}</span>;
}

export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[#E2E8F0] bg-white">
      <table className="min-w-full text-left text-sm">{children}</table>
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-[#0F172B]">
        {label}
        {hint ? <span className="ml-1.5 font-normal text-slate-500">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

export const inputClass = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/15";
export const buttonClass = "inline-flex items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60";
export const secondaryButtonClass = "inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60";
export const smallButtonClass = "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-semibold text-slate-800 hover:border-slate-300 hover:bg-slate-50";
export const smallPrimaryClass = "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-teal-700 px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-teal-800";
export const dangerButtonClass = "inline-flex items-center justify-center gap-2 rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800 disabled:opacity-60";

export function Avatar({ name, className = "h-10 w-10 text-sm" }: { name: string; className?: string }) {
  const letters = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return <span className={`flex shrink-0 items-center justify-center rounded-full bg-slate-100 font-semibold text-slate-500 ${className}`}>{letters || "?"}</span>;
}

const PALETTE = ["bg-teal-700", "bg-violet-600", "bg-orange-700", "bg-sky-700", "bg-red-700", "bg-lime-700", "bg-fuchsia-700", "bg-slate-700"];

function paletteFor(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

// Foto do produto, ou as iniciais sobre uma cor fixa para o mesmo item ter sempre a mesma cara.
export function ProductPhoto({ name, photoId, src, className = "aspect-[4/3] w-full text-3xl" }: { name: string; photoId?: string | null; src?: string; className?: string }) {
  if (photoId || src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src ?? `/api/fotos/${photoId}`} alt="" loading="lazy" className={`bg-slate-100 object-cover ${className}`} />;
  }
  const letters = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return (
    <span aria-hidden="true" className={`flex items-center justify-center font-bold text-white/90 ${paletteFor(name)} ${className}`}>
      {letters}
    </span>
  );
}

export function Empty({ title, children, action }: { title?: string; children: React.ReactNode; action?: { href: string; label: string } | React.ReactNode }) {
  const button =
    action && typeof action === "object" && "href" in action ? (
      <Link href={action.href} className={buttonClass}>
        {action.label}
      </Link>
    ) : (
      action
    );
  return (
    <div className="rounded-xl border border-dashed border-[#E2E8F0] bg-white p-8 text-center">
      {title ? <p className="text-sm font-semibold text-slate-900">{title}</p> : null}
      <p className={`mx-auto max-w-md text-sm text-[#64748B] ${title ? "mt-1" : ""}`}>{children}</p>
      {button ? <div className="mt-4 flex justify-center">{button}</div> : null}
    </div>
  );
}

export type { Cents };
