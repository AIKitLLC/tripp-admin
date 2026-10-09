'use client'

import React, { useState } from 'react'

interface DrawnCard {
  id: number
  name: string
  english: string
  orientation: 'upright' | 'reversed'
  glyph: string
  symbol: string
  meaning: string
}

interface ReadingResponse {
  ok: boolean
  sessionId: string
  question: string
  spread: {
    id: string
    name: string
    english: string
    count: number
  }
  cards: DrawnCard[]
  interpretation: string
}

export default function TrippChatClient() {
  const [spreadId, setSpreadId] = useState('three')
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [reading, setReading] = useState<ReadingResponse | null>(null)
  const [chatMessage, setChatMessage] = useState('')
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [chatLoading, setChatLoading] = useState(false)

  const handleDraw = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setReading(null)
    setChatHistory([])

    try {
      const res = await fetch('/api/tripp/reading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, spreadId }),
      })
      const data = await res.json()
      if (data.ok) {
        setReading(data)
      } else {
        alert(data.error || 'Có lỗi xảy ra khi bốc bài.')
      }
    } catch {
      alert('Không thể kết nối với dịch vụ trải bài.')
    } finally {
      setLoading(false)
    }
  }

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatMessage.trim()) return

    const userText = chatMessage
    setChatMessage('')
    const updatedHistory = [...chatHistory, { role: 'user' as const, content: userText }]
    setChatHistory(updatedHistory)
    setChatLoading(true)

    try {
      const res = await fetch('/api/tripp/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: reading?.sessionId,
          message: userText,
          cards: reading?.cards,
          history: updatedHistory,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        setChatHistory([...updatedHistory, { role: 'assistant', content: data.reply }])
      }
    } catch {
      alert('Không thể gửi tin nhắn phản hồi.')
    } finally {
      setChatLoading(false)
    }
  }

  return (
    <div className="tripp-container" style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1rem', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e5e7eb', paddingBottom: '1.2rem', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 700, margin: 0, color: '#111827' }}>✦ Tripp Tarot & Chat Service</h1>
          <p style={{ margin: '0.4rem 0 0', color: '#6b7280', fontSize: '0.95rem' }}>Dịch vụ trải bài & đối thoại phản tư AI trên Cloudflare Edge</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <a
            href="/admin"
            style={{ padding: '0.5rem 1rem', backgroundColor: '#111827', color: '#ffffff', borderRadius: '6px', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem' }}
          >
            Quản trị Admin Panel ↗
          </a>
        </div>
      </header>

      {/* Form Bốc bài */}
      <section style={{ backgroundColor: '#f9fafb', borderRadius: '12px', padding: '1.5rem', border: '1px solid #e5e7eb', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', margin: '0 0 1rem', fontWeight: 600 }}>Tạo trải bài Tarot mới</h2>
        <form onSubmit={handleDraw} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.4rem', color: '#374151' }}>
              Kiểu trải bài
            </label>
            <select
              value={spreadId}
              onChange={(e) => setSpreadId(e.target.value)}
              style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.95rem' }}
            >
              <option value="daily">Thông điệp hôm nay (1 lá)</option>
              <option value="three">Trải ba lá: Quá khứ - Hiện tại - Hướng đi (3 lá)</option>
              <option value="love">Tarot tình cảm (3 lá)</option>
              <option value="money">Tarot công việc & tiền bạc (3 lá)</option>
              <option value="yes_no">Một câu hỏi rõ - Yes / No (1 lá)</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.4rem', color: '#374151' }}>
              Câu hỏi hoặc điều bạn đang băn khoăn (tùy chọn)
            </label>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ví dụ: Định hướng công việc sắp tới nên chú ý điều gì?"
              style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.95rem' }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#4f46e5',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 600,
              fontSize: '1rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              alignSelf: 'flex-start',
            }}
          >
            {loading ? 'Đang xáo bài & luận giải...' : '✦ Bốc bài ngay'}
          </button>
        </form>
      </section>

      {/* Kết quả Trải bài */}
      {reading && (
        <section style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '1.5rem', border: '1px solid #e5e7eb', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.3rem', margin: '0 0 0.5rem', color: '#111827' }}>
            Kết quả: {reading.spread.name}
          </h2>
          <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: '0 0 1.5rem' }}>
            Câu hỏi: <em>{reading.question}</em>
          </p>

          {/* Hiển thị các lá bài */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(200px, 1fr))`, gap: '1rem', marginBottom: '1.5rem' }}>
            {reading.cards.map((card, idx) => (
              <div
                key={idx}
                style={{
                  border: '1px solid #e0e7ff',
                  backgroundColor: '#f8fafc',
                  borderRadius: '10px',
                  padding: '1.2rem',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>{card.glyph}</div>
                <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#1e293b' }}>{card.name}</div>
                <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{card.english}</div>
                <div
                  style={{
                    display: 'inline-block',
                    margin: '0.5rem 0',
                    padding: '0.2rem 0.6rem',
                    backgroundColor: card.orientation === 'upright' ? '#dcfce7' : '#fee2e2',
                    color: card.orientation === 'upright' ? '#166534' : '#991b1b',
                    borderRadius: '999px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                  }}
                >
                  {card.orientation === 'upright' ? 'Thuận' : 'Ngược'}
                </div>
                <p style={{ fontSize: '0.85rem', color: '#334155', textAlign: 'left', margin: '0.5rem 0 0', lineHeight: 1.4 }}>
                  {card.meaning}
                </p>
              </div>
            ))}
          </div>

          {/* Luận giải chi tiết */}
          <div style={{ backgroundColor: '#f1f5f9', padding: '1.2rem', borderRadius: '8px', lineHeight: 1.6, whiteSpace: 'pre-line', fontSize: '0.95rem' }}>
            {reading.interpretation}
          </div>

          {/* Đối thoại thêm */}
          <div style={{ marginTop: '2rem', borderTop: '1px solid #e2e8f0', paddingTop: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Hỏi thêm hoặc suy ngẫm cùng AI:</h3>

            {chatHistory.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginBottom: '1rem' }}>
                {chatHistory.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      alignSelf: item.role === 'user' ? 'flex-end' : 'flex-start',
                      maxWidth: '85%',
                      padding: '0.8rem 1rem',
                      borderRadius: '8px',
                      backgroundColor: item.role === 'user' ? '#4f46e5' : '#e2e8f0',
                      color: item.role === 'user' ? '#ffffff' : '#0f172a',
                      fontSize: '0.9rem',
                      lineHeight: 1.5,
                      whiteSpace: 'pre-line',
                    }}
                  >
                    {item.content}
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleSendChat} style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                placeholder="Nhập câu hỏi tiếp theo để đào sâu..."
                style={{ flex: 1, padding: '0.6rem 0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.95rem' }}
              />
              <button
                type="submit"
                disabled={chatLoading}
                style={{
                  padding: '0.6rem 1.2rem',
                  backgroundColor: '#1e293b',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 600,
                  cursor: chatLoading ? 'not-allowed' : 'pointer',
                }}
              >
                {chatLoading ? 'Đang gửi...' : 'Gửi'}
              </button>
            </form>
          </div>
        </section>
      )}

      {/* Admin Quick Directory */}
      <footer style={{ marginTop: '3rem', borderTop: '1px solid #e5e7eb', paddingTop: '1.5rem' }}>
        <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#374151', marginBottom: '0.8rem' }}>
          Cổng Quản trị Dịch vụ (Payload CMS v3 Admin Collections)
        </h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {[
            { name: 'Cards (78 Lá Bài)', url: '/admin/collections/cards' },
            { name: 'Spreads (Kiểu Trải Bài)', url: '/admin/collections/spreads' },
            { name: 'ContextFlows (Cấu Hình AI)', url: '/admin/collections/context-flows' },
            { name: 'ReadingSessions (Nhật Ký Phiên)', url: '/admin/collections/reading-sessions' },
            { name: 'AuditLogs (Kiểm Toán)', url: '/admin/collections/audit-logs' },
            { name: 'Users & Permissions', url: '/admin/collections/users' },
          ].map((item, idx) => (
            <a
              key={idx}
              href={item.url}
              style={{
                fontSize: '0.85rem',
                padding: '0.4rem 0.8rem',
                backgroundColor: '#f3f4f6',
                color: '#1f2937',
                borderRadius: '6px',
                textDecoration: 'none',
                fontWeight: 500,
              }}
            >
              {item.name}
            </a>
          ))}
        </div>
      </footer>
    </div>
  )
}
