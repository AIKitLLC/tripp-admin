import type { AfterErrorHook } from 'payload'

export const DUPLICATE_EMAIL_MESSAGE = 'An account with this email is already registered.'

export function isUsersEmailUniqueViolation(error: unknown): boolean {
  return collectErrorText(error).toLowerCase().includes('unique constraint failed: users.email')
}

function collectErrorText(error: unknown, seen = new Set<unknown>()): string {
  if (!error || seen.has(error)) return ''
  if (typeof error === 'string') return error
  if (error instanceof Error) {
    seen.add(error)
    const cause = 'cause' in error ? collectErrorText((error as { cause?: unknown }).cause, seen) : ''
    return `${error.message}\n${cause}`
  }
  return ''
}

export const reportDuplicateEmailConflict: AfterErrorHook = ({ error }) => {
  if (!isUsersEmailUniqueViolation(error)) return
  return {
    status: 409,
    response: {
      errors: [{ message: DUPLICATE_EMAIL_MESSAGE }],
    },
  }
}
