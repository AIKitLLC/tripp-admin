import { NextResponse } from 'next/server'
import { SPREAD_CONFIGS } from '@/lib/tripp/spreads'
import { DECK_SIZE } from '@/lib/tripp/cards'
import { internalServerError } from '@/lib/http-error'
import { withTrippRoute } from '@/lib/rate-limit'

export const GET = withTrippRoute(async function GET() {
  try {
    return NextResponse.json({
      ok: true,
      service: 'tripp-tarot-service',
      version: '1.0.0',
      deckSize: DECK_SIZE,
      spreads: SPREAD_CONFIGS.map((s) => ({
        id: s.id,
        name: s.name.vi,
        english: s.name.en,
        count: s.count,
      })),
      status: 'operational',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return internalServerError(error)
  }
})
