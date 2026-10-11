import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'

import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import {
  GRAPHQL_POST,
  REST_DELETE,
  REST_GET,
  REST_PATCH,
  REST_POST,
} from '@payloadcms/next/routes'

import { describe, it, beforeAll, expect } from 'vitest'

const password = 'test-password'
const replacementPassword = 'replacement-password'
const adminEmail = 'access-admin@example.com'
const secondAdminEmail = 'access-admin-two@example.com'
const editorEmail = 'access-editor@example.com'
const viewerEmail = 'access-viewer@example.com'
const promoteeEmail = 'access-promotee@example.com'

const restGet = REST_GET(config)
const restPost = REST_POST(config)
const restPatch = REST_PATCH(config)
const restDelete = REST_DELETE(config)
const graphqlPost = GRAPHQL_POST(config)

type UserRole = 'owner' | 'admin' | 'editor' | 'viewer'

type StoredUser = {
  id: number
  email: string
  role: UserRole
}

type GraphqlBody = {
  data?: Record<string, unknown> | null
  errors?: { message?: string; extensions?: { statusCode?: number } }[]
}

let payload: Payload
let owner: StoredUser
let admin: StoredUser
let secondAdmin: StoredUser
let editor: StoredUser
let viewer: StoredUser
let promotee: StoredUser
let ownerToken: string
let adminToken: string
let editorToken: string
let viewerToken: string

function configuredOwnerEmail(): string {
  const email = process.env.OWNER_EMAIL?.trim().toLowerCase()
  if (!email) throw new Error('OWNER_EMAIL is not set for the test process')
  return email
}

function mixedCaseEmail(email: string): string {
  return email.replace(/[a-z]/g, (char, index) => (index % 2 === 0 ? char.toUpperCase() : char))
}

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

function userFromResponse(body: Record<string, unknown>): StoredUser {
  const doc = (body.doc ?? body.user ?? body) as Partial<StoredUser>
  if (typeof doc.id !== 'number' || typeof doc.email !== 'string' || typeof doc.role !== 'string') {
    throw new Error('user response did not include id, email, and role')
  }
  return { id: doc.id, email: doc.email, role: doc.role as UserRole }
}

async function login(email: string, userPassword: string): Promise<{ status: number; token?: string }> {
  const response = await restPost(
    jsonRequest('/api/users/login', { email, password: userPassword }),
    slugArgs(['users', 'login']),
  )
  const body = await readJson(response)
  const token = typeof body.token === 'string' ? body.token : undefined
  return { status: response.status, token }
}

async function storedUser(id: number): Promise<StoredUser> {
  const user = await payload.findByID({
    collection: 'users',
    id,
    overrideAccess: true,
  })
  return { id: user.id, email: user.email, role: user.role }
}

async function wipeUsers(): Promise<void> {
  await payload.delete({
    collection: 'users',
    where: { id: { exists: true } },
    overrideAccess: true,
  })
}

async function createUser(
  email: string,
  role: UserRole | undefined,
  token?: string,
): Promise<{ status: number; user?: StoredUser }> {
  const response = await restPost(
    jsonRequest('/api/users', { email, password, ...(role ? { role } : {}) }, token),
    slugArgs(['users']),
  )
  if (response.status !== 201) return { status: response.status }
  return { status: response.status, user: userFromResponse(await readJson(response)) }
}

async function patchRole(id: number, role: UserRole, token: string): Promise<Response> {
  return restPatch(
    jsonRequest(`/api/users/${id}`, { role }, token, 'PATCH'),
    slugArgs(['users', String(id)]),
  )
}

async function graphql(
  query: string,
  variables?: Record<string, unknown>,
  token?: string,
): Promise<{ status: number; body: GraphqlBody }> {
  const response = await graphqlPost(
    new Request('http://localhost:3000/api/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `JWT ${token}` } : {}),
      },
      body: JSON.stringify({ query, variables }),
    }),
  )
  const body = (await response.json()) as GraphqlBody
  return { status: response.status, body }
}

