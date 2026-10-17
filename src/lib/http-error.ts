import { NextResponse } from 'next/server'

import { redactLoggedValue } from './redact-log'

export function internalServerError(error: unknown): Response {
  const requestId = crypto.randomUUID()
  console.error(JSON.stringify({ requestId, error: redactLoggedValue(error) }))
  return NextResponse.json(
    { ok: false, error: 'Internal server error', requestId },
    { status: 500, headers: { 'x-request-id': requestId } },
  )
}
