const MINIMUM_PRODUCTION_SECRET_LENGTH = 32
const NEXT_BUILD_PHASE = 'phase-production-build'
const NEXT_BUILD_PLACEHOLDER = 'next-build-placeholder-not-a-secret'

const PLACEHOLDER_MARKERS = [
  'placeholder',
  'change-me',
  'changeme',
  'dev-only',
  'local-dev',
  'not-a-secret',
]

export type PayloadSecretInput = {
  envSecret?: string
  bindingSecret?: string
  nodeEnv?: string
  nextPhase?: string
}

export function isValidProductionPayloadSecret(secret: string | undefined): boolean {
  if (!secret) return false
  const value = secret.trim()
  if (value.length < MINIMUM_PRODUCTION_SECRET_LENGTH) return false
  const normalized = value.toLowerCase()
  return !PLACEHOLDER_MARKERS.some((marker) => normalized.includes(marker))
}

export function readBindingSecret(env: object | undefined): string | undefined {
  if (!env) return undefined
  const value = (env as { PAYLOAD_SECRET?: unknown }).PAYLOAD_SECRET
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined
}

/** Indirect read so the Next bundler does not inline the build-phase flag into the worker. */
export function readNextPhase(): string | undefined {
  const env = process.env
  return env.NEXT_PHASE
}

export function resolvePayloadSecret(input: PayloadSecretInput): string {
  const secret = input.envSecret?.trim() || input.bindingSecret?.trim() || ''
  const production = input.nodeEnv === 'production'
  const nextBuild = input.nextPhase === NEXT_BUILD_PHASE

  if (production && !nextBuild) {
    if (!isValidProductionPayloadSecret(secret)) {
      throw new Error(
        'PAYLOAD_SECRET must be a non-placeholder value of at least 32 characters in production. Generate a new one with `openssl rand -base64 48` and set it with `wrangler secret put PAYLOAD_SECRET`.',
      )
    }
    return secret
  }

  if (secret) return secret
  if (nextBuild) return NEXT_BUILD_PLACEHOLDER
  throw new Error(
    'PAYLOAD_SECRET is not set. Copy .dev.vars.example to .dev.vars for local development.',
  )
}
