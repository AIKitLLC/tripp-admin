import { NextResponse } from 'next/server'
import { SPREAD_CONFIGS } from '@/lib/tripp/spreads'
import { DECK_SIZE } from '@/lib/tripp/cards'

export async function GET() {
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
}
