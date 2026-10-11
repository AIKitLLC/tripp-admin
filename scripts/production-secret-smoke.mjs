import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

const TOKEN_NAMES = [
  'CLOUDFLARE_API_TOKEN',
  'CLOUDFLARE_API_KEY',
  'CF_API_TOKEN',
  'WRANGLER_API_TOKEN',
]
const SECRET_ERROR = 'PAYLOAD_SECRET must be a non-placeholder'
const port = 8791
const root = process.cwd()
const worker = path.join(root, '.open-next', 'worker.js')
const assets = path.join(root, '.open-next', 'assets')

if (TOKEN_NAMES.some((name) => process.env[name])) {
  console.error('A Cloudflare token is present. Refusing to smoke-test with it.')
  process.exit(1)
}

const dir = mkdtempSync(path.join(tmpdir(), 'tripp-secret-smoke-'))
const configPath = path.join(dir, 'wrangler.json')
writeFileSync(
  configPath,
  JSON.stringify(
    {
      name: 'tripp-admin-secret-smoke',
      main: worker,
      compatibility_date: '2025-08-15',
      compatibility_flags: ['nodejs_compat', 'global_fetch_strictly_public'],
      ai: { binding: 'AI' },
      assets: { directory: assets, binding: 'ASSETS' },
      d1_databases: [
        {
          binding: 'D1',
          database_name: 'tripp-admin-secret-smoke',
          database_id: '00000000-0000-0000-0000-000000000001',
        },
      ],
      r2_buckets: [{ binding: 'R2', bucket_name: 'tripp-admin-secret-smoke' }],
    },
    null,
    2,
  ),
)

const env = { ...process.env, NODE_ENV: 'production' }
delete env.PAYLOAD_SECRET
delete env.CLOUDFLARE_ACCOUNT_ID
for (const name of TOKEN_NAMES) delete env[name]

const child = spawn(
  'pnpm',
  [
    'exec',
    'wrangler',
    'dev',
    '--config',
    configPath,
    '--port',
    String(port),
    '--ip',
    '127.0.0.1',
    '--local',
    '--persist-to',
    path.join(dir, 'state'),
    '--show-interactive-dev-session',
    'false',
  ],
  { cwd: root, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] },
)

let logs = ''
const append = (chunk) => {
  const text = chunk.toString()
  logs += text
  process.stderr.write(text)
}
child.stdout?.on('data', append)
child.stderr?.on('data', append)

function stopChild() {
  if (!child.pid || child.killed) return
  try {
    process.kill(-child.pid, 'SIGTERM')
  } catch {
    child.kill('SIGTERM')
  }
}

const started = Date.now()
let refused = false
try {
  while (Date.now() - started < 90_000) {
    if (logs.includes(SECRET_ERROR)) {
      refused = true
      break
    }
    if (logs.includes(`127.0.0.1:${port}`) || logs.includes(`localhost:${port}`)) {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/api/users`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email: 'smoke@example.com', password: 'smoke-password' }),
        })
        const body = await response.text()
        logs += `\nHTTP ${response.status}\n${body}\n`
        if (body.includes(SECRET_ERROR) || logs.includes(SECRET_ERROR)) {
          refused = true
          break
        }
      } catch {
        // The listener is not accepting requests yet.
      }
    }
    if (child.exitCode !== null) break
    await delay(500)
  }
} finally {
  stopChild()
  rmSync(dir, { recursive: true, force: true })
}

if (!refused) {
  console.error('The built Worker did not refuse to run without PAYLOAD_SECRET.')
  process.exit(1)
}
