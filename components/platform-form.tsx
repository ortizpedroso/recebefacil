"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { generateWebhookTokenAction, savePlatformAction, testPlatformConnectionAction } from "@/app/actions";
import { maskMoney } from "@/lib/masks";
import { formatPercentBp } from "@/lib/money";
import type { PlatformSettingsView } from "@/lib/platform-settings";
import { CopyButton } from "./copy-button";
import { FormError } from "./dialog";
import { toast } from "./toast";
import { buttonClass, Card, Field, inputClass, secondaryButtonClass } from "./ui";

const reais = (value: number) => maskMoney(String(value));
const ENVIRONMENT_LABEL = { sandbox: "Sandbox", producao: "Produção" } as const;

function secretPlaceholder(secret: PlatformSettingsView["apiKey"], empty: string) {
  return secret.configured ? `configurada ••••${secret.hint}` : empty;
}

export function PlatformForm({ view, webhookUrl, events }: { view: PlatformSettingsView; webhookUrl: string; events: string[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [newToken, setNewToken] = useState("");
  const [testing, setTesting] = useState(false);
  const [connection, setConnection] = useState<{ ok: true; text: string } | { ok: false; text: string } | null>(null);

  async function generate() {
    setError("");
    const result = await generateWebhookTokenAction();
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNewToken(result.token);
    router.refresh();
  }

  function show(result: Awaited<ReturnType<typeof testPlatformConnectionAction>>) {
    setConnection(result.ok ? { ok: true, text: `Conectado a ${result.accountName || "uma conta Asaas"} · ambiente ${ENVIRONMENT_LABEL[result.environment]} · carteira ••••${result.walletTail}` } : { ok: false, text: result.error });
  }

  async function test() {
    setTesting(true);
    setConnection(null);
    const result = await testPlatformConnectionAction();
    setTesting(false);
    show(result);
    if (result.ok) router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card>
        <form
          className="space-y-5"
          autoComplete="off"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            setPending(true);
            setError("");
            const result = await savePlatformAction(new FormData(form));
            setPending(false);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            // Os campos de segredo voltam em branco: o que foi salvo nunca volta para a tela.
            form.querySelectorAll<HTMLInputElement>('input[type="password"]').forEach((input) => (input.value = ""));
            if (result.connection) show(result.connection);
            toast(result.connection && !result.connection.ok ? "Configuração salva, mas o Asaas recusou a conexão." : "Configuração da plataforma salva.");
            router.refresh();
          }}
        >
          <h2 className="font-bold text-slate-900">Conexão com o Asaas</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Ambiente" hint="comece pelo Sandbox">
              <select name="environment" className={inputClass} defaultValue={view.environment}>
                <option value="sandbox">Sandbox (testes)</option>
                <option value="producao">Produção (dinheiro de verdade)</option>
              </select>
            </Field>
            <Field label="Chave de API do Asaas" hint="deixe em branco para manter">
              <input name="apiKey" type="password" autoComplete="new-password" className={inputClass} placeholder={secretPlaceholder(view.apiKey, "cole a chave da conta da plataforma")} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Token do webhook" hint="deixe em branco para manter">
                <div className="flex gap-2">
                  <input name="webhookToken" type="password" autoComplete="new-password" className={inputClass} placeholder={secretPlaceholder(view.webhookToken, "gere um token ou cole o seu (32 a 255 caracteres)")} />
                  <button type="button" className={secondaryButtonClass} onClick={generate}>
                    Gerar token
                  </button>
                </div>
              </Field>
            </div>
          </div>
          {newToken ? (
            <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm font-semibold text-amber-900">Copie este token agora e cole no Asaas. Ele não será mostrado de novo.</p>
              <div className="flex gap-2">
                <input readOnly value={newToken} aria-label="Token do webhook gerado" className="min-w-0 flex-1 rounded-lg border border-amber-200 bg-white px-3 py-2 font-mono text-xs text-slate-800" />
                <CopyButton text={newToken} className={secondaryButtonClass} doneMessage="Token copiado">
                  Copiar
                </CopyButton>
              </div>
              <button type="button" className="text-sm font-semibold text-amber-900 hover:underline" onClick={() => setNewToken("")}>
                Já copiei, esconder
              </button>
            </div>
          ) : null}

          <h2 className="pt-2 font-bold text-slate-900">Taxa e planos</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Taxa da plataforma por transação (%)" hint="fica na sua conta Asaas">
              <input name="fee" className={inputClass} inputMode="decimal" defaultValue={formatPercentBp(view.feeBp)} />
            </Field>
            <Field label="Preço do plano Gestão (R$)">
              <input name="planGestao" className={inputClass} inputMode="numeric" defaultValue={reais(view.planGestaoCents)} onChange={(event) => (event.target.value = maskMoney(event.target.value))} />
            </Field>
            <Field label="Preço do plano Integrado (R$)">
              <input name="planIntegrado" className={inputClass} inputMode="numeric" defaultValue={reais(view.planIntegradoCents)} onChange={(event) => (event.target.value = maskMoney(event.target.value))} />
            </Field>
          </div>

          <FormError message={error} />
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className={buttonClass} disabled={pending}>
              {pending ? "Salvando..." : "Salvar"}
            </button>
            <p className="text-sm text-slate-500">{view.updatedAt ? `Salvo por ${view.updatedBy || "alguém"}.` : "Ainda não foi salvo."}</p>
          </div>
        </form>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-bold text-slate-900">Testar a conexão</h2>
        <p className="text-sm text-slate-600">Ao salvar, a carteira da plataforma é buscada no Asaas com a chave salva. Use este botão para conferir de novo.</p>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={buttonClass} disabled={testing || !view.apiKey.configured} onClick={test}>
            {testing ? "Testando..." : "Testar conexão"}
          </button>
          {view.walletId && !connection ? (
            <p className="text-sm text-emerald-700">
              Conectado a {view.accountName || "uma conta Asaas"} · ambiente {ENVIRONMENT_LABEL[view.environment]} · carteira ••••{view.walletId.slice(-6)}
            </p>
          ) : null}
        </div>
        {connection ? <p className={`rounded-lg px-3 py-2 text-sm ${connection.ok ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"}`}>{connection.text}</p> : null}
        <p className="text-sm text-slate-500">{view.ready ? "Tudo pronto: os lojistas já podem ligar o modo Integrado." : "Falta chave válida ou token do webhook para os lojistas poderem usar o modo Integrado."}</p>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-bold text-slate-900">Webhook no Asaas</h2>
        <p className="text-sm text-slate-600">No Asaas, abra Configurações da conta, Integrações, Webhooks e crie um webhook de cobranças e assinaturas com o endereço e o token abaixo. Deixe a fila sequencial e ative os eventos listados. Os de assinatura (SUBSCRIPTION) valem para a mensalidade dos lojistas.</p>
        <div className="flex gap-2">
          <input readOnly value={webhookUrl} aria-label="Endereço do webhook" className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800" />
          <CopyButton text={webhookUrl} className={secondaryButtonClass} doneMessage="Endereço copiado">
            Copiar
          </CopyButton>
        </div>
        <ul className="grid gap-1 text-sm text-slate-700 sm:grid-cols-2">
          {events.map((name) => (
            <li key={name} className="font-mono text-xs">
              {name}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
