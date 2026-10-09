import { NextResponse } from 'next/server'
import { SPREAD_CONFIGS } from '@/lib/tripp/spreads'

export async function GET() {
  return NextResponse.json({
    ok: true,
    total: SPREAD_CONFIGS.length,
    spreads: SPREAD_CONFIGS,
  })
}
