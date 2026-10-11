# Agents in tripp-admin

Tripp Admin is a Payload CMS v3 + Next.js App Router app on Cloudflare Workers (OpenNext), with D1, R2, and a Workers AI binding. Product behavior is the tarot reading and chat service plus the `/admin` portal. This file is how agents change the repo. Cursor cloud agents also load `.cursor/rules/*.mdc`; those rules point here.

## Skills to load

Load both skills before writing code or a user-facing reply. They are vendored under `.agents/skills/` with upstream commit, source URL, and MIT license text. Do not edit the vendored bodies in place.

| Skill | Path | Upstream |
| --- | --- | --- |
| ponytail (coding style) | `.agents/skills/ponytail/SKILL.md` and the Cursor adapter `.agents/skills/ponytail/ponytail.mdc` | https://github.com/DietrichGebert/ponytail @ `9b58c1ffb790c075ca32e70a89cf1d80588f4abf` (MIT) |
| i-have-adhd (output style) | `.agents/skills/i-have-adhd/SKILL.md` | https://github.com/ayghri/i-have-adhd @ `723af7d9afaf43eb871dbcce6129e2bf80de90d5` (MIT) |

Ponytail level is **full**: smallest complete change, reuse this repo, no speculative abstraction. The i-have-adhd always-on snippet from [INSTALL.md](https://github.com/ayghri/i-have-adhd/blob/723af7d9afaf43eb871dbcce6129e2bf80de90d5/INSTALL.md) is applied in `.cursor/rules/agent-style.mdc` (next action first, numbered steps, lists capped at 5, no preamble or recap).

## Architecture rule

Decouple at real boundaries (domain modules, adapters for external services, platform bindings). No speculative abstractions or single-implementation interfaces.

Modules talk through explicit public entry points. No deep imports across modules.

Ponytail still wins when a boundary would be a new layer with one implementation. The current map and the target boundaries are `docs/ARCHITECTURE.md`.

## Cloudflare skills

This repo targets Cloudflare Workers, D1, R2, and Workers AI. When designing or changing that code, consult these skills from https://github.com/cloudflare/skills @ `0871daceb347e3c51693fbe9c77555468df7e410` (Apache-2.0). Reference them. Do not copy their bodies into this repo.

- `cloudflare` — which product fits
- `wrangler` — Wrangler config, D1, R2, Worker deploy shape
- `workers-best-practices` — production Worker code
- `nextjs-on-cloudflare` — Next.js on Workers. This app uses `@opennextjs/cloudflare`, not vinext. Use the skill for Workers constraints, and keep the OpenNext config that is already here.
- `durable-objects` — only if a change actually binds the session Durable Object the domain code already names (`DEMO_STATE`). It is not bound today.
- `web-perf` — public chat UI loading and interaction

## Workflow

1. Every change has a GitHub issue before the PR. Search open issues first and do not file a duplicate.
2. The PR body includes `Closes #N` for that issue.
3. Update `docs/STATUS.md` in the same PR (open issues, open PRs, milestones, blockers, last updated date).
4. Do not merge without Tony's approval.
5. Do not deploy. Do not run `wrangler login` or any other cloud-account login. Do not read, write, or rotate secrets. Do not add paid services or third-party CI beyond the free GitHub-hosted arcade-agent report.

## arcade-agent before a large refactor

TypeScript is a supported arcade-agent language, so CI runs a report-only analysis (see below). Locally, the MCP server is already declared in `.cursor/mcp.json`:

```bash
uvx --from "arcade-agent[mcp,languages]==0.4.1" arcade-mcp
```

That is the upstream command `uvx --from "arcade-agent[mcp,languages]" arcade-mcp` pinned to the same PyPI version as CI. Docs: https://arcade-agent.dev/docs/getting-started/ and the CI section of https://github.com/arcade-agent/arcade-agent (`actions/analyze`).

Before a large refactor:

1. `context_for_task` for the task you are about to do.
2. `diff_impact` on the files you expect to touch.

Use the result to stay inside the public entry points in `docs/ARCHITECTURE.md`. Skip the MCP for a one-file typo or a docs-only edit.

## CI

Two workflows run on `pull_request` and `push`, on `ubuntu-latest`.

`.github/workflows/ci.yml` has `permissions: contents: read` and `timeout-minutes: 30`. Checkout uses `fetch-depth: 0`. Actions are pinned to full SHAs (`actions/checkout` v4.4.0, `pnpm/action-setup` v4.4.0, `actions/setup-node` v4.4.0). It installs with Node 24.15.0 and pnpm 10.33.3 (`pnpm install --frozen-lockfile`), then `node --test scripts/baseline-ratchet.test.mjs`, then `pnpm lint`, then `tsc --noEmit` via `scripts/typecheck-baseline.mjs`, then `pnpm test:int`, then `pnpm run build`. The test and build steps set `PAYLOAD_SECRET` from `openssl rand -hex 32` in the runner. That value is not a real secret and is not stored. The build step refuses to run if a Cloudflare token is present. During `next build` (`NEXT_PHASE=phase-production-build`), `src/payload.config.ts` uses the local platform proxy with `remoteBindings: false`, so page-data collection does not open a remote Cloudflare session.

Lint fails on errors. The one error on `main` (`<a href="/admin">` in `TrippChatClient.tsx`) is fixed with `next/link`. Existing warnings are printed and do not fail the job. A new error does.

Typecheck prints every diagnostic. `ci/tsc-baseline.txt` records the 49 diagnostics already on `main` (union mismatches, missing `admin-auth` / `admin-runtime`, and a Payload create type). The job fails when that set gains or loses a diagnostic. Removing a line is allowed only when that diagnostic is actually gone. `scripts/typecheck-baseline-ratchet.mjs` diffs the file against the merge base of `origin/<base>` (`github.base_ref`, or the default branch on push). Any added line fails. If the base branch does not have the file yet, the initial add is allowed; after it lands, the file can only shrink. `node --test scripts/baseline-ratchet.test.mjs` runs in CI against a temporary git repo: an added baseline line must exit non-zero, and a removed line passes the ratchet only when `typecheckBaselineDelta` also shows that diagnostic is gone.

`.github/CODEOWNERS` assigns `/ci/`, `/.github/`, the baseline scripts and their fixture test, `tsconfig.json`, `package.json`, and `eslint.config.*` to `@tony-aikit`. Those entries request review. They do nothing to block a merge until branch protection on `main` requires a review from code owners. Turning that on is Tony's decision; this repo's settings are left unchanged. CODEOWNERS is read from the base branch, so it applies after this file is on `main`.

During `next build` the local platform proxy sets `persist: false`, so the page-data workers do not share one `.wrangler/state` SQLite file. `pnpm run build` is `next build` only. The next CI step runs `pnpm exec opennextjs-cloudflare build` with a throwaway `PAYLOAD_SECRET` and no Cloudflare token. After that bundle exists, `node scripts/production-secret-smoke.mjs` starts it with `wrangler dev --local` (local D1 and R2, no token, `NODE_ENV=production`, `PAYLOAD_SECRET` unset) and requires the production `PAYLOAD_SECRET` error. Branch protection on `main` is still Tony's decision; CODEOWNERS does not block a merge until he turns that on.

Playwright stays out of this workflow. `tests/e2e/frontend.e2e.spec.ts` still expects the blank template, so an E2E job would fail for a reason that is already on `main`.

`.github/workflows/architecture.yml` stays report-only: `continue-on-error: true`, `permissions` `contents: read` and `actions: read`, `timeout-minutes: 20`, action commit `2fde72bcf6cd1f861b8f25b09c0a1d7bc83b820d` (tag `v0.4.1`), PyPI `arcade-agent-version: "0.4.1"`. PR comments and artifact upload stay off. A red analysis does not block merge. Tony still has to approve.
