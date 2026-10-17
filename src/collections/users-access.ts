import {
  APIError,
  Forbidden,
  type Access,
  type CollectionBeforeChangeHook,
  type CollectionBeforeOperationHook,
  type FieldAccess,
  type PayloadRequest,
} from 'payload'

import { enforceRateLimit } from '@/lib/rate-limit'
import { isOwnerEmail, normalizeEmail } from '@/lib/owner-email'

import { actorRole, isAdminRole } from './collection-access'

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
  if (isAdminRole(role)) return true
  return { id: { equals: user.id } }
}

async function assignCreatedUserRole(
  data: Record<string, unknown>,
  req: PayloadRequest,
): Promise<Record<string, unknown>> {
  if (req.context?.ownerBootstrap === true) {
    if (!isOwnerEmail(data.email)) throw new Forbidden()
    if ((await countOwners(req)) > 0) throw new Forbidden()
    return { ...data, role: 'owner', _verified: true }
  }

  // Public signup and first-register both arrive with no user. Server fixtures pass provisionUser.
  if (!req.user) {
    if (req.context?.provisionUser !== true) throw new Forbidden()
    if (data.role === 'owner') throw new Forbidden()
    return data
  }

  if (data.role === 'owner') throw new Forbidden()
  return { ...data, _verified: false }
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

export const usersCreateAccess: Access = ({ req }) => isAdminRole(actorRole(req.user))

export const usersDeleteAccess: Access = async ({ req }) => {
  const role = actorRole(req.user)
  if (role === 'admin') return { role: { in: ['editor', 'viewer'] } }
  if (role !== 'owner') return false
  if ((await countOwners(req)) <= 1) return { role: { not_equals: 'owner' } }
  return true
}

export const roleFieldCreateAccess: FieldAccess = ({ data, req }) => {
  if (req.context?.ownerBootstrap === true) return true

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
    return isAdminRole(actorRole(req.user))
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
    if (data?._verified === true && originalDoc?._verified !== true) throw new Forbidden()
    await guardRoleOnUpdate(data, originalDoc, req)
    guardProtectedRecordFromAdmin(data, originalDoc, req)
  }

  return data
}

const LIMITED_AUTH_OPERATIONS = new Set(['login', 'forgotPassword', 'resetPassword'])

export const rateLimitUserAuth: CollectionBeforeOperationHook = async ({ args, operation, req }) => {
  const limitThis = LIMITED_AUTH_OPERATIONS.has(operation) || (operation === 'create' && !req.user)
  if (!limitThis) return args

  const headers = req.headers instanceof Headers ? req.headers : new Headers()
  const blocked = await enforceRateLimit(new Request('http://localhost/api/users', { headers }), 'auth')
  if (blocked) throw new APIError('Too many requests', 429, undefined, true)
  return args
}
