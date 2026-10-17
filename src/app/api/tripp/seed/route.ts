import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { internalServerError } from '@/lib/http-error'
import { withTrippRoute } from '@/lib/rate-limit'
import { getInitialCardsData, getInitialSpreadsData } from '@/lib/tripp/seed-data'

function userHasAdminRights(role: unknown): boolean {
  return role === 'owner' || role === 'admin'
}

export const POST = withTrippRoute(async function POST(request: Request) {
  try {
    const payloadConfig = await config
    const payload = await getPayload({ config: payloadConfig })
    const { user } = await payload.auth({ headers: request.headers })

    if (!user) {
      return NextResponse.json({ ok: false, error: 'Authentication required' }, { status: 401 })
    }

    if (!userHasAdminRights(user.role)) {
      return NextResponse.json({ ok: false, error: 'Admin access required' }, { status: 403 })
    }

    const existingCards = await payload.find({
      collection: 'cards',
      limit: 1,
    })

    let seededCardsCount = 0
    if (existingCards.totalDocs === 0) {
      const cards = getInitialCardsData()
      for (const card of cards) {
        await payload.create({
          collection: 'cards',
          data: card,
        })
        seededCardsCount++
      }
    }

    const existingSpreads = await payload.find({
      collection: 'spreads',
      limit: 1,
    })

    let seededSpreadsCount = 0
    if (existingSpreads.totalDocs === 0) {
      const spreads = getInitialSpreadsData()
      for (const spread of spreads) {
        await payload.create({
          collection: 'spreads',
          data: spread,
        })
        seededSpreadsCount++
      }
    }

    return NextResponse.json({
      ok: true,
      message: 'Database initialized successfully',
      seededCards: seededCardsCount,
      seededSpreads: seededSpreadsCount,
    })
  } catch (error) {
    return internalServerError(error)
  }
})
