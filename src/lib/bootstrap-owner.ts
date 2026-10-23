import { getPayload, type Payload } from 'payload'

import { normalizeEmail, readOwnerEmail } from './owner-email'

export const OWNER_BOOTSTRAP_MARKER = 'owner_bootstrap'

export class OwnerBootstrapError extends Error {}

export type OwnerBootstrapResult = 'created' | 'closed'

async function markerExists(payload: Payload): Promise<boolean> {
  const markers = await payload.count({
    collection: 'audit-logs',
    where: { action: { equals: OWNER_BOOTSTRAP_MARKER } },
    overrideAccess: true,
  })
  return markers.totalDocs > 0
}

async function ownerExists(payload: Payload): Promise<boolean> {
  const owners = await payload.count({
    collection: 'users',
    where: { role: { equals: 'owner' } },
    overrideAccess: true,
  })
  return owners.totalDocs > 0
}

/**
 * Creates the single owner when OWNER_BOOTSTRAP=1 and no owner marker exists.
 * A later call returns "closed" even if that owner row was removed.
 */
export async function bootstrapOwner(
  payload: Payload,
  input: { password: string; email?: string },
): Promise<OwnerBootstrapResult> {
  if (process.env.OWNER_BOOTSTRAP !== '1') {
    throw new OwnerBootstrapError(
      'OWNER_BOOTSTRAP is not enabled. Set OWNER_BOOTSTRAP=1 for this one-shot command.',
    )
  }

  const email = normalizeEmail(input.email) ?? readOwnerEmail()
  if (!email) throw new OwnerBootstrapError('OWNER_EMAIL is not set.')
  if (!input.password) throw new OwnerBootstrapError('OWNER_PASSWORD is not set.')

  if ((await markerExists(payload)) || (await ownerExists(payload))) return 'closed'

  await payload.create({
    collection: 'users',
    data: {
      email,
      password: input.password,
      role: 'owner',
      _verified: true,
    },
    overrideAccess: true,
    disableVerificationEmail: true,
    context: { ownerBootstrap: true },
  })

  await payload.create({
    collection: 'audit-logs',
    data: {
      action: OWNER_BOOTSTRAP_MARKER,
      actor: 'bootstrap',
      target: 'users',
    },
    overrideAccess: true,
    context: { auditAppend: true },
  })

  return 'created'
}

/** Test-only. Production HTTP cannot delete the marker. */
export async function resetOwnerBootstrapForTests(payload: Payload): Promise<void> {
  if (process.env.VITEST !== 'true') {
    throw new OwnerBootstrapError('resetOwnerBootstrapForTests is only available under vitest.')
  }
  await payload.db.deleteMany({
    collection: 'audit-logs',
    where: { action: { equals: OWNER_BOOTSTRAP_MARKER } },
  })
}

export async function loadPayloadAndBootstrap(password: string): Promise<OwnerBootstrapResult> {
  const config = (await import('@/payload.config')).default
  const payload = await getPayload({ config: await config })
  return bootstrapOwner(payload, { password })
}
