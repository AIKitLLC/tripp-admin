import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const baselinePath = join(root, 'ci', 'tsc-baseline.txt')
const write = process.argv.includes('--write')

const tsc = spawnSync(
  'pnpm',
  ['exec', 'tsc', '--noEmit', '--pretty', 'false', '--incremental', 'false'],
  { cwd: root, encoding: 'utf8' },
)

const output = `${tsc.stdout ?? ''}${tsc.stderr ?? ''}`
process.stdout.write(output)
if (output && !output.endsWith('\n')) process.stdout.write('\n')

if (tsc.error) {
  console.error(tsc.error.message)
  process.exit(1)
}
if (tsc.status !== 0 && tsc.status !== 1 && tsc.status !== 2) {
  console.error(`tsc --noEmit exited ${tsc.status}`)
  process.exit(tsc.status ?? 1)
}

function signatures(text) {
  return text
    .split(/\r?\n/)
    .map((line) => {
      const match = line.match(/^(.+?)\(\d+,\d+\): error (TS\d+): (.*)$/)
      return match ? `${match[1]} ${match[2]} ${match[3]}` : null
    })
    .filter(Boolean)
    .sort()
}

const current = signatures(output)
const diagnosticLines = output.split(/\r?\n/).filter((line) => /error TS\d+/.test(line))
if (diagnosticLines.length !== current.length) {
  console.error('Could not parse every tsc diagnostic, so new errors would be hidden. Failing.')
  process.exit(1)
}

if (write) {
  mkdirSync(dirname(baselinePath), { recursive: true })
  writeFileSync(baselinePath, current.length ? `${current.join('\n')}\n` : '')
  console.error(`Wrote ${current.length} diagnostics to ci/tsc-baseline.txt`)
  process.exit(0)
}

const baseline = readFileSync(baselinePath, 'utf8')
  .split(/\r?\n/)
  .filter(Boolean)
  .sort()

function tally(lines) {
  const counts = new Map()
  for (const line of lines) counts.set(line, (counts.get(line) ?? 0) + 1)
  return counts
}

const known = tally(baseline)
const seen = tally(current)
const added = []
const removed = []
for (const key of [...new Set([...known.keys(), ...seen.keys()])].sort()) {
  const delta = (seen.get(key) ?? 0) - (known.get(key) ?? 0)
  for (let i = 0; i < delta; i += 1) added.push(key)
  for (let i = 0; i < -delta; i += 1) removed.push(key)
}

if (added.length || removed.length) {
  console.error(
    `Typecheck baseline mismatch. tsc reported ${current.length}; baseline has ${baseline.length}.`,
  )
  if (added.length) {
    console.error('New diagnostics:')
    for (const line of added) console.error(`+ ${line}`)
  }
  if (removed.length) {
    console.error('Diagnostics no longer reported (update ci/tsc-baseline.txt in the same PR):')
    for (const line of removed) console.error(`- ${line}`)
  }
  process.exit(1)
}

console.error(`Typecheck matches the baseline (${current.length} known diagnostics, no new ones).`)
