"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { loginAction } from "@/app/actions";
import { buttonClass, inputClass } from "@/components/ui";

export default function EntrarPage() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <h1 className="text-2xl font-semibold">Entrar</h1>
      <p className="mt-1 text-sm text-[#64748B]">A empresa entra com o e-mail e a senha do cadastro. Esta tela não usa a identidade do Cursor.</p>
      <form
        className="mt-6 grid gap-3"
        onSubmit={async (event) => {
          event.preventDefault();
          const result = await loginAction(new FormData(event.currentTarget));
          if (!result.ok) setMessage(result.error);
          else router.push("/");
        }}
      >
        <input name="email" type="email" required className={inputClass} aria-label="E-mail" placeholder="email@empresa.com" />
        <input name="password" type="password" required className={inputClass} aria-label="Senha" />
        <button className={buttonClass} type="submit">Entrar</button>
        {message ? <p className="text-sm text-[#EF4444]">{message}</p> : null}
      </form>
      <Link className="mt-4 text-sm text-teal-700" href="/cadastrar">Cadastrar empresa</Link>
    </main>
  );
}
