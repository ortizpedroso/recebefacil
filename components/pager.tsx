import Link from "next/link";

export function Pager({ page, pages, path }: { page: number; pages: number; path: string }) {
  return (
    <p className="mt-3 flex items-center gap-3 text-sm text-[#64748B]">
      <span>Página {page} de {pages}</span>
      {page > 1 ? <Link className="text-teal-700" href={`${path}?pagina=${page - 1}`}>Anterior</Link> : null}
      {page < pages ? <Link className="text-teal-700" href={`${path}?pagina=${page + 1}`}>Próxima</Link> : null}
    </p>
  );
}
