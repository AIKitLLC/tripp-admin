import { afterEach, describe, expect, it, vi } from 'vitest'

import { resolvePayloadSecret } from '@/lib/payload-secret'

vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: async () => ({
    env: {},
    cf: {},
    ctx: {},
    caches: {},
  }),
}))

const LOCAL_PLACEHOLDER = 'local-dev-only-placeholder'

async function importProductionConfig(): Promise<void> {
  vi.resetModules()
  await import('@/payload.config')
}

describe('payload secret', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it.each([
    ['missing', ''],
    ['shorter than 32 characters', 'too-short'],
    ['a local placeholder', LOCAL_PLACEHOLDER],
    ['a long placeholder', 'placeholder-value-padding-padding-padding'],
  ])('refuses to start in production when PAYLOAD_SECRET is %s', async (_label, secret) => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('NEXT_PHASE', '')
    vi.stubEnv('PAYLOAD_SECRET', secret)

    let thrown: unknown
    try {
      await importProductionConfig()
    } catch (error) {
      thrown = error
    }

    expect(thrown).toBeInstanceOf(Error)
    const message = thrown instanceof Error ? thrown.message : String(thrown)
    expect(message).toMatch(/PAYLOAD_SECRET/)
    if (secret) expect(message).not.toContain(secret)
  })

  it('does not apply the production check during the Next build phase', () => {
    expect(
      resolvePayloadSecret({
        nodeEnv: 'production',
        nextPhase: 'phase-production-build',
      }),
    ).toBe('next-build-placeholder-not-a-secret')
  })

  it('accepts a non-placeholder secret of at least 32 characters in production', () => {
    const secret = 'a'.repeat(48)
    expect(
      resolvePayloadSecret({
        nodeEnv: 'production',
        envSecret: secret,
      }),
    ).toBe(secret)
  })

  it('allows the local placeholder outside production', () => {
    expect(
      resolvePayloadSecret({
        nodeEnv: 'development',
        envSecret: LOCAL_PLACEHOLDER,
      }),
    ).toBe(LOCAL_PLACEHOLDER)
  })
})
