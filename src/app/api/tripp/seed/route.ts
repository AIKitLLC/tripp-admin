import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getInitialCardsData, getInitialSpreadsData } from '@/lib/tripp/seed-data'

export async function POST() {
  try {
    const payloadConfig = await config
    const payload = await getPayload({ config: payloadConfig })

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
    const message = error instanceof Error ? error.message : 'Lỗi khi seed dữ liệu'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
