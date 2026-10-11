import {
  Forbidden,
  type Access,
  type CollectionBeforeChangeHook,
  type FieldAccess,
  type PayloadRequest,
} from 'payload'

import { isOwnerEmail, logMissingOwnerEmail, normalizeEmail, readOwnerEmail } from '@/lib/owner-email'

type UserRole = 'owner' | 'admin' | 'editor' | 'viewer'

function actorRole(user: PayloadRequest['user']): UserRole | undefined {
  if (!user || !('role' in user)) return undefined
  const role = user.role
  if (role === 'owner' || role === 'admin' || role === 'editor' || role === 'viewer') return role
  return undefined
}

function isPrivileged(role: UserRole | undefined): boolean {
  return role === 'owner' || role === 'admin'
}

function isStaffRole(role: unknown): role is 'editor' | 'viewer' {
  return role === 'editor' || role === 'viewer'
}

function isSameUser(user: PayloadRequest['user'], id: number | string | undefined): boolean {
  if (!user || id === undefined || user.id === undefined) return false
  return String(user.id) === String(id)
}

async function countOwners(req: PayloadRequest): Promise<number> {
  const result = await req.payload.count({
    collection: 'users',
    where: { role: { equals: 'owner' } },
    overrideAccess: true,
    req,
  })
  return result.totalDocs
}

function emailsDiffer(current: unknown, next: unknown): boolean {
  const nextEmail = normalizeEmail(next)
  if (!nextEmail) return false
  return nextEmail !== normalizeEmail(current)
}

function passwordWasSubmitted(value: unknown): boolean {
  return typeof value === 'string' && value.length > 0
}

function ownRecordOrPrivileged(req: PayloadRequest): boolean | { id: { equals: number | string } } {
  const user = req.user
  const role = actorRole(user)
  if (!user || !role) return false
  if (isPrivileged(role)) return true
  return { id: { equals: user.id } }
}

function assignCreatedUserRole(
  data: Record<string, unknown>,
  req: PayloadRequest,
): Record<string, unknown> {
  if (isOwnerEmail(data.email)) {
    return { ...data, role: 'owner' }
  }

  if (!readOwnerEmail()) logMissingOwnerEmail(req)

  if (!req.user) {
    return { ...data, role: 'viewer' }
  }

  if (data.role === 'owner') throw new Forbidden()
  return data
}

async function guardRoleOnUpdate(
  data: { role?: unknown; id?: unknown } | undefined,
  originalDoc: { id?: number | string; role?: unknown } | undefined,
  req: PayloadRequest,
): Promise<void> {
  const nextRole = data?.role
  const currentRole = originalDoc?.role
  if (nextRole === undefined || nextRole === currentRole) return

  if (currentRole === 'owner' && nextRole !== 'owner' && (await countOwners(req)) <= 1) {
    throw new Forbidden()
  }

  if (isSameUser(req.user, originalDoc?.id)) throw new Forbidden()
  if (nextRole === 'owner') throw new Forbidden()

  const role = actorRole(req.user)
  if (role === 'owner') return
  if (role === 'admin' && isStaffRole(currentRole) && isStaffRole(nextRole)) return
  throw new Forbidden()
}

function guardProtectedRecordFromAdmin(
  data: { email?: unknown; password?: unknown } | undefined,
  originalDoc: { email?: unknown; id?: number | string; role?: unknown } | undefined,
  req: PayloadRequest,
): void {
  if (actorRole(req.user) !== 'admin') return
  if (originalDoc?.role !== 'owner' && originalDoc?.role !== 'admin') return
  if (isSameUser(req.user, originalDoc?.id)) return
  if (emailsDiffer(originalDoc.email, data?.email)) throw new Forbidden()
  if (passwordWasSubmitted(data?.password)) throw new Forbidden()
}

export const usersReadAccess: Access = ({ req }) => ownRecordOrPrivileged(req)

export const usersUpdateAccess: Access = ({ req }) => {
  const user = req.user
  const role = actorRole(user)
  if (!user || !role) return false
  if (role === 'owner') return true
  if (role === 'admin') {
    return {
      or: [{ id: { equals: user.id } }, { role: { in: ['editor', 'viewer'] } }],
    }
  }
  return { id: { equals: user.id } }
}

export const usersCreateAccess: Access = ({ req }) => {
  if (!req.user) return true
  return isPrivileged(actorRole(req.user))
}

export const usersDeleteAccess: Access = async ({ req }) => {
  const role = actorRole(req.user)
  if (role === 'admin') return { role: { in: ['editor', 'viewer'] } }
  if (role !== 'owner') return false
  if ((await countOwners(req)) <= 1) return { role: { not_equals: 'owner' } }
  return true
}

export const roleFieldCreateAccess: FieldAccess = ({ data, req }) => {
  if (!req.user || isOwnerEmail(data?.email)) return true

  const role = actorRole(req.user)
  if (role === 'owner') {
    if (data?.role === 'owner') throw new Forbidden()
    return true
  }
  if (role === 'admin') {
    if (data?.role === 'owner' || data?.role === 'admin') throw new Forbidden()
    return true
  }
  return false
}

export const roleFieldUpdateAccess: FieldAccess = async ({ data, doc, id, req }) => {
  const nextRole = data && 'role' in data ? data.role : undefined
  const currentRole = doc && 'role' in doc ? doc.role : undefined
  if (nextRole === undefined || nextRole === currentRole) {
    return isPrivileged(actorRole(req.user))
  }

  if (currentRole === 'owner' && nextRole !== 'owner' && (await countOwners(req)) <= 1) {
    throw new Forbidden()
  }

  if (isSameUser(req.user, id ?? doc?.id)) throw new Forbidden()

  const role = actorRole(req.user)
  if (role === 'owner') {
    if (nextRole === 'owner') throw new Forbidden()
    return true
  }
  if (role === 'admin' && isStaffRole(currentRole) && isStaffRole(nextRole)) return true

  throw new Forbidden()
}

export const enforceUserPrivileges: CollectionBeforeChangeHook = async ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  if (operation === 'create') {
    return assignCreatedUserRole(data ?? {}, req)
  }

  if (operation === 'update') {
    await guardRoleOnUpdate(data, originalDoc, req)
    guardProtectedRecordFromAdmin(data, originalDoc, req)
  }

  return data
}
