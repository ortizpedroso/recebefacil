"use client"

import { useActionState, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import type { ActionState } from "../app/actions"

type Action = (state: ActionState | null, formData: FormData) => Promise<ActionState>

export function PlainForm({
  action,
  children,
  submitLabel,
}: {
  action: Action
  children: React.ReactNode
  submitLabel: string
}) {
  const [state, formAction, pending] = useActionState(action, null)
  const router = useRouter()
  useEffect(() => {
    if (state?.ok) router.refresh()
  }, [state, router])
  return (
    <form action={formAction}>
      {children}
      <button type="submit" disabled={pending}>
        {pending ? "Salvando…" : submitLabel}
      </button>
      {state ? <p className={state.ok ? "ok" : "bad"}>{state.notice}</p> : null}
    </form>
  )
}

export function KeyedForm({
  action,
  storageKey,
  children,
  submitLabel,
}: {
  action: Action
  storageKey: string
  children: React.ReactNode
  submitLabel: string
}) {
  const [state, formAction, pending] = useActionState(action, null)
  const [key, setKey] = useState("")
  const router = useRouter()
  useEffect(() => {
    const existing = sessionStorage.getItem(storageKey)
    const value = existing ?? crypto.randomUUID()
    if (!existing) sessionStorage.setItem(storageKey, value)
    setKey(value)
  }, [storageKey])
  useEffect(() => {
    if (!state?.ok) return
    const next = crypto.randomUUID()
    sessionStorage.setItem(storageKey, next)
    setKey(next)
    router.refresh()
  }, [state, storageKey, router])
  return (
    <form action={formAction}>
      <input type="hidden" name="idempotencyKey" value={key} />
      {children}
      <button type="submit" disabled={pending || key.length === 0}>
        {pending ? "Salvando…" : submitLabel}
      </button>
      {state ? <p className={state.ok ? "ok" : "bad"}>{state.notice}</p> : null}
    </form>
  )
}

export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className="secondary"
      onClick={async () => {
        await navigator.clipboard.writeText(value)
        setCopied(true)
      }}
    >
      {copied ? "Copiado" : "Copiar PIX"}
    </button>
  )
}
