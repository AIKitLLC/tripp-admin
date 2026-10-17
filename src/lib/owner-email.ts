let bindingOwnerEmail: string | undefined

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

export function isOwnerEmail(email: unknown): boolean {
  const ownerEmail = readOwnerEmail()
  const candidate = normalizeEmail(email)
  return Boolean(ownerEmail && candidate && ownerEmail === candidate)
}
