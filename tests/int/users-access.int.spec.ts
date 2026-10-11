import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import { POST as seedPost } from '@/app/api/tripp/seed/route'
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
const ownerEmail = 'access-owner@example.com'
const adminEmail = 'access-admin@example.com'
const editorEmail = 'access-editor@example.com'

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
let editor: StoredUser
let ownerToken: string
let adminToken: string
let editorToken: string

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
  const doc = (body.doc ?? body) as Partial<StoredUser>
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

describe('Users collection access', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('makes the first user an owner so seed stays reachable', async () => {
    await payload.delete({
      collection: 'users',
      where: { id: { exists: true } },
      overrideAccess: true,
    })

    const created = await restPost(
      jsonRequest('/api/users', {
        email: ownerEmail,
        password,
        role: 'editor',
      }),
      slugArgs(['users']),
    )
    expect(created.status).toBe(201)
    owner = userFromResponse(await readJson(created))
    expect(owner.role).toBe('owner')
    expect((await storedUser(owner.id)).role).toBe('owner')

    const second = await restPost(
      jsonRequest('/api/users', {
        email: 'access-second@example.com',
        password,
        role: 'owner',
      }),
      slugArgs(['users']),
    )
    expect(second.status).toBe(403)

    const session = await login(ownerEmail, password)
    expect(session.status).toBe(200)
    expect(session.token).toBeTruthy()
    ownerToken = session.token as string

    const seeded = await seedPost(
      new Request('http://localhost:3000/api/tripp/seed', {
        method: 'POST',
        headers: { Authorization: `JWT ${ownerToken}` },
      }),
    )
    expect(seeded.status).toBe(200)
    const seedBody = (await seeded.json()) as { ok?: boolean }
    expect(seedBody.ok).toBe(true)
  }, 30_000)

  describe('authenticated rules', () => {
    beforeAll(async () => {
      await payload.delete({
        collection: 'users',
        where: { email: { in: [adminEmail, editorEmail] } },
        overrideAccess: true,
      })

      const createdAdmin = await payload.create({
        collection: 'users',
        data: { email: adminEmail, password, role: 'admin' },
        overrideAccess: true,
      })
      const createdEditor = await payload.create({
        collection: 'users',
        data: { email: editorEmail, password, role: 'editor' },
        overrideAccess: true,
      })
      editor = { id: createdEditor.id, email: createdEditor.email, role: createdEditor.role }
      if (createdAdmin.role !== 'admin') {
        throw new Error('admin fixture was not stored as admin')
      }

      const adminSession = await login(adminEmail, password)
      const editorSession = await login(editorEmail, password)
      if (!adminSession.token || !editorSession.token) {
        throw new Error('fixture login did not return a token')
      }
      adminToken = adminSession.token
      editorToken = editorSession.token
    })

    it('lets an owner change another user role and lets an editor update their own record', async () => {
      const promoted = await restPatch(
        jsonRequest(`/api/users/${editor.id}`, { role: 'viewer' }, ownerToken, 'PATCH'),
        slugArgs(['users', String(editor.id)]),
      )
      expect(promoted.status).toBe(200)
      expect((await storedUser(editor.id)).role).toBe('viewer')

      const restored = await restPatch(
        jsonRequest(`/api/users/${editor.id}`, { role: 'editor' }, ownerToken, 'PATCH'),
        slugArgs(['users', String(editor.id)]),
      )
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
      const rest = await restPatch(
        jsonRequest(`/api/users/${editor.id}`, { role: 'owner' }, editorToken, 'PATCH'),
        slugArgs(['users', String(editor.id)]),
      )
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
      const restUpdate = await restPatch(
        jsonRequest(`/api/users/${editor.id}`, { role: 'owner' }, adminToken, 'PATCH'),
        slugArgs(['users', String(editor.id)]),
      )
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

      const restCreate = await restPost(
        jsonRequest(
          '/api/users',
          { email: 'access-planted-owner@example.com', password, role: 'owner' },
          adminToken,
        ),
        slugArgs(['users']),
      )
      expect(restCreate.status).toBe(403)

      const graphCreate = await graphql(
        `mutation CreateOwner($email: String!, $password: String!) {
          createUser(data: { email: $email, password: $password, role: owner }) { id role }
        }`,
        { email: 'access-planted-owner-graphql@example.com', password },
        adminToken,
      )
      expect(graphqlWasRefused(graphCreate.status, graphCreate.body)).toBe(true)

      const ownerRoleChange = await restPatch(
        jsonRequest(`/api/users/${owner.id}`, { role: 'admin' }, adminToken, 'PATCH'),
        slugArgs(['users', String(owner.id)]),
      )
      expect(ownerRoleChange.status).toBe(403)
      expect((await storedUser(owner.id)).role).toBe('owner')
    })

    it('refuses an anonymous listing of users over REST and GraphQL', async () => {
      const rest = await restGet(
        new Request('http://localhost:3000/api/users'),
        slugArgs(['users']),
      )
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

      const original = await login(ownerEmail, password)
      expect(original.status).toBe(200)
      const replaced = await login(ownerEmail, replacementPassword)
      expect(replaced.status).not.toBe(200)
    })

    it('refuses an admin changing an owner email or deleting an owner', async () => {
      const emailChange = await restPatch(
        jsonRequest(`/api/users/${owner.id}`, { email: 'access-taken-over@example.com' }, adminToken, 'PATCH'),
        slugArgs(['users', String(owner.id)]),
      )
      expect(emailChange.status).toBe(403)
      expect((await storedUser(owner.id)).email).toBe(ownerEmail)

      const deleted = await restDelete(
        new Request(`http://localhost:3000/api/users/${owner.id}`, {
          method: 'DELETE',
          headers: { Authorization: `JWT ${adminToken}` },
        }),
        slugArgs(['users', String(owner.id)]),
      )
      expect(deleted.status).toBe(403)
      expect((await storedUser(owner.id)).email).toBe(ownerEmail)
    })
  })
})