function graphqlWasRefused(status: number, body: GraphqlBody): boolean {
  if (status === 401 || status === 403) return true
  return (body.errors ?? []).some((error) => {
    const code = error.extensions?.statusCode
    return code === 401 || code === 403
  })
}

function headerValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

async function readIncomingBody(incoming: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of incoming) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

async function forwardUsersPost(incoming: IncomingMessage, outgoing: ServerResponse): Promise<void> {
  const url = new URL(incoming.url ?? '/', 'http://127.0.0.1')
  const slug = url.pathname.replace(/^\/api\//, '').split('/').filter(Boolean)
  const body = await readIncomingBody(incoming)
  const headers = new Headers()
  const contentType = headerValue(incoming.headers['content-type'])
  if (contentType) headers.set('content-type', contentType)
  const request = new Request(`http://127.0.0.1${url.pathname}`, {
    method: incoming.method,
    headers,
    body: incoming.method === 'GET' || incoming.method === 'HEAD' ? undefined : new Uint8Array(body),
  })
  const response = await restPost(request, slugArgs(slug))
  const responseBody = Buffer.from(await response.arrayBuffer())
  const responseType = response.headers.get('content-type')
  outgoing.writeHead(response.status, responseType ? { 'content-type': responseType } : {})
  outgoing.end(responseBody)
}

async function withUsersHttpServer<T>(run: (baseUrl: string) => Promise<T>): Promise<T> {
  const server = createServer((incoming, outgoing) => {
    forwardUsersPost(incoming, outgoing).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'request failed'
      if (!outgoing.headersSent) outgoing.writeHead(500, { 'content-type': 'text/plain' })
      outgoing.end(message)
    })
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve())
  })

  const address = server.address()
  if (!address || typeof address === 'string') {
    server.close()
    throw new Error('users HTTP server did not bind a port')
  }

  try {
    return await run(`http://127.0.0.1:${address.port}`)
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()))
    })
  }
}

async function postSignupOverHttp(
  baseUrl: string,
  email: string,
  role?: UserRole,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await fetch(`${baseUrl}/api/users`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password, ...(role ? { role } : {}) }),
  })
  return { status: response.status, body: (await response.json()) as Record<string, unknown> }
}

async function patchUser(id: number, data: Record<string, unknown>, token: string): Promise<Response> {
  return restPatch(jsonRequest(`/api/users/${id}`, data, token, 'PATCH'), slugArgs(['users', String(id)]))
}

