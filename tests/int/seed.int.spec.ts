import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import { POST } from '@/app/api/tripp/seed/route'
import { DECK_SIZE } from '@/lib/tripp/cards'
import { SPREAD_CONFIGS } from '@/lib/tripp/spreads'

import { describe, it, beforeAll, expect } from 'vitest'

const password = 'test-password'

type SeedResult = {
  ok: boolean
  seededCards: number
  seededSpreads: number
  error?: string
}

let payload: Payload

async function replaceUser(email: string, role: 'admin' | 'editor' | 'owner'): Promise<void> {
  await payload.delete({
    collection: 'users',
    where: { email: { equals: email } },
    overrideAccess: true,
  })

  await payload.create({
    collection: 'users',
    data: { email, password, role },
    overrideAccess: true,
  })
}

async function tokenFor(email: string): Promise<string> {
  const result = await payload.login({
    collection: 'users',
    data: { email, password },
  })
  if (!result.token) throw new Error(`login did not return a token for ${email}`)
  return result.token
}

function seedRequest(token?: string): Request {
  return new Request('http://localhost/api/tripp/seed', {
    method: 'POST',
    headers: token ? { Authorization: `JWT ${token}` } : undefined,
  })
}

async function catalogCounts(): Promise<{ cards: number; spreads: number }> {
  const cards = await payload.count({ collection: 'cards' })
  const spreads = await payload.count({ collection: 'spreads' })
  return { cards: cards.totalDocs, spreads: spreads.totalDocs }
}

async function clearCatalog(): Promise<void> {
  await payload.delete({
    collection: 'cards',
    where: { id: { exists: true } },
    overrideAccess: true,
  })
  await payload.delete({
    collection: 'spreads',
    where: { id: { exists: true } },
    overrideAccess: true,
  })
}

describe('POST /api/tripp/seed', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    await replaceUser('seed-admin@example.com', 'admin')
    await replaceUser('seed-editor@example.com', 'editor')
    await replaceUser('seed-owner@example.com', 'owner')
  })

  it('returns 401 when unauthenticated', async () => {
    const before = await catalogCounts()
    const response = await POST(seedRequest())
    expect(response.status).toBe(401)
    expect(await catalogCounts()).toEqual(before)
  })

  it('returns 403 for a non-admin', async () => {
    const before = await catalogCounts()
    const token = await tokenFor('seed-editor@example.com')
    const response = await POST(seedRequest(token))
    expect(response.status).toBe(403)
    expect(await catalogCounts()).toEqual(before)
  })

  it('seeds for an admin and a second call does not duplicate rows', async () => {
    await clearCatalog()
    const token = await tokenFor('seed-admin@example.com')

    const first = await POST(seedRequest(token))
    expect(first.status).toBe(200)
    const firstBody = (await first.json()) as SeedResult
    expect(firstBody.ok).toBe(true)
    expect(firstBody.seededCards).toBe(DECK_SIZE)
    expect(firstBody.seededSpreads).toBe(SPREAD_CONFIGS.length)

    const second = await POST(seedRequest(token))
    expect(second.status).toBe(200)
    const secondBody = (await second.json()) as SeedResult
    expect(secondBody.ok).toBe(true)
    expect(secondBody.seededCards).toBe(0)
    expect(secondBody.seededSpreads).toBe(0)
    expect(await catalogCounts()).toEqual({
      cards: DECK_SIZE,
      spreads: SPREAD_CONFIGS.length,
    })
  }, 30_000)

  it('allows an owner', async () => {
    const token = await tokenFor('seed-owner@example.com')
    const response = await POST(seedRequest(token))
    expect(response.status).toBe(200)
    const body = (await response.json()) as SeedResult
    expect(body.ok).toBe(true)
  })
})
