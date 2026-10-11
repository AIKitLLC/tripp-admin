import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import { POST } from '@/app/api/tripp/seed/route'
import { REST_POST } from '@payloadcms/next/routes'
import { DECK_SIZE } from '@/lib/tripp/cards'
import { SPREAD_CONFIGS } from '@/lib/tripp/spreads'

import { describe, it, beforeAll, expect } from 'vitest'

const password = 'test-password'
const adminEmail = 'seed-admin@example.com'
const editorEmail = 'seed-editor@example.com'
const restPost = REST_POST(config)

type SeedResult = {
  ok: boolean
  seededCards: number
  seededSpreads: number
  error?: string
}

type StoredUser = {
  id: number
  email: string
  role: string
}

let payload: Payload
let ownerToken: string
let adminToken: string
let editorToken: string

function configuredOwnerEmail(): string {
  const email = process.env.OWNER_EMAIL?.trim().toLowerCase()
  if (!email) throw new Error('OWNER_EMAIL is not set for the test process')
  return email
}

function slugArgs(slug: string[]) {
  return { params: Promise.resolve({ slug }) }
}

function jsonRequest(path: string, body: unknown, token?: string): Request {
  return new Request(`http://localhost:3000${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `JWT ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>
}

function userFromResponse(body: Record<string, unknown>): StoredUser {
  const doc = (body.doc ?? body.user ?? body) as Partial<StoredUser>
  if (typeof doc.id !== 'number' || typeof doc.email !== 'string' || typeof doc.role !== 'string') {
    throw new Error('user response did not include id, email, and role')
  }
  return { id: doc.id, email: doc.email, role: doc.role }
}

async function login(email: string): Promise<string> {
  const response = await restPost(
    jsonRequest('/api/users/login', { email, password }),
    slugArgs(['users', 'login']),
  )
  const body = await readJson(response)
  if (response.status !== 200 || typeof body.token !== 'string') {
    throw new Error(`login did not return a token for ${email}`)
  }
  return body.token
}

async function createUser(email: string, role: string, token?: string): Promise<StoredUser> {
  const response = await restPost(
    jsonRequest('/api/users', { email, password, role }, token),
    slugArgs(['users']),
  )
  const body = await readJson(response)
  if (response.status !== 201) {
    throw new Error(`create ${email} returned ${response.status}`)
  }
  return userFromResponse(body)
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
    await payload.delete({
      collection: 'users',
      where: { id: { exists: true } },
      overrideAccess: true,
    })

    const ownerEmail = configuredOwnerEmail()
    const owner = await createUser(ownerEmail, 'viewer')
    expect(owner.role).toBe('owner')
    ownerToken = await login(ownerEmail)

    const admin = await createUser(adminEmail, 'admin', ownerToken)
    expect(admin.role).toBe('admin')
    const editor = await createUser(editorEmail, 'editor', ownerToken)
    expect(editor.role).toBe('editor')

    adminToken = await login(adminEmail)
    editorToken = await login(editorEmail)
  }, 30_000)

  it('returns 401 when unauthenticated', async () => {
    const before = await catalogCounts()
    const response = await POST(seedRequest())
    expect(response.status).toBe(401)
    expect(await catalogCounts()).toEqual(before)
  })

  it('returns 403 for a non-admin', async () => {
    const before = await catalogCounts()
    const response = await POST(seedRequest(editorToken))
    expect(response.status).toBe(403)
    expect(await catalogCounts()).toEqual(before)
  })

  it('seeds for an admin created by the owner and a second call does not duplicate rows', async () => {
    await clearCatalog()

    const first = await POST(seedRequest(adminToken))
    expect(first.status).toBe(200)
    const firstBody = (await first.json()) as SeedResult
    expect(firstBody.ok).toBe(true)
    expect(firstBody.seededCards).toBe(DECK_SIZE)
    expect(firstBody.seededSpreads).toBe(SPREAD_CONFIGS.length)

    const second = await POST(seedRequest(adminToken))
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
    const response = await POST(seedRequest(ownerToken))
    expect(response.status).toBe(200)
    const body = (await response.json()) as SeedResult
    expect(body.ok).toBe(true)
  })
})
