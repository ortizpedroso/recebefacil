import "server-only"
import { headers } from "next/headers"
import { getIdentity } from "../cursor/identity.js"
import { viewerId, type ViewerId } from "./domain/money"

function isViewer(value: unknown): value is { verified: true; sub: string; stage: "production" | "preview" } {
  if (typeof value !== "object" || value === null) return false
  if (!("verified" in value) || value.verified !== true) return false
  if (!("sub" in value) || typeof value.sub !== "string" || value.sub.length === 0) return false
  if (!("stage" in value)) return false
  if (value.stage !== "production" && value.stage !== "preview") return false
  return true
}

export async function currentViewer(): Promise<ViewerId | null> {
  const headerList = await headers()
  const identity = await getIdentity(headerList)
  if (!isViewer(identity)) return null
  return viewerId(`${identity.stage}:${identity.sub}`)
}
