import type { PayloadRequest } from 'payload'

import { readNextPhase } from './payload-secret'

export const MISSING_OWNER_EMAIL_LOG =
  'OWNER_EMAIL is not set; refusing to create an owner. Set it with `wrangler secret put OWNER_EMAIL`.'

let bindingOwnerEmail: string | undefined
let missingOwnerEmailLogged = false

export function normalizeEmail(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim().toLowerCase()
  return normalized.length > 0 ? normalized : undefined
}

function readEnvOwnerEmail(env: object | undefined): string | undefined {
  if (!env || !('OWNER_EMAIL' in env)) return undefined
  return normalizeEmail((env as { OWNER_EMAIL?: unknown }).OWNER_EMAIL)
}

/** Captures the Worker binding. Process env still wins when it is set. */
export function rememberOwnerEmailBinding(env: object | undefined): void {
  const fromBinding = readEnvOwnerEmail(env)
  if (fromBinding) bindingOwnerEmail = fromBinding
}

export function readOwnerEmail(): string | undefined {
  return normalizeEmail(process.env.OWNER_EMAIL) ?? bindingOwnerEmail
}

export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === 'production' && readNextPhase() !== 'phase-production-build'
}

export function isOwnerEmail(email: unknown): boolean {
  const ownerEmail = readOwnerEmail()
  const candidate = normalizeEmail(email)
  return Boolean(ownerEmail && candidate && ownerEmail === candidate)
}

export function logMissingOwnerEmail(req: PayloadRequest): void {
  if (missingOwnerEmailLogged || !isProductionRuntime() || readOwnerEmail()) return
  missingOwnerEmailLogged = true
  req.payload.logger?.error(MISSING_OWNER_EMAIL_LOG)
  console.error(MISSING_OWNER_EMAIL_LOG)
}
