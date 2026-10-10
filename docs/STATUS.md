# Status

Last updated: 2026-10-10. Update this file in the same PR as every change.

Data below is from `gh` against `AIKitLLC/tripp-admin` on that date. Default branch is `main`. Latest product commit on `main` is `ed88d14` (2026-10-08, Next 16 Turbopack build and Cloudflare Workers deploy).

## GitHub now

| Kind | State |
| --- | --- |
| Open issues | None. |
| Closed issues | None. |
| Open pull requests | [#1](https://github.com/AIKitLLC/tripp-admin/pull/1) `cursor/adopt-dev-standards-84cd` — adopt Tony's dev standards. No `Closes #N` yet: the standards issue is proposed below and was not created (403). |
| Milestones | None. |
| Labels | GitHub defaults only: `bug`, `documentation`, `duplicate`, `enhancement`, `good first issue`, `help wanted`, `invalid`, `question`, `wontfix`. |

No open PR links an issue, because there are no open PRs and no issues. Nothing was closed or rewritten.

## Known blockers

1. This agent's GitHub token cannot create labels, milestones, or issues. `gh label create` returned `HTTP 403: Resource not accessible by integration` on `https://api.github.com/repos/AIKitLLC/tripp-admin/labels`. The tracking setup below is the proposal, not applied state. Do not treat it as live GitHub data.
2. The live reading and chat routes do not call the domain engine or Workers AI. See `docs/ARCHITECTURE.md`.
3. A Payload secret is stored in `wrangler.jsonc` `vars` and as a fallback in `src/payload.config.ts`. This file does not repeat the value. Moving it is a product change and is not part of the standards PR.

## Rule

Every later PR updates this file: open issues, open PRs with the issues they close, milestone assignment, blockers, and this date. Do not merge without Tony's approval.

## Tracking setup

Not created. Token returned 403. Existing labels were not deleted. No probe issue was filed.

### Labels to create

| Label | Meaning |
| --- | --- |
| `type:feature` | New behavior. |
| `type:bug` | Broken behavior or a safety hole. |
| `type:chore` | Tooling, standards, or maintenance. |
| `type:docs` | Docs only. |
| `area:frontend` | `src/app/(frontend)`. |
| `area:payload-admin` | `src/app/(payload)`. |
| `area:tripp-http` | `src/app/api/tripp` and `src/app/my-route`. |
| `area:cms` | `src/collections`, `src/payload.config.ts`, `src/migrations`. |
| `area:domain` | `src/lib/tripp`. |
| `area:static-client` | `public/tripp`. |
| `area:platform` | Wrangler, OpenNext, Next config, generated Worker types. |
| `area:tests` | `tests`. |
| `status:ready` | Can be picked up. |
| `status:in-progress` | Someone is doing it. |
| `status:in-review` | PR is open. |
| `status:blocked` | Waiting on another issue. |
| `priority:p0` | Do before other product work. |
| `priority:p1` | Next. |
| `priority:p2` | After p0 and p1. |

`area:*` names are the modules in `docs/ARCHITECTURE.md`.

### Milestones to create

No open issues existed to cluster, so the set follows the two gaps already in the tree.

| Milestone | Goal |
| --- | --- |
| `M1 Foundation` | Standards, secret out of source, template leftovers, tests that match the UI that ships. |
| `M2 Reading service` | One HTTP surface that runs the domain engine and is what both clients call. |

### Issue to label and milestone

No existing issues, so this table is the assignment to apply when the issues below are created. Do not close them from this PR.

| Proposed issue | Milestone | Labels |
| --- | --- | --- |
| Adopt Tony's dev standards | M1 Foundation | `type:chore`, `area:platform`, `status:in-review`, `priority:p1` |
| Stop shipping the Payload secret in the repo | M1 Foundation | `type:bug`, `area:platform`, `status:ready`, `priority:p0` |
| Drop the blank-template shell around the public page | M1 Foundation | `type:bug`, `area:frontend`, `area:tests`, `status:ready`, `priority:p1` |
| Close the unauthenticated seed route and the template route | M1 Foundation | `type:bug`, `area:tripp-http`, `status:ready`, `priority:p1` |
| Turn TypeScript build failures back on | M1 Foundation | `type:chore`, `area:platform`, `status:ready`, `priority:p2` |
| Mount the domain reading engine on the live routes | M2 Reading service | `type:feature`, `area:domain`, `area:tripp-http`, `status:ready`, `priority:p0` |
| Point the static TRIPP client at routes this app serves | M2 Reading service | `type:bug`, `area:static-client`, `status:blocked`, `priority:p1` |

The static-client issue stays `status:blocked` until the reading-engine issue chooses the HTTP shape.

### Issues to create

Searched the tree for `TODO` and `FIXME` (none in app code; only generated queue fields in `cloudflare-env.d.ts`) and searched GitHub issues (none). README has no separate roadmap list. These are the gaps that have no issue yet. One line is the body to paste.

1. **Adopt Tony's dev standards.** Body: Add AGENTS.md, vendored ponytail and i-have-adhd skills, Cursor rules, architecture and status docs, and report-only arcade-agent CI. The standards PR closes this issue.
2. **Stop shipping the Payload secret in the repo.** Body: `wrangler.jsonc` vars and the fallback in `src/payload.config.ts` contain a Payload secret; move it to a secret binding and rotate it, without printing the value.
3. **Drop the blank-template shell around the public page.** Body: `src/app/(frontend)/layout.tsx` still titles the app "Payload Blank Template", and `tests/e2e/frontend.e2e.spec.ts` expects the heading "Welcome to your new project."
4. **Close the unauthenticated seed route and the template route.** Body: `POST /api/tripp/seed` writes Cards and Spreads with no auth check, and `src/app/my-route/route.ts` is the unused Payload template route.
5. **Turn TypeScript build failures back on.** Body: `next.config.ts` sets `typescript.ignoreBuildErrors` so a Worker build can succeed while type errors are hidden.
6. **Mount the domain reading engine on the live routes.** Body: `/api/tripp/reading` and `/api/tripp/chat` return canned text, while `src/lib/tripp/reading-api.ts` is unused, imports missing `admin-auth` and `admin-runtime`, and expects a `DEMO_STATE` Durable Object that `wrangler.jsonc` does not bind.
7. **Point the static TRIPP client at routes this app serves.** Body: `public/tripp` calls `/api/reading`, `/api/config`, `/api/client-tools/*`, and `/api/admin/*`, and its HTML loads `/app.js` from the site root while the file is `/tripp/app.js`.
