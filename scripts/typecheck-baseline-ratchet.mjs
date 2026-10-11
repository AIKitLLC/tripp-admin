import { spawnSync } from 'node:child_process'

const refName = process.env.BASE_REF || process.env.GITHUB_BASE_REF || process.env.DEFAULT_BRANCH || 'main'
const baselinePath = 'ci/tsc-baseline.txt'

function git(args, { allowFail = false } = {}) {
  const result = spawnSync('git', args, { encoding: 'utf8' })
  if (result.error) {
    console.error(result.error.message)
    process.exit(1)
  }
  if (result.status !== 0 && !allowFail) {
    process.stderr.write(result.stderr || result.stdout || '')
    process.exit(result.status ?? 1)
  }
  return result
}

const fetched = git(
  ['fetch', '--no-tags', 'origin', `refs/heads/${refName}:refs/remotes/origin/${refName}`],
  { allowFail: true },
)
if (fetched.status !== 0) {
  process.stderr.write(fetched.stderr || '')
  console.error(`Could not fetch origin/${refName}. The baseline ratchet needs the PR base branch.`)
  process.exit(fetched.status ?? 1)
}

const base = `origin/${refName}`
const mergeBase = git(['merge-base', base, 'HEAD']).stdout.trim()
const onBase = git(['cat-file', '-e', `${mergeBase}:${baselinePath}`], { allowFail: true })

if (onBase.status !== 0) {
  console.error(
    `${baselinePath} is not on origin/${refName} at ${mergeBase}. The initial file may be added. Once it is on the base branch, CI rejects any added line.`,
  )
  process.exit(0)
}

const diff = git(['diff', '--unified=0', '--no-color', `${mergeBase}...HEAD`, '--', baselinePath]).stdout
const added = []
for (const line of diff.split(/\r?\n/)) {
  if (!line.startsWith('+') || line.startsWith('+++')) continue
  added.push(line.slice(1))
}

if (added.length) {
  console.error(
    `${baselinePath} gained ${added.length} line(s) since merge-base ${mergeBase} with origin/${refName}. Lines may only be removed.`,
  )
  for (const line of added) console.error(`+ ${line}`)
  process.exit(1)
}

console.error(
  `${baselinePath} did not gain lines since merge-base ${mergeBase} with origin/${refName}. Removals are allowed.`,
)
