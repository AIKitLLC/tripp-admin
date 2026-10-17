import type { Access, PayloadRequest, Where } from 'payload'

export type UserRole = 'owner' | 'admin' | 'editor' | 'viewer'

export function actorRole(user: PayloadRequest['user']): UserRole | undefined {
  if (!user || !('role' in user)) return undefined
  const role = user.role
  if (role === 'owner' || role === 'admin' || role === 'editor' || role === 'viewer') return role
  return undefined
}

export function isAdminRole(role: UserRole | undefined): boolean {
  return role === 'owner' || role === 'admin'
}

export function isEditorRole(role: UserRole | undefined): boolean {
  return role === 'owner' || role === 'admin' || role === 'editor'
}

export const denyAll: Access = () => false

export const publicRead: Access = () => true

export const adminOnly: Access = ({ req }) => isAdminRole(actorRole(req.user))

export const editorWrite: Access = ({ req }) => isEditorRole(actorRole(req.user))

/** Logged-in staff of any role. Anonymous requests are denied. */
export const authenticated: Access = ({ req }) => Boolean(actorRole(req.user))

/** Admins read every row. Other signed-in users read only rows they own. */
export function adminOrOwn(field: string): Access {
  return ({ req }) => {
    const role = actorRole(req.user)
    if (!req.user || !role) return false
    if (isAdminRole(role)) return true
    const where: Where = { [field]: { equals: req.user.id } }
    return where
  }
}
