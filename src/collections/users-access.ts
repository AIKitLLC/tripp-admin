import {
  Forbidden,
  type Access,
  type CollectionBeforeChangeHook,
  type FieldAccess,
  type PayloadRequest,
} from 'payload'

type UserRole = 'owner' | 'admin' | 'editor' | 'viewer'

const ASSIGNABLE_BY_ADMIN: readonly UserRole[] = ['admin', 'editor', 'viewer']

function actorRole(user: PayloadRequest['user']): UserRole | undefined {
  if (!user || !('role' in user)) return undefined
  const role = user.role
  if (role === 'owner' || role === 'admin' || role === 'editor' || role === 'viewer') return role
  return undefined
}

function isPrivileged(role: UserRole | undefined): boolean {
  return role === 'owner' || role === 'admin'
}

function isSameUser(user: PayloadRequest['user'], id: number | string | undefined): boolean {
  if (!user || id === undefined || user.id === undefined) return false
  return String(user.id) === String(id)
}

async function countUsers(req: PayloadRequest): Promise<number> {
  const result = await req.payload.count({
    collection: 'users',
    overrideAccess: true,
    req,
  })
  return result.totalDocs
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

function normalizeEmail(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim().toLowerCase()
  return normalized.length > 0 ? normalized : undefined
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

export const usersReadAccess: Access = ({ req }) => ownRecordOrPrivileged(req)

export const usersUpdateAccess: Access = ({ req }) => {
  const user = req.user
  const role = actorRole(user)
  if (!user || !role) return false
  if (role === 'owner') return true
  if (role === 'admin') {
    return {
      or: [{ id: { equals: user.id } }, { role: { not_equals: 'owner' } }],
    }
  }
  return { id: { equals: user.id } }
}

export const usersCreateAccess: Access = async ({ req }) => {
  if ((await countUsers(req)) === 0) return true
  return isPrivileged(actorRole(req.user))
}

export const usersDeleteAccess: Access = async ({ req }) => {
  const role = actorRole(req.user)
  if (role === 'admin') return { role: { not_equals: 'owner' } }
  if (role !== 'owner') return false
  if ((await countOwners(req)) <= 1) return { role: { not_equals: 'owner' } }
  return true
}

export const roleFieldCreateAccess: FieldAccess = async ({ data, req }) => {
  if ((await countUsers(req)) === 0) return true

  const role = actorRole(req.user)
  if (role === 'owner') return true
  if (role === 'admin') {
    if (data?.role === 'owner') throw new Forbidden()
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
  if (role === 'owner') return true
  if (role === 'admin') {
    if (currentRole === 'owner' || nextRole === 'owner') throw new Forbidden()
    if (ASSIGNABLE_BY_ADMIN.includes(nextRole as UserRole)) return true
  }

  throw new Forbidden()
}

export const enforceUserPrivileges: CollectionBeforeChangeHook = async ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  if (operation === 'create' && (await countUsers(req)) === 0) {
    return { ...data, role: 'owner' }
  }

  if (
    operation === 'update' &&
    originalDoc?.role === 'owner' &&
    data?.role !== undefined &&
    data.role !== 'owner' &&
    (await countOwners(req)) <= 1
  ) {
    throw new Forbidden()
  }

  if (operation === 'update' && originalDoc?.role === 'owner' && actorRole(req.user) === 'admin') {
    if (emailsDiffer(originalDoc.email, data?.email)) throw new Forbidden()
    if (passwordWasSubmitted(data?.password)) throw new Forbidden()
  }

  return data
}
