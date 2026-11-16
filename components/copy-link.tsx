"use client";

export function CopyLink({ path }: { path: string }) {
  return (
    <button
      type="button"
      className="text-xs text-[#2563EB]"
      onClick={() => navigator.clipboard.writeText(`${window.location.origin}${path}`)}
    >
      Copiar link
    </button>
  );
}
