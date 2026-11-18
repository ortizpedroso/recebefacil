"use client";

import { useRouter } from "next/navigation";
import { eraseClientAction } from "@/app/actions";
import { ConfirmAction } from "./confirm-action";
import { toast } from "./toast";
import { smallButtonClass } from "./ui";

export function ClientPrivacyActions({ clientId, clientName }: { clientId: string; clientName: string }) {
  const router = useRouter();
  return (
    <>
      <a href={`/api/clientes/${clientId}/export`} className={smallButtonClass}>
        Exportar dados
      </a>
      <ConfirmAction
        label="Apagar dados"
        confirmLabel="Apagar dados do cliente"
        message={`Os dados pessoais de ${clientName} saem do sistema e não dá para desfazer. Se houver venda, cobrança ou contrato, esse histórico fica guardado sem nome nem contato, porque a lei manda guardar registro fiscal e de pagamento. Sem histórico, o cadastro é apagado.`}
        className="text-sm font-semibold text-rose-700 hover:underline"
        danger
        action={async () => {
          const result = await eraseClientAction(clientId);
          if (!result.ok) return result;
          toast(result.outcome === "apagado" ? "Cliente apagado." : "Dados pessoais apagados. O histórico fiscal ficou guardado.");
          router.push("/clientes");
          return result;
        }}
      />
    </>
  );
}
