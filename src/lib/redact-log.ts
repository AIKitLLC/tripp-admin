const SENSITIVE_KEY = /password|salt|hash|token|api[_-]?key|secret/i

export function redactLoggedText(text: string): string {
  return text.replace(/^.*params:.*$/gm, 'params: [redacted]')
}

export function redactLoggedValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value === 'string') return redactLoggedText(value)
  if (value instanceof Error) return redactLoggedError(value, seen)
  if (!value || typeof value !== 'object') return value
  if (seen.has(value)) return '[Circular]'
  seen.add(value)
  if (Array.isArray(value)) return value.map((item) => redactLoggedValue(item, seen))

  const output: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value)) {
    output[key] = SENSITIVE_KEY.test(key) ? '[redacted]' : redactLoggedValue(item, seen)
  }
  return output
}

function redactLoggedError(error: Error, seen: WeakSet<object>): Record<string, unknown> {
  if (seen.has(error)) return { name: error.name, message: '[Circular]' }
  seen.add(error)

  const record = error as Error & {
    cause?: unknown
    data?: unknown
    params?: unknown
    query?: unknown
  }
  const output: Record<string, unknown> = {
    name: error.name,
    message: redactLoggedText(error.message),
  }
  if (error.stack) output.stack = redactLoggedText(error.stack)
  if ('query' in record) output.query = '[redacted]'
  if ('params' in record) output.params = '[redacted]'
  if (record.cause !== undefined) output.cause = redactLoggedValue(record.cause, seen)
  if (record.data !== undefined) output.data = redactLoggedValue(record.data, seen)
  return output
}

type ConsoleMethod = 'debug' | 'error' | 'info' | 'log' | 'warn'
type LogFn = (objOrMsg: object | string, msg?: string) => void

function writeRedactedLog(level: string, method: ConsoleMethod): LogFn {
  return (objOrMsg, msg) => {
    const body =
      typeof objOrMsg === 'string'
        ? { level, msg: redactLoggedText(objOrMsg) }
        : {
            level,
            ...(redactLoggedValue(objOrMsg) as Record<string, unknown>),
            ...(msg ? { msg: redactLoggedText(msg) } : {}),
          }
    console[method](JSON.stringify(body))
  }
}

export function createRedactingLogger() {
  return {
    level: process.env.PAYLOAD_LOG_LEVEL || 'info',
    trace: writeRedactedLog('trace', 'debug'),
    debug: writeRedactedLog('debug', 'debug'),
    info: writeRedactedLog('info', 'log'),
    warn: writeRedactedLog('warn', 'warn'),
    error: writeRedactedLog('error', 'error'),
    fatal: writeRedactedLog('fatal', 'error'),
    silent: () => {},
  }
}
