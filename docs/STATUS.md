# Status

Last updated: 2026-10-11. Update this file in the same PR as every change. CI on this branch now also builds with `pnpm run build` and rejects added lines in `ci/tsc-baseline.txt` against the PR base.

Data below is from `gh` against `AIKitLLC/tripp-admin` on that date. Default branch is `main`. Latest product commit on `main` is `ed88d14` (2026-10-08, Next 16 Turbopack build and Cloudflare Workers deploy). This branch was already based on that commit; there was nothing to rebase.

## GitHub now

| Kind | State |
| --- | --- |
| Open issues | #2 standards (labels set, no milestone). #3 secret, #4 template shell, #5 seed route, #6 `ignoreBuildErrors`, #7 reading engine, #8 static client (labels set, no milestone). #10 Users access lockdown (no labels, no milestone). |
| Closed issues | None. |
| Open pull requests | [#1](https://github.com/AIKitLLC/tripp-admin/pull/1) closes #2. [#9](https://github.com/AIKitLLC/tripp-admin/pull/9) closes #3 and #5. |
| Milestones | None. `M1 Foundation` and `M2 Reading service` are still only proposed below. |
| Labels | GitHub defaults plus the `type:*`, `area:*`, `status:*`, and `priority:*` labels from the table below. None were deleted. |

## Known blockers

1. Milestones were not created, and no issue is assigned to one. #10 has no labels.
2. The live reading and chat routes do not call the domain engine or Workers AI. See `docs/ARCHITECTURE.md`.
3. A Payload secret is still in the tree on `main`. [#9](https://github.com/AIKitLLC/tripp-admin/pull/9) removes it. This file does not repeat the value. CI generates a throwaway `PAYLOAD_SECRET` and does not read that value.

## Rule

Every later PR updates this file: open issues, open PRs with the issues they close, milestone assignment, blockers, and this date. Do not merge without Tony's approval.

## Tracking setup

Labels and issues #2–#8 now exist on GitHub. This agent's token got HTTP 403 on `gh label create` on 2026-10-10; the rows below are the set that was proposed then. Milestones are still missing. Issue #10 was opened later and is not in this list.

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

Still not created. No open issues existed when this set was chosen. Assign the issues below when the milestones exist. #10 is not in this set.

| Milestone | Goal |
| --- | --- |
| `M1 Foundation` | Standards, secret out of source, template leftovers, tests that match the UI that ships. |
| `M2 Reading service` | One HTTP surface that runs the domain engine and is what both clients call. |

### Issue to label and milestone

Issues #2–#8 exist and already have the labels in this table. They have no milestone. Do not close them from this PR except #2, which this PR closes.

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

These seven were opened as #2–#8. The bodies below are the originals. #10 was filed later and is separate.

1. **Adopt Tony's dev standards.** Body: Add AGENTS.md, vendored ponytail and i-have-adhd skills, Cursor rules, architecture and status docs, and report-only arcade-agent CI. The standards PR closes this issue.
2. **Stop shipping the Payload secret in the repo.** Body: `wrangler.jsonc` vars and the fallback in `src/payload.config.ts` contain a Payload secret; move it to a secret binding and rotate it, without printing the value.
3. **Drop the blank-template shell around the public page.** Body: `src/app/(frontend)/layout.tsx` still titles the app "Payload Blank Template", and `tests/e2e/frontend.e2e.spec.ts` expects the heading "Welcome to your new project."
4. **Close the unauthenticated seed route and the template route.** Body: `POST /api/tripp/seed` writes Cards and Spreads with no auth check, and `src/app/my-route/route.ts` is the unused Payload template route.
5. **Turn TypeScript build failures back on.** Body: `next.config.ts` sets `typescript.ignoreBuildErrors` so a Worker build can succeed while type errors are hidden.
6. **Mount the domain reading engine on the live routes.** Body: `/api/tripp/reading` and `/api/tripp/chat` return canned text, while `src/lib/tripp/reading-api.ts` is unused, imports missing `admin-auth` and `admin-runtime`, and expects a `DEMO_STATE` Durable Object that `wrangler.jsonc` does not bind.
7. **Point the static TRIPP client at routes this app serves.** Body: `public/tripp` calls `/api/reading`, `/api/config`, `/api/client-tools/*`, and `/api/admin/*`, and its HTML loads `/app.js` from the site root while the file is `/tripp/app.js`.
