import assert from 'node:assert/strict'
import { test } from 'node:test'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BaselineGitFixture } from './baseline-ratchet-fixture.mjs'
import { typecheckBaselineDelta } from './typecheck-baseline.mjs'

const scriptsDir = dirname(fileURLToPath(import.meta.url))
const ratchetScript = join(scriptsDir, 'typecheck-baseline-ratchet.mjs')
const kept = 'src/a.ts TS1000 message one'
const gone = 'src/b.ts TS1001 message two'
const baseline = `${kept}\n${gone}\n`

test('ratchet fails when a line is added to ci/tsc-baseline.txt', () => {
  const fixture = BaselineGitFixture.create(baseline)
  try {
    fixture.commitBaseline(`${baseline}src/c.ts TS1002 probe\n`, 'append a baseline line')
    const result = fixture.runRatchet(ratchetScript)
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /gained 1 line/)
    assert.match(result.stderr, /src\/c\.ts TS1002 probe/)
  } finally {
    fixture.dispose()
  }
})

test('ratchet passes a removed line only when that diagnostic is gone', () => {
  const fixture = BaselineGitFixture.create(baseline)
  try {
    fixture.commitBaseline(`${kept}\n`, 'drop a fixed diagnostic')
    const result = fixture.runRatchet(ratchetScript)
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stderr, /did not gain lines/)

    const diagnosticGone = typecheckBaselineDelta([kept], [kept])
    assert.deepEqual(diagnosticGone, { added: [], removed: [] })

    const diagnosticStillPresent = typecheckBaselineDelta([kept, gone], [kept])
    assert.deepEqual(diagnosticStillPresent.added, [gone])
    assert.deepEqual(diagnosticStillPresent.removed, [])
  } finally {
    fixture.dispose()
  }
})
