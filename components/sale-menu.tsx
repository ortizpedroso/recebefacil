"use client";

import { MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cancelSaleAction, contractForSaleAction, deleteSaleAction, endSubscriptionAction } from "@/app/actions";
import { FormError, Modal } from "./dialog";
import { Menu, MenuItem } from "./menu";
import { toast } from "./toast";
import { dangerButtonClass, buttonClass, secondaryButtonClass } from "./ui";

export type SaleMenuProps = {
  saleId: string;
  contractId: string | null;
  cancelled: boolean;
  hasReceived: boolean;
  subscriptionActive: boolean;
  can: { edit: boolean; delete: boolean; cancel: boolean; contract: boolean; end: boolean };
};

type Ask = "cancel" | "delete" | "end" | null;

const COPY: Record<Exclude<Ask, null>, { title: string; text: string; confirm: string }> = {
  cancel: { title: "Cancelar esta venda?", text: "O que ainda não foi pago deixa de ser cobrado e os produtos voltam para o estoque. A venda continua no histórico como cancelada.", confirm: "Cancelar venda" },
  delete: { title: "Excluir esta venda?", text: "A venda, as parcelas e o contrato são apagados de vez. Isso não pode ser desfeito.", confirm: "Excluir venda" },
  end: { title: "Encerrar a mensalidade?", text: "Não serão geradas novas cobranças. As que já venceram ou estão em aberto continuam valendo.", confirm: "Encerrar mensalidade" },
};

export function SaleMenu({ saleId, contractId, cancelled, hasReceived, subscriptionActive, can }: SaleMenuProps) {
  const router = useRouter();
  const [ask, setAsk] = useState<Ask>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const blocked = (ask === "cancel" || ask === "delete") && hasReceived;

  async function confirm() {
    if (!ask) return;
    setPending(true);
    setError("");
    const result = ask === "cancel" ? await cancelSaleAction(saleId) : ask === "delete" ? await deleteSaleAction(saleId) : await endSubscriptionAction(saleId);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setAsk(null);
    if (ask === "delete") {
      toast("Venda excluída.");
      router.push("/vendas");
      return;
    }
    toast(ask === "cancel" ? "Venda cancelada." : "Mensalidade encerrada.");
    router.refresh();
  }

  async function contract() {
    if (contractId) {
      router.push(`/contratos/${contractId}/imprimir`);
      return;
    }
    const result = await contractForSaleAction(saleId);
    if (!result.ok) {
      toast(result.error);
      return;
    }
    router.push(`/contratos/${result.contractId}/imprimir`);
  }

  const none = !(can.edit || can.contract || can.end || can.cancel || can.delete);
  if (none) return null;
  return (
    <>
      <Menu label="Mais opções da venda" className={`${secondaryButtonClass}`} trigger={<><MoreHorizontal className="h-4 w-4" /> Mais</>}>
        {can.edit && !cancelled && !hasReceived ? <MenuItem href={`/vendas/${saleId}/editar`}>Editar venda</MenuItem> : null}
        {can.contract && !cancelled ? <MenuItem onSelect={contract}>{contractId ? "Ver contrato" : "Gerar contrato"}</MenuItem> : null}
        {can.end && subscriptionActive ? <MenuItem onSelect={() => setAsk("end")}>Encerrar mensalidade</MenuItem> : null}
        {can.cancel && !cancelled ? (
          <MenuItem danger onSelect={() => setAsk("cancel")}>
            Cancelar venda
          </MenuItem>
        ) : null}
        {can.delete && !cancelled && !hasReceived ? (
          <MenuItem danger onSelect={() => setAsk("delete")}>
            Excluir venda
          </MenuItem>
        ) : null}
      </Menu>
      <Modal open={ask !== null} onOpenChange={(value) => !value && (setAsk(null), setError(""))} title={ask ? COPY[ask].title : ""}>
        {ask ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">{blocked ? "Esta venda já tem pagamento recebido. Desfaça os recebimentos na lista de pagamentos primeiro, com o botão de três pontos de cada linha." : COPY[ask].text}</p>
            <FormError message={error} />
            <div className="flex justify-end gap-2">
              <button type="button" className={secondaryButtonClass} onClick={() => setAsk(null)}>
                {blocked ? "Entendi" : "Voltar"}
              </button>
              {blocked ? null : (
                <button type="button" className={ask === "end" ? buttonClass : dangerButtonClass} disabled={pending} onClick={confirm}>
                  {pending ? "Aguarde..." : COPY[ask].confirm}
                </button>
              )}
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
