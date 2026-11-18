export default function PagarNaoEncontrado() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-xl font-bold text-slate-900">Não encontramos este pagamento</h1>
      <p className="text-sm text-slate-600">O link pode estar incompleto ou o pagamento foi apagado. Peça um novo link para quem enviou este.</p>
    </main>
  );
}