async function deleteUser(id: number, token: string): Promise<Response> {
  return restDelete(
    new Request(`http://localhost:3000/api/users/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `JWT ${token}` },
    }),
    slugArgs(['users', String(id)]),
  )
}

async function requireCreatedUser(email: string, role: UserRole): Promise<StoredUser> {
  const created = await createUser(email, role, ownerToken)
  if (!created.user) throw new Error(`owner could not create ${email}`)
  return created.user
}

async function storedRecord(id: number) {
  return payload.findByID({
    collection: 'users',
    id,
    overrideAccess: true,
  })
}

async function userStillExists(id: number): Promise<boolean> {
  const found = await payload.find({
    collection: 'users',
    where: { id: { equals: id } },
    overrideAccess: true,
    limit: 1,
  })
  return found.totalDocs === 1
}

describe('Users collection access', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  }, 30_000)

  it('gives OWNER_EMAIL the owner role and leaves every other signup a viewer', async () => {
    await wipeUsers()
    const ownerEmail = configuredOwnerEmail()

    const firstForm = await restPost(
      jsonRequest('/api/users/first-register', {
        email: 'first-form@example.com',
        password,
        role: 'admin',
      }),
      slugArgs(['users', 'first-register']),
    )
    expect(firstForm.status).toBe(200)
    const firstUser = userFromResponse(await readJson(firstForm))
    expect(firstUser.role).toBe('viewer')
    expect((await storedUser(firstUser.id)).role).toBe('viewer')

    await wipeUsers()

    const emptyDatabase = await createUser('empty-db-viewer@example.com', 'owner')
    expect(emptyDatabase.status).toBe(201)
    expect(emptyDatabase.user?.role).toBe('viewer')
    expect((await storedUser(emptyDatabase.user!.id)).role).toBe('viewer')

    await wipeUsers()

    const created = await createUser(mixedCaseEmail(ownerEmail), 'viewer')
    expect(created.status).toBe(201)
    owner = created.user as StoredUser
    expect(owner.role).toBe('owner')
    expect(owner.email).toBe(ownerEmail)
    expect((await storedUser(owner.id)).role).toBe('owner')

    const later = await createUser('later-viewer@example.com', 'admin')
    expect(later.status).toBe(201)
    expect(later.user?.role).toBe('viewer')
    expect((await storedUser(later.user!.id)).role).toBe('viewer')
  }, 30_000)

  it('keeps a single owner when empty-database signups run together', async () => {
    await wipeUsers()
    const ownerEmail = configuredOwnerEmail()
    const signups = [
      { email: mixedCaseEmail(ownerEmail), role: 'editor' as const },
      { email: 'race-owner-claim@example.com', role: 'owner' as const },
      { email: 'race-admin-claim@example.com', role: 'admin' as const },
      { email: 'race-editor@example.com', role: 'editor' as const },
      { email: 'race-viewer@example.com', role: 'viewer' as const },
      { email: 'race-omitted@example.com' },
    ]

    const responses = await withUsersHttpServer((baseUrl) =>
      Promise.all(signups.map((signup) => postSignupOverHttp(baseUrl, signup.email, signup.role))),
    )

    for (const response of responses) {
      expect(response.status).toBe(201)
    }

    const users = await payload.find({
      collection: 'users',
      overrideAccess: true,
      limit: 20,
    })
    const owners = users.docs.filter((user) => user.role === 'owner')
    expect(owners).toHaveLength(1)
    expect(owners[0]?.email).toBe(ownerEmail)
    for (const user of users.docs) {
      if (user.email !== ownerEmail) expect(user.role).toBe('viewer')
    }
  }, 30_000)

  it('lets one of two simultaneous OWNER_EMAIL signups win the unique email', async () => {
    await wipeUsers()
    const ownerEmail = configuredOwnerEmail()

    const responses = await withUsersHttpServer((baseUrl) =>
      Promise.all([
        postSignupOverHttp(baseUrl, ownerEmail),
        postSignupOverHttp(baseUrl, mixedCaseEmail(ownerEmail)),
      ]),
    )

    const created = responses.filter((response) => response.status === 201)
    const rejected = responses.filter((response) => response.status !== 201)
    expect(created).toHaveLength(1)
    expect(rejected).toHaveLength(1)
    const rejectedText = JSON.stringify(rejected[0]?.body).toLowerCase()
    const lostOnInsert = rejected[0]?.status === 500 && rejectedText.includes('something went wrong')
    const lostOnValidation = rejected[0]?.status === 400 && /unique|duplicate|already/.test(rejectedText)
    expect(lostOnInsert || lostOnValidation).toBe(true)

    const users = await payload.find({
      collection: 'users',
      overrideAccess: true,
      limit: 10,
    })
    const owners = users.docs.filter((user) => user.role === 'owner')
    expect(users.docs).toHaveLength(1)
    expect(owners).toHaveLength(1)
    expect(owners[0]?.email).toBe(ownerEmail)
  }, 30_000)

  describe('authenticated rules', () => {
    beforeAll(async () => {
      await wipeUsers()
      const ownerEmail = configuredOwnerEmail()
      const createdOwner = await createUser(ownerEmail, 'viewer')
      if (createdOwner.status !== 201 || createdOwner.user?.role !== 'owner') {
        throw new Error('OWNER_EMAIL signup did not create an owner')
      }
      owner = createdOwner.user

      const ownerSession = await login(ownerEmail, password)
      if (!ownerSession.token) throw new Error('owner login did not return a token')
      ownerToken = ownerSession.token

      const createdAdmin = await createUser(adminEmail, 'admin', ownerToken)
      const createdSecondAdmin = await createUser(secondAdminEmail, 'admin', ownerToken)
      const createdEditor = await createUser(editorEmail, 'editor', ownerToken)
      const createdViewer = await createUser(viewerEmail, 'viewer', ownerToken)
      const createdPromotee = await createUser(promoteeEmail, 'viewer', ownerToken)
      if (
        !createdAdmin.user ||
        !createdSecondAdmin.user ||
        !createdEditor.user ||
        !createdViewer.user ||
        !createdPromotee.user
      ) {
        throw new Error('owner could not create the role fixtures')
      }
      admin = createdAdmin.user
      secondAdmin = createdSecondAdmin.user
      editor = createdEditor.user
      viewer = createdViewer.user
      promotee = createdPromotee.user
      expect(admin.role).toBe('admin')
      expect(secondAdmin.role).toBe('admin')
      expect(editor.role).toBe('editor')
      expect(viewer.role).toBe('viewer')

      const adminSession = await login(adminEmail, password)
      const editorSession = await login(editorEmail, password)
      const viewerSession = await login(viewerEmail, password)
      if (!adminSession.token || !editorSession.token || !viewerSession.token) {
        throw new Error('fixture login did not return a token')
      }
      adminToken = adminSession.token
      editorToken = editorSession.token
      viewerToken = viewerSession.token
    }, 30_000)

    it('refuses a viewer changing any role', async () => {
      const ownRole = await patchRole(viewer.id, 'editor', viewerToken)
      expect(ownRole.status).toBe(403)
      expect((await storedUser(viewer.id)).role).toBe('viewer')

      const otherRole = await patchRole(editor.id, 'viewer', viewerToken)
      expect(otherRole.status).toBe(403)
      expect((await storedUser(editor.id)).role).toBe('editor')
    })

    it('lets an admin change viewer and editor roles in both directions', async () => {
      const toEditor = await patchRole(viewer.id, 'editor', adminToken)
      expect(toEditor.status).toBe(200)
      expect((await storedUser(viewer.id)).role).toBe('editor')

      const backToViewer = await patchRole(viewer.id, 'viewer', adminToken)
      expect(backToViewer.status).toBe(200)
      expect((await storedUser(viewer.id)).role).toBe('viewer')

      const toViewer = await patchRole(editor.id, 'viewer', adminToken)
      expect(toViewer.status).toBe(200)
      expect((await storedUser(editor.id)).role).toBe('viewer')

      const backToEditor = await patchRole(editor.id, 'editor', adminToken)
      expect(backToEditor.status).toBe(200)
      expect((await storedUser(editor.id)).role).toBe('editor')
    })

    it('blocks an admin from setting admin or owner and from demoting an admin', async () => {
      const toAdmin = await patchRole(editor.id, 'admin', adminToken)
      expect(toAdmin.status).toBe(403)
      expect((await storedUser(editor.id)).role).toBe('editor')

      const toOwner = await patchRole(editor.id, 'owner', adminToken)
      expect(toOwner.status).toBe(403)
      expect((await storedUser(editor.id)).role).toBe('editor')

      const demoteAdmin = await patchRole(secondAdmin.id, 'editor', adminToken)
      expect(demoteAdmin.status).toBe(403)
      expect((await storedUser(secondAdmin.id)).role).toBe('admin')

      const ownRole = await patchRole(admin.id, 'editor', adminToken)
      expect(ownRole.status).toBe(403)
      expect((await storedUser(admin.id)).role).toBe('admin')

      const createAdmin = await createUser('access-planted-admin@example.com', 'admin', adminToken)
      expect(createAdmin.status).toBe(403)

      const createOwner = await createUser('access-planted-owner@example.com', 'owner', adminToken)
      expect(createOwner.status).toBe(403)
    })

    it('lets an owner grant and revoke admin', async () => {
      const granted = await patchRole(promotee.id, 'admin', ownerToken)
      expect(granted.status).toBe(200)
      expect((await storedUser(promotee.id)).role).toBe('admin')

      const revoked = await patchRole(promotee.id, 'editor', ownerToken)
      expect(revoked.status).toBe(200)
      expect((await storedUser(promotee.id)).role).toBe('editor')

      const restored = await patchRole(promotee.id, 'viewer', ownerToken)
      expect(restored.status).toBe(200)
      expect((await storedUser(promotee.id)).role).toBe('viewer')
    })

    it('refuses an owner granting the owner role', async () => {
      const update = await patchRole(promotee.id, 'owner', ownerToken)
      expect(update.status).toBe(403)
      expect((await storedUser(promotee.id)).role).toBe('viewer')

      const create = await createUser('access-second-owner@example.com', 'owner', ownerToken)
      expect(create.status).toBe(403)
    })

    it('lets an owner change another user role and lets an editor update their own record', async () => {
      const demoted = await patchRole(editor.id, 'viewer', ownerToken)
      expect(demoted.status).toBe(200)
      expect((await storedUser(editor.id)).role).toBe('viewer')

      const restored = await patchRole(editor.id, 'editor', ownerToken)
      expect(restored.status).toBe(200)
      expect((await storedUser(editor.id)).role).toBe('editor')

      const ownUpdate = await restPatch(
        jsonRequest(`/api/users/${editor.id}`, { telegramId: 'editor-self' }, editorToken, 'PATCH'),
        slugArgs(['users', String(editor.id)]),
      )
      expect(ownUpdate.status).toBe(200)

      const ownRead = await restGet(
        new Request(`http://localhost:3000/api/users/${editor.id}`, {
          headers: { Authorization: `JWT ${editorToken}` },
        }),
        slugArgs(['users', String(editor.id)]),
      )
      expect(ownRead.status).toBe(200)
    })

    it('refuses an editor promoting itself to owner over REST and GraphQL', async () => {
      const rest = await patchRole(editor.id, 'owner', editorToken)
      expect(rest.status).toBe(403)
      expect((await storedUser(editor.id)).role).toBe('editor')

      const graph = await graphql(
        `mutation UpdateRole($id: Int!) {
          updateUser(id: $id, data: { role: owner }) { id role }
        }`,
        { id: editor.id },
        editorToken,
      )
      expect(graphqlWasRefused(graph.status, graph.body)).toBe(true)
      expect((await storedUser(editor.id)).role).toBe('editor')
    })

    it('refuses an admin setting the owner role over REST and GraphQL', async () => {
      const restUpdate = await patchRole(editor.id, 'owner', adminToken)
      expect(restUpdate.status).toBe(403)
      expect((await storedUser(editor.id)).role).toBe('editor')

      const graphUpdate = await graphql(
        `mutation UpdateRole($id: Int!) {
          updateUser(id: $id, data: { role: owner }) { id role }
        }`,
        { id: editor.id },
        adminToken,
      )
      expect(graphqlWasRefused(graphUpdate.status, graphUpdate.body)).toBe(true)
      expect((await storedUser(editor.id)).role).toBe('editor')

      const graphCreate = await graphql(
        `mutation CreateOwner($email: String!, $password: String!) {
          createUser(data: { email: $email, password: $password, role: owner }) { id role }
        }`,
        { email: 'access-planted-owner-graphql@example.com', password },
        adminToken,
      )
      expect(graphqlWasRefused(graphCreate.status, graphCreate.body)).toBe(true)

      const ownerRoleChange = await patchRole(owner.id, 'admin', adminToken)
      expect(ownerRoleChange.status).toBe(403)
      expect((await storedUser(owner.id)).role).toBe('owner')
    })

    it('refuses an anonymous listing of users over REST and GraphQL', async () => {
      const rest = await restGet(new Request('http://localhost:3000/api/users'), slugArgs(['users']))
      expect(rest.status).toBe(403)

      const graph = await graphql(`query { Users { docs { id email } } }`)
      expect(graphqlWasRefused(graph.status, graph.body)).toBe(true)
      expect(graph.body.data?.Users).toBeFalsy()
    })

    it('refuses an admin editing an owner password over REST and GraphQL', async () => {
      const rest = await restPatch(
        jsonRequest(`/api/users/${owner.id}`, { password: replacementPassword }, adminToken, 'PATCH'),
        slugArgs(['users', String(owner.id)]),
      )
      expect(rest.status).toBe(403)

      const graph = await graphql(
        `mutation UpdatePassword($id: Int!, $password: String) {
          updateUser(id: $id, data: { password: $password }) { id }
        }`,
        { id: owner.id, password: replacementPassword },
        adminToken,
      )
      expect(graphqlWasRefused(graph.status, graph.body)).toBe(true)

      const original = await login(configuredOwnerEmail(), password)
      expect(original.status).toBe(200)
      const replaced = await login(configuredOwnerEmail(), replacementPassword)
      expect(replaced.status).not.toBe(200)
    })

    it('refuses an admin changing an owner status', async () => {
      const before = await payload.findByID({
        collection: 'users',
        id: owner.id,
        overrideAccess: true,
      })

      const response = await restPatch(
        jsonRequest(`/api/users/${owner.id}`, { status: 'suspended' }, adminToken, 'PATCH'),
        slugArgs(['users', String(owner.id)]),
      )
      expect(response.status).toBe(403)

      const after = await payload.findByID({
        collection: 'users',
        id: owner.id,
        overrideAccess: true,
      })
      expect(after.status).toBe(before.status)
      expect(after.role).toBe('owner')
      expect(after.email).toBe(configuredOwnerEmail())
    })

    it('refuses an admin changing an owner email or deleting an owner', async () => {
      const emailChange = await restPatch(
        jsonRequest(
          `/api/users/${owner.id}`,
          { email: 'access-taken-over@example.com' },
          adminToken,
          'PATCH',
        ),
        slugArgs(['users', String(owner.id)]),
      )
      expect(emailChange.status).toBe(403)
      expect((await storedUser(owner.id)).email).toBe(configuredOwnerEmail())

      const deleted = await restDelete(
        new Request(`http://localhost:3000/api/users/${owner.id}`, {
          method: 'DELETE',
          headers: { Authorization: `JWT ${adminToken}` },
        }),
        slugArgs(['users', String(owner.id)]),
      )
      expect(deleted.status).toBe(403)
      expect((await storedUser(owner.id)).email).toBe(configuredOwnerEmail())
    })

    it('refuses demoting or deleting the last owner', async () => {
      const demoted = await patchRole(owner.id, 'admin', ownerToken)
      expect(demoted.status).toBe(403)
      expect((await storedUser(owner.id)).role).toBe('owner')

      const deleted = await restDelete(
        new Request(`http://localhost:3000/api/users/${owner.id}`, {
          method: 'DELETE',
          headers: { Authorization: `JWT ${ownerToken}` },
        }),
        slugArgs(['users', String(owner.id)]),
      )
      expect(deleted.status).toBe(403)
      const remaining = await storedUser(owner.id)
      expect(remaining.role).toBe('owner')
      expect(remaining.email).toBe(configuredOwnerEmail())
    })

    it('lets an admin edit and delete viewer and editor accounts', async () => {
      const staffViewer = await requireCreatedUser('access-staff-viewer@example.com', 'viewer')
      const staffEditor = await requireCreatedUser('access-staff-editor@example.com', 'editor')

      const viewerFields = await patchUser(
        staffViewer.id,
        {
          telegramId: 'viewer-managed',
          email: 'access-staff-viewer-renamed@example.com',
          password: replacementPassword,
        },
        adminToken,
      )
      expect(viewerFields.status).toBe(200)
      const storedViewer = await storedRecord(staffViewer.id)
      expect(storedViewer.email).toBe('access-staff-viewer-renamed@example.com')
      expect(storedViewer.telegramId).toBe('viewer-managed')
      expect(storedViewer.role).toBe('viewer')
      expect((await login('access-staff-viewer-renamed@example.com', replacementPassword)).status).toBe(200)

      const editorFields = await patchUser(
        staffEditor.id,
        {
          telegramId: 'editor-managed',
          email: 'access-staff-editor-renamed@example.com',
          password: replacementPassword,
        },
        adminToken,
      )
      expect(editorFields.status).toBe(200)
      const storedEditor = await storedRecord(staffEditor.id)
      expect(storedEditor.email).toBe('access-staff-editor-renamed@example.com')
      expect(storedEditor.telegramId).toBe('editor-managed')
      expect(storedEditor.role).toBe('editor')
      expect((await login('access-staff-editor-renamed@example.com', replacementPassword)).status).toBe(200)

      expect((await deleteUser(staffViewer.id, adminToken)).status).toBe(200)
      expect(await userStillExists(staffViewer.id)).toBe(false)
      expect((await deleteUser(staffEditor.id, adminToken)).status).toBe(200)
      expect(await userStillExists(staffEditor.id)).toBe(false)
    })

    it('lets an admin edit their own non-role fields', async () => {
      const selfAdmin = await requireCreatedUser('access-self-admin@example.com', 'admin')
      const session = await login(selfAdmin.email, password)
      if (!session.token) throw new Error('self admin login did not return a token')

      const updated = await patchUser(
        selfAdmin.id,
        {
          telegramId: 'self-admin',
          email: 'access-self-admin-renamed@example.com',
          password: replacementPassword,
        },
        session.token,
      )
      expect(updated.status).toBe(200)
      const stored = await storedRecord(selfAdmin.id)
      expect(stored.telegramId).toBe('self-admin')
      expect(stored.email).toBe('access-self-admin-renamed@example.com')
      expect(stored.role).toBe('admin')

      const renamed = await login('access-self-admin-renamed@example.com', replacementPassword)
      expect(renamed.status).toBe(200)
      expect((await login(selfAdmin.email, password)).status).not.toBe(200)
      if (!renamed.token) throw new Error('renamed admin login did not return a token')

      const ownRole = await patchRole(selfAdmin.id, 'owner', renamed.token)
      expect(ownRole.status).toBe(403)
      expect((await storedUser(selfAdmin.id)).role).toBe('admin')
    })

    it('refuses an admin editing or deleting another admin', async () => {
      const other = await requireCreatedUser('access-other-admin@example.com', 'admin')
      const before = await storedRecord(other.id)

      expect((await patchUser(other.id, { email: 'access-other-admin-taken@example.com' }, adminToken)).status).toBe(
        403,
      )
      expect((await patchUser(other.id, { password: replacementPassword }, adminToken)).status).toBe(403)
      expect((await patchUser(other.id, { telegramId: 'taken' }, adminToken)).status).toBe(403)
      expect((await patchUser(other.id, { status: 'suspended' }, adminToken)).status).toBe(403)

      const after = await storedRecord(other.id)
      expect(after.email).toBe(before.email)
      expect(after.telegramId).toBe(before.telegramId)
      expect(after.status).toBe(before.status)
      expect(after.role).toBe('admin')
      expect((await login(other.email, password)).status).toBe(200)
      expect((await login(other.email, replacementPassword)).status).not.toBe(200)

      expect((await deleteUser(other.id, adminToken)).status).toBe(403)
      expect(await userStillExists(other.id)).toBe(true)
      expect((await storedUser(other.id)).role).toBe('admin')
    })

    it('lets an owner change another admin credentials and delete that admin', async () => {
      const target = await requireCreatedUser('access-owner-managed-admin@example.com', 'admin')

      expect((await patchUser(target.id, { password: replacementPassword }, ownerToken)).status).toBe(200)
      expect((await login(target.email, password)).status).not.toBe(200)
      expect((await login(target.email, replacementPassword)).status).toBe(200)

      const renamedEmail = 'access-owner-managed-admin-renamed@example.com'
      expect((await patchUser(target.id, { email: renamedEmail }, ownerToken)).status).toBe(200)
      expect((await storedUser(target.id)).email).toBe(renamedEmail)
      expect((await storedUser(target.id)).role).toBe('admin')
      expect((await login(renamedEmail, replacementPassword)).status).toBe(200)

      expect((await deleteUser(target.id, ownerToken)).status).toBe(200)
      expect(await userStillExists(target.id)).toBe(false)
    })
  })
})
