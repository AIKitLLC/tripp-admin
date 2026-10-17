import { NextResponse } from 'next/server'

import { internalServerError } from '@/lib/http-error'
import { withTrippRoute } from '@/lib/rate-limit'

export const POST = withTrippRoute(async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      sessionId?: string
      message?: string
      history?: { role: 'user' | 'assistant'; content: string }[]
      cards?: { name: string; orientation: string; meaning: string }[]
    }

    const message = (body.message || '').trim()
    if (!message) {
      return NextResponse.json({ ok: false, error: 'Tin nhắn không được để trống.' }, { status: 400 })
    }

    const cardsContext = body.cards && body.cards.length > 0
      ? `Các lá bài trong trải: ${body.cards.map((c) => `${c.name} (${c.orientation === 'upright' ? 'Thuận' : 'Ngược'})`).join(', ')}.`
      : ''

    // Responsive and reflective answer
    const reply = `Cảm ơn bạn đã chia sẻ thêm. ${cardsContext}\n\nĐối với băn khoăn của bạn ("*${message}*"): Hãy chú ý xem cảm xúc nào đang nổi lên rõ nhất. Khi bạn chậm lại một nhịp và nhìn nhận từ góc độ của một người quan sát khách quan, điều gì là bước đi vừa sức và nằm trong tầm kiểm soát trực tiếp của bạn lúc này?`

    return NextResponse.json({
      ok: true,
      sessionId: body.sessionId || crypto.randomUUID(),
      reply,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
    }
    return internalServerError(error)
  }
})
