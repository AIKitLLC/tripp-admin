import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import { REST_PATCH, REST_POST } from '@payloadcms/next/routes'

import { beforeAll, describe, expect, it } from 'vitest'

import { captureOutput } from '../helpers/capture-output'

const password = 'test-password'
const replacementPassword = 'replacement-password'
const resetTokenProbe = 'reset-token-probe-value'
const apiKeyProbe = 'api-key-probe-value'
const email = 'credential-log@example.com'

const restPost = REST_POST(config)
const restPatch = REST_PATCH(config)

let payload: Payload

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

describe('credential logging', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    await payload.delete({
      collection: 'users',
      where: { email: { equals: email } },
      overrideAccess: true,
    })
  }, 30_000)

  it('does not log password material during create, login, or password change', async () => {
    const output = captureOutput()
    try {
      const created = await restPost(
        jsonRequest('/api/users', { email, password }),
        slugArgs(['users']),
      )
      expect(created.status).toBe(201)
      const createdBody = (await created.json()) as { doc?: { id?: number } }
      const id = createdBody.doc?.id
      if (typeof id !== 'number') throw new Error('create did not return a user id')

      const loggedIn = await restPost(
        jsonRequest('/api/users/login', { email, password }),
        slugArgs(['users', 'login']),
      )
      expect(loggedIn.status).toBe(200)
      const loginBody = (await loggedIn.json()) as { token?: string }
      if (!loginBody.token) throw new Error('login did not return a token')

      const changed = await restPatch(
        jsonRequest(`/api/users/${id}`, { password: replacementPassword }, loginBody.token, 'PATCH'),
        slugArgs(['users', String(id)]),
      )
      expect(changed.status).toBe(200)

      const stored = await payload.findByID({
        collection: 'users',
        id,
        overrideAccess: true,
        showHiddenFields: true,
      })
      const salt = stored.salt
      const hash = stored.hash
      if (!salt || !hash) throw new Error('stored user did not include salt and hash')

      const duringAuth = output.text()
      expect(duringAuth).not.toContain(password)
      expect(duringAuth).not.toContain(replacementPassword)
      expect(duringAuth).not.toContain(salt)
      expect(duringAuth).not.toContain(hash)
      expect(duringAuth).not.toMatch(/params:\s*(?!\[redacted\])\S/)

      payload.logger.error({
        msg: 'redaction probe',
        password,
        salt,
        hash,
        resetPasswordToken: resetTokenProbe,
        apiKey: apiKeyProbe,
      })

      const afterProbe = output.text()
      expect(afterProbe).not.toContain(password)
      expect(afterProbe).not.toContain(replacementPassword)
      expect(afterProbe).not.toContain(salt)
      expect(afterProbe).not.toContain(hash)
      expect(afterProbe).not.toContain(resetTokenProbe)
      expect(afterProbe).not.toContain(apiKeyProbe)
      expect(afterProbe).toContain('[redacted]')
    } finally {
      output.stop()
    }
  }, 30_000)
})