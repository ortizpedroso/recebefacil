"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signupAction } from "@/app/actions";
import { buttonClass, inputClass } from "@/components/ui";
import { maskCnpj } from "@/lib/masks";

export default function CadastrarPage() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [document, setDocument] = useState("");
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <h1 className="text-2xl font-semibold">Cadastrar empresa</h1>
      <p className="mt-1 text-sm text-[#64748B]">A empresa nasce vazia, com o nome e o CNPJ que você informar.</p>
      <form
        className="mt-6 grid gap-3"
        onSubmit={async (event) => {
          event.preventDefault();
          const result = await signupAction(new FormData(event.currentTarget));
          if (!result.ok) setMessage(result.error);
          else router.push("/");
        }}
      >
        <input name="tradeName" required className={inputClass} aria-label="Nome fantasia" placeholder="Nome fantasia" />
        <input name="legalName" required className={inputClass} aria-label="Razão social" placeholder="Razão social" />
        <input name="document" required value={document} onChange={(event) => setDocument(maskCnpj(event.target.value))} className={inputClass} aria-label="CNPJ" placeholder="00.000.000/0000-00" />
        <input name="email" type="email" required className={inputClass} aria-label="E-mail" placeholder="email@empresa.com" />
        <input name="password" type="password" required minLength={8} className={inputClass} aria-label="Senha" placeholder="Senha" />
        <button className={buttonClass} type="submit">Criar empresa</button>
        {message ? <p className="text-sm text-[#EF4444]">{message}</p> : null}
      </form>
      <Link className="mt-4 text-sm text-teal-700" href="/entrar">Já tenho conta</Link>
    </main>
  );
}
