import { cents, formatBRL, type Cents } from "@/lib/money";

export function money(value: number) {
  return formatBRL(cents(value));
}

export function Title({ children, hint }: { children: React.ReactNode; hint: string }) {
  return (
    <div className="mb-5">
      <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{children}</h1>
      <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">{hint}</p>
    </div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm ${className}`}>{children}</section>;
}

export function Status({ value }: { value: string }) {
  const tone =
    value === "paga" || value === "ativo" || value === "ativa" || value === "concluido"
      ? "bg-emerald-50 text-emerald-700"
      : value === "vencida" || value === "cancelada" || value === "estornada"
        ? "bg-red-50 text-red-700"
        : value === "parcial" || value === "suspensa"
          ? "bg-amber-50 text-amber-700"
          : "bg-slate-100 text-slate-700";
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>{value}</span>;
}

export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[#E2E8F0] bg-white">
      <table className="min-w-full text-left text-sm">{children}</table>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-[#0F172A]">{label}</span>
      {children}
    </label>
  );
}

export const inputClass = "w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm outline-none focus:border-[#2563EB]";
export const buttonClass = "rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60";

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed border-[#E2E8F0] bg-white p-8 text-center text-sm text-[#64748B]">{children}</p>;
}

export type { Cents };
