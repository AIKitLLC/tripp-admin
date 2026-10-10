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

`.github/workflows/architecture.yml` runs `arcade-agent/arcade-agent/actions/analyze` on `pull_request`. The action is pinned to commit `2fde72bcf6cd1f861b8f25b09c0a1d7bc83b820d` (tag `v0.4.1`). The PyPI package is pinned with `arcade-agent-version: "0.4.1"`. Language is `typescript`. The job is report-only: `continue-on-error: true`, `permissions` are `contents: read` and `actions: read`, `post-pr-comment` and artifact upload are off, runner is `ubuntu-latest`. A red analysis does not block merge; Tony still has to approve.
