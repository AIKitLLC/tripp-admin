type ConsoleMethod = 'debug' | 'error' | 'info' | 'log' | 'warn'

export function captureOutput(): { stop: () => void; text: () => string } {
  const chunks: string[] = []
  const push = (chunk: unknown) => {
    if (typeof chunk === 'string') chunks.push(chunk)
    else if (chunk instanceof Uint8Array) chunks.push(Buffer.from(chunk).toString('utf8'))
  }

  const stdoutWrite = process.stdout.write.bind(process.stdout)
  const stderrWrite = process.stderr.write.bind(process.stderr)
  process.stdout.write = ((chunk: string | Uint8Array, encoding?: BufferEncoding, callback?: () => void) => {
    push(chunk)
    return stdoutWrite(chunk, encoding as never, callback as never)
  }) as typeof process.stdout.write
  process.stderr.write = ((chunk: string | Uint8Array, encoding?: BufferEncoding, callback?: () => void) => {
    push(chunk)
    return stderrWrite(chunk, encoding as never, callback as never)
  }) as typeof process.stderr.write

  const methods: ConsoleMethod[] = ['debug', 'error', 'info', 'log', 'warn']
  const originals = Object.fromEntries(methods.map((method) => [method, console[method].bind(console)])) as Record<
    ConsoleMethod,
    (...args: unknown[]) => void
  >
  for (const method of methods) {
    console[method] = (...args: unknown[]) => {
      chunks.push(args.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' '))
      originals[method](...args)
    }
  }

  return {
    text: () => chunks.join('\n'),
    stop: () => {
      process.stdout.write = stdoutWrite
      process.stderr.write = stderrWrite
      for (const method of methods) console[method] = originals[method] as (typeof console)[ConsoleMethod]
    },
  }
}
