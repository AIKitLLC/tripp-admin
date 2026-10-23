import { NextResponse } from 'next/server'
import { drawCards, cardById, type Card } from '@/lib/tripp/cards'
import { getSpreadConfig } from '@/lib/tripp/spreads'
import { internalServerError } from '@/lib/http-error'
import { withTrippRoute } from '@/lib/rate-limit'

export const POST = withTrippRoute(async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      question?: string
      spreadId?: string
      language?: string
      cardIds?: { id: number; orientation: 'upright' | 'reversed' }[]
    }

    const spreadId = body.spreadId || 'three'
    const spreadConfig = getSpreadConfig(spreadId)
    if (!spreadConfig) {
      return NextResponse.json({ ok: false, error: 'Kiểu trải bài không hợp lệ.' }, { status: 400 })
    }

    const question = (body.question || 'Thông điệp chung cho thời điểm này').trim()

    // Draw cards if not provided
    let drawn: Card[]
    if (body.cardIds && Array.isArray(body.cardIds) && body.cardIds.length === spreadConfig.count) {
      drawn = body.cardIds.map((c) => cardById(c.id, c.orientation))
    } else {
      drawn = drawCards(spreadConfig.count)
    }

    const sessionId = crypto.randomUUID()

    // Synthesize structured symbolic interpretation
    const reflections = drawn.map((card, index) => {
      const pos = spreadConfig.positions[index] || {
        label: { vi: `Lá ${index + 1}`, en: `Card ${index + 1}` },
      }
      return {
        position: pos.label.vi,
        positionEnglish: pos.label.en,
        card: {
          id: card.id,
          name: card.name,
          english: card.english,
          orientation: card.orientation,
          glyph: card.glyph,
          symbol: card.symbol,
          meaning: card.meaning,
        },
      }
    })

    const initialInterpretation = `### Phân tích trải bài: ${spreadConfig.name.vi}\n\n**Câu hỏi / Suy ngẫm:** *${question}*\n\n` +
      reflections
        .map(
          (r, idx) =>
            `**${idx + 1}. ${r.position}: ${r.card.name} (${r.card.orientation === 'upright' ? 'Thuận' : 'Ngược'}) ${r.card.glyph}**\n- *Biểu tượng:* ${r.card.symbol}\n- *Thông điệp:* ${r.card.meaning}`
        )
        .join('\n\n') +
      `\n\n---\n*Lời khuyên chung:* Hãy coi các biểu tượng như tấm gương soi chiếu nội tâm và nguồn lực hiện tại của bạn. Bạn muốn đào sâu thêm về khía cạnh nào?`

    return NextResponse.json({
      ok: true,
      sessionId,
      question,
      spread: {
        id: spreadConfig.id,
        name: spreadConfig.name.vi,
        english: spreadConfig.name.en,
        count: spreadConfig.count,
      },
      cards: drawn,
      reflections,
      interpretation: initialInterpretation,
      createdAt: new Date().toISOString(),
    })
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
    }
    return internalServerError(error)
  }
})
