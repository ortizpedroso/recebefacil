import Link from "next/link";

export default function NaoEncontrado() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-xl font-bold text-slate-900">Página não encontrada</h1>
      <p className="text-sm text-slate-600">O endereço não existe ou mudou de lugar.</p>
      <Link href="/" className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800">
        Ir para o início
      </Link>
    </main>
  );
}
