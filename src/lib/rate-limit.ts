type RateLimitBinding = {
  limit(options: { key: string }): Promise<{ success: boolean }>
}

type BucketName = 'auth' | 'tripp'

const WINDOW_MS = 60_000
const LIMITS: Record<BucketName, number> = { auth: 10, tripp: 60 }
const TEST_HEADER = 'x-rate-limit-test'
const TEST_HEADER_LIMIT = 3
const TEST_SUITE_LIMIT = 10_000

const buckets = new Map<string, { resetAt: number; count: number }>()

let authLimiter: RateLimitBinding | undefined
let trippLimiter: RateLimitBinding | undefined

export function rememberRateLimitBindings(env: object | undefined): void {
  if (!env || typeof env !== 'object') return
  if ('AUTH_RATE_LIMITER' in env) {
    const binding = (env as { AUTH_RATE_LIMITER?: RateLimitBinding }).AUTH_RATE_LIMITER
    if (binding && typeof binding.limit === 'function') authLimiter = binding
  }
  if ('TRIPP_RATE_LIMITER' in env) {
    const binding = (env as { TRIPP_RATE_LIMITER?: RateLimitBinding }).TRIPP_RATE_LIMITER
    if (binding && typeof binding.limit === 'function') trippLimiter = binding
  }
}

function clientAddress(request: Request): string {
  const address = request.headers.get('cf-connecting-ip')?.trim()
  if (!address) return 'unknown'
  return address.slice(0, 128)
}

function memoryAllow(key: string, limit: number): boolean {
  const now = Date.now()
  const current = buckets.get(key)
  if (!current || now >= current.resetAt) {
    buckets.set(key, { resetAt: now + WINDOW_MS, count: 1 })
    return true
  }
  current.count += 1
  return current.count <= limit
}

function bindingFor(bucket: BucketName): RateLimitBinding | undefined {
  return bucket === 'auth' ? authLimiter : trippLimiter
}

async function allow(bucket: BucketName, key: string, limit: number): Promise<boolean> {
  // shortcut: per-isolate memory when the binding is missing or this is vitest; production uses the wrangler ratelimits bindings
  if (process.env.VITEST === 'true') return memoryAllow(key, limit)

  const binding = bindingFor(bucket)
  if (!binding) return memoryAllow(key, limit)

  try {
    const outcome = await binding.limit({ key })
    return outcome.success
  } catch (error) {
    console.error(
      JSON.stringify({
        msg: 'rate limit binding failed; using in-memory fallback',
        bucket,
        error: error instanceof Error ? error.name : 'unknown',
      }),
    )
    return memoryAllow(key, limit)
  }
}

export async function enforceRateLimit(
  request: Request,
  bucket: BucketName,
): Promise<Response | null> {
  const testKey =
    process.env.VITEST === 'true' ? request.headers.get(TEST_HEADER)?.trim() || undefined : undefined
  const key = testKey ? `test:${bucket}:${testKey}` : `${bucket}:${clientAddress(request)}`
  const limit = testKey ? TEST_HEADER_LIMIT : process.env.VITEST === 'true' ? TEST_SUITE_LIMIT : LIMITS[bucket]
  if (await allow(bucket, key, limit)) return null

  const requestId = crypto.randomUUID()
  return Response.json(
    { ok: false, error: 'Too many requests', requestId },
    {
      status: 429,
      headers: {
        'retry-after': '60',
        'x-request-id': requestId,
      },
    },
  )
}

export function withTrippRoute(
  handler: (request: Request) => Promise<Response>,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const limited = await enforceRateLimit(request, 'tripp')
    if (limited) return limited
    return handler(request)
  }
}
