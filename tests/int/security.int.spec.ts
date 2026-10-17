import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import { GET as statusGet } from '@/app/api/tripp/status/route'
import { POST as readingPost } from '@/app/api/tripp/reading/route'
import { REST_GET, REST_PATCH, REST_POST } from '@payloadcms/next/routes'
import { bootstrapOwner, resetOwnerBootstrapForTests } from '@/lib/bootstrap-owner'

import { beforeAll, describe, expect, it } from 'vitest'

import { verifyUserEmail } from '../helpers/verify-user'

const password = 'test-password'
const restGet = REST_GET(config)
const restPost = REST_POST(config)
const restPatch = REST_PATCH(config)

let payload: Payload
let adminToken: string
let editorToken: string
let editorId: number
let otherId: number
let ownSessionId: number
let otherSessionId: number
let otherQuestion: string

function slugArgs(slug: string[]) {
  return { params: Promise.resolve({ slug }) }
}

function jsonRequest(path: string, body: unknown, token?: string, method = 'POST'): Request {
  return new Request(`http://localhost:3000${path}`, {
    method,
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

describe('security hardening', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    await payload.delete({
      collection: 'reading-sessions',
      where: { id: { exists: true } },
      overrideAccess: true,
    })
    await payload.delete({
      collection: 'users',
      where: { id: { exists: true } },
      overrideAccess: true,
    })
    await resetOwnerBootstrapForTests(payload)
    process.env.OWNER_BOOTSTRAP = '1'
    if ((await bootstrapOwner(payload, { password })) !== 'created') {
      throw new Error('owner bootstrap did not create an owner')
    }

    const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase()
    if (!ownerEmail) throw new Error('OWNER_EMAIL is not set for the test process')
    const ownerLogin = await restPost(
      jsonRequest('/api/users/login', { email: ownerEmail, password }),
      slugArgs(['users', 'login']),
    )
    const ownerBody = await readJson(ownerLogin)
    if (ownerLogin.status !== 200 || typeof ownerBody.token !== 'string') {
      throw new Error('owner login did not return a token')
    }

    const editor = await restPost(
      jsonRequest('/api/users', { email: 'security-editor@example.com', password, role: 'editor' }, ownerBody.token),
      slugArgs(['users']),
    )
    const other = await restPost(
      jsonRequest('/api/users', { email: 'security-other@example.com', password, role: 'viewer' }, ownerBody.token),
      slugArgs(['users']),
    )
    const editorBody = await readJson(editor)
    const otherBody = await readJson(other)
    const editorDoc = editorBody.doc as { id?: number }
    const otherDoc = otherBody.doc as { id?: number }
    if (editor.status !== 201 || other.status !== 201 || typeof editorDoc.id !== 'number' || typeof otherDoc.id !== 'number') {
      throw new Error('owner could not create the security fixtures')
    }
    editorId = editorDoc.id
    otherId = otherDoc.id
    await verifyUserEmail(payload, editorId)
    await verifyUserEmail(payload, otherId)

    const editorLogin = await restPost(
      jsonRequest('/api/users/login', { email: 'security-editor@example.com', password }),
      slugArgs(['users', 'login']),
    )
    const editorLoginBody = await readJson(editorLogin)
    if (typeof editorLoginBody.token !== 'string') throw new Error('editor login did not return a token')
    editorToken = editorLoginBody.token

    const admin = await restPost(
      jsonRequest('/api/users', { email: 'security-admin@example.com', password, role: 'admin' }, ownerBody.token),
      slugArgs(['users']),
    )
    const adminBody = await readJson(admin)
    const adminDoc = adminBody.doc as { id?: number }
    if (admin.status !== 201 || typeof adminDoc.id !== 'number') throw new Error('owner could not create the admin')
    await verifyUserEmail(payload, adminDoc.id)
    const adminLogin = await restPost(
      jsonRequest('/api/users/login', { email: 'security-admin@example.com', password }),
      slugArgs(['users', 'login']),
    )
    const adminLoginBody = await readJson(adminLogin)
    if (typeof adminLoginBody.token !== 'string') throw new Error('admin login did not return a token')
    adminToken = adminLoginBody.token

    otherQuestion = 'secret question from the other account'
    const own = await payload.create({
      collection: 'reading-sessions',
      data: { sessionId: 'security-own', question: 'editor own question', user: editorId },
      overrideAccess: true,
    })
    const foreign = await payload.create({
      collection: 'reading-sessions',
      data: { sessionId: 'security-other', question: otherQuestion, user: otherId, clientIp: '203.0.113.8' },
      overrideAccess: true,
    })
    ownSessionId = own.id
    otherSessionId = foreign.id

    await payload.create({
      collection: 'audit-logs',
      data: { action: 'LOGIN', actor: 'security-other@example.com', ipAddress: '203.0.113.9' },
      overrideAccess: true,
      context: { auditAppend: true },
    })
  }, 30_000)

  it('rejects an unverified account at login', async () => {
    const created = await restPost(
      jsonRequest(
        '/api/users',
        { email: 'security-unverified@example.com', password, role: 'viewer' },
        adminToken,
      ),
      slugArgs(['users']),
    )
    expect(created.status).toBe(201)
    const login = await restPost(
      jsonRequest('/api/users/login', { email: 'security-unverified@example.com', password }),
      slugArgs(['users', 'login']),
    )
    expect(login.status).toBe(403)
    const body = await readJson(login)
    expect(body.token).toBeUndefined()
  })

  it('hides another user reading session and audit logs from a non-admin', async () => {
    const foreign = await restGet(
      new Request(`http://localhost:3000/api/reading-sessions/${otherSessionId}`, {
        headers: { Authorization: `JWT ${editorToken}` },
      }),
      slugArgs(['reading-sessions', String(otherSessionId)]),
    )
    expect(foreign.status).toBe(404)
    const foreignBody = JSON.stringify(await foreign.json())
    expect(foreignBody).not.toContain(otherQuestion)

    const list = await restGet(
      new Request('http://localhost:3000/api/reading-sessions', {
        headers: { Authorization: `JWT ${editorToken}` },
      }),
      slugArgs(['reading-sessions']),
    )
    expect(list.status).toBe(200)
    const listBody = await readJson(list)
    const docs = listBody.docs as { id?: number; question?: string }[]
    expect(docs.some((doc) => doc.id === ownSessionId)).toBe(true)
    expect(docs.some((doc) => doc.id === otherSessionId || doc.question === otherQuestion)).toBe(false)

    const logs = await restGet(
      new Request('http://localhost:3000/api/audit-logs', {
        headers: { Authorization: `JWT ${editorToken}` },
      }),
      slugArgs(['audit-logs']),
    )
    expect(logs.status).toBe(403)

    const adminLogs = await restGet(
      new Request('http://localhost:3000/api/audit-logs', {
        headers: { Authorization: `JWT ${adminToken}` },
      }),
      slugArgs(['audit-logs']),
    )
    expect(adminLogs.status).toBe(200)

    const createdLog = await restPost(
      jsonRequest('/api/audit-logs', { action: 'CARD_EDIT', actor: 'security-editor@example.com' }, adminToken),
      slugArgs(['audit-logs']),
    )
    expect(createdLog.status).toBe(403)

    const patched = await restPatch(
      jsonRequest(`/api/reading-sessions/${otherSessionId}`, { question: 'taken' }, editorToken, 'PATCH'),
      slugArgs(['reading-sessions', String(otherSessionId)]),
    )
    expect(patched.status).toBe(403)
  })

  it('returns 429 when the auth and tripp limits are exceeded', async () => {
    const loginHeaders = {
      'Content-Type': 'application/json',
      'x-rate-limit-test': 'security-login',
    }
    const loginStatuses: number[] = []
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await restPost(
        new Request('http://localhost:3000/api/users/login', {
          method: 'POST',
          headers: loginHeaders,
          body: JSON.stringify({ email: 'nobody-security@example.com', password }),
        }),
        slugArgs(['users', 'login']),
      )
      loginStatuses.push(response.status)
    }
    expect(loginStatuses.slice(0, 3).every((status) => status !== 429)).toBe(true)
    expect(loginStatuses[3]).toBe(429)

    const trippStatuses: number[] = []
    let limitedBody: Record<string, unknown> | undefined
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await statusGet(
        new Request('http://localhost/api/tripp/status', {
          headers: { 'x-rate-limit-test': 'security-tripp' },
        }),
      )
      trippStatuses.push(response.status)
      if (response.status === 429) limitedBody = await readJson(response)
    }
    expect(trippStatuses.slice(0, 3).every((status) => status === 200)).toBe(true)
    expect(trippStatuses[3]).toBe(429)
    expect(limitedBody?.error).toBe('Too many requests')
    expect(typeof limitedBody?.requestId).toBe('string')
  })

  it('returns a generic 500 with a request id', async () => {
    const response = await readingPost(
      new Request('http://localhost/api/tripp/reading', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-rate-limit-test': 'security-reading-error',
        },
        body: JSON.stringify({
          spreadId: 'daily',
          cardIds: [{ id: 999, orientation: 'upright' }],
        }),
      }),
    )
    expect(response.status).toBe(500)
    const body = await readJson(response)
    expect(body.error).toBe('Internal server error')
    expect(typeof body.requestId).toBe('string')
    expect(JSON.stringify(body)).not.toContain('card_id')
  })
})
