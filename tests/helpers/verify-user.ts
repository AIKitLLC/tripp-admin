import type { Payload } from 'payload'

export async function verifyUserEmail(payload: Payload, id: number): Promise<void> {
  const stored = await payload.findByID({
    collection: 'users',
    id,
    overrideAccess: true,
    showHiddenFields: true,
  })
  const token = stored._verificationToken
  if (typeof token !== 'string' || token.length === 0) {
    throw new Error(`user ${id} has no verification token`)
  }
  const verified = await payload.verifyEmail({ collection: 'users', token })
  if (!verified) throw new Error(`user ${id} verification failed`)
}
