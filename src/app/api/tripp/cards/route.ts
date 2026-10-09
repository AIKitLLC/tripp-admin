import { NextResponse } from 'next/server'
import { DECK } from '@/lib/tripp/cards'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const arcana = searchParams.get('arcana')
  const suit = searchParams.get('suit')

  let result = DECK
  if (arcana === 'major' || arcana === 'minor') {
    result = result.filter((c) => c.arcana === arcana)
  }
  if (suit) {
    result = result.filter((c) => c.suit === suit)
  }

  return NextResponse.json({
    ok: true,
    total: result.length,
    cards: result,
  })
}
