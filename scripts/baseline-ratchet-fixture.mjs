import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

function git(cwd, args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `git ${args.join(' ')} failed`)
  }
  return result
}

export class BaselineGitFixture {
  constructor(root, work) {
    this.root = root
    this.work = work
  }

  static create(baselineText) {
    const root = mkdtempSync(join(tmpdir(), 'tsc-ratchet-'))
    const origin = join(root, 'origin.git')
    const work = join(root, 'work')
    mkdirSync(work)
    git(work, ['init', '--initial-branch=main'])
    git(work, ['config', 'user.email', 'ratchet-fixture@example.com'])
    git(work, ['config', 'user.name', 'Ratchet Fixture'])
    git(work, ['config', 'commit.gpgsign', 'false'])
    mkdirSync(join(work, 'ci'))
    const fixture = new BaselineGitFixture(root, work)
    fixture.commitBaseline(baselineText, 'add typecheck baseline')
    git(root, ['init', '--bare', '--initial-branch=main', origin])
    git(work, ['remote', 'add', 'origin', origin])
    git(work, ['push', '-u', 'origin', 'main'])
    return fixture
  }

  commitBaseline(text, message) {
    writeFileSync(join(this.work, 'ci', 'tsc-baseline.txt'), text)
    git(this.work, ['add', 'ci/tsc-baseline.txt'])
    git(this.work, ['commit', '-m', message])
  }

  runRatchet(scriptPath) {
    return spawnSync(process.execPath, [scriptPath], {
      cwd: this.work,
      encoding: 'utf8',
      env: { ...process.env, BASE_REF: 'main' },
    })
  }

  dispose() {
    rmSync(this.root, { recursive: true, force: true })
  }
}
