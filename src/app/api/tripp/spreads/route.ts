import { NextResponse } from 'next/server'
import { SPREAD_CONFIGS } from '@/lib/tripp/spreads'
import { internalServerError } from '@/lib/http-error'
import { withTrippRoute } from '@/lib/rate-limit'

export const GET = withTrippRoute(async function GET() {
  try {
    return NextResponse.json({
      ok: true,
      total: SPREAD_CONFIGS.length,
      spreads: SPREAD_CONFIGS,
    })
  } catch (error) {
    return internalServerError(error)
  }
})
