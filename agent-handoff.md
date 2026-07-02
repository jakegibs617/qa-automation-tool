# Agent Handoff

## Current Repo State
- Latest completed milestone: **Extract shared recorder selector policy** (PR #18), task 1 of the design-debt refactor list in `design-improvement-progress.json` (source audit: `design-patterns-first-principles-audit.md`, both now tracked in git). This is a separate track from the `plan.md` product-feature milestones (scheduling/notifications) below — the user explicitly directed an agent session to work through the design-debt list end to end (implement, test, PR, review, merge each of its 6 tasks in order) rather than starting scheduling/notifications next. **If you are the next agent and no one has redirected you, continue with `design-002-run-artifact-writer` in `design-improvement-progress.json`** (task 3 depends on nothing, task 6 depends on task 4 — the rest are independent and already ordered sensibly in the file).
- Prior: Recorder extension selector-resilience / click-capture follow-up (PR #16).
- Prior: MVP demo validation and polish merged in PR #15. Recorder milestone merged in PR #14 (`agent/recorder-mvp` -> `main`).
- A duplicate recorder-extension PR (**#9**, `checkpoint/09-recorder-extension`) was closed without merging — it reimplemented `frontend/recorder-extension/` from scratch in a separate `extension/` directory, branched before PR #14 merged, with no dashboard integration and a bug that would have recorded plaintext password values. Its two genuinely useful ideas were ported into `frontend/recorder-extension/` via PR #16 instead. Do not resurrect `extension/`.
- NestJS backend in `backend/` listens on `http://localhost:4000`. Next.js frontend in `frontend/` listens on `http://localhost:3000`.
- `docker-compose.yml` provides PostgreSQL (host port `55432`) and Redis (host port `6379`). Start both with `docker compose up -d`.
- Run execution is asynchronous and resilient to worker restarts: pending runs are reconciled on worker startup, and BullMQ failed/stalled jobs mark matching DB runs failed.
- AI test generation is runtime-configurable from the app. Users can select Anthropic or local Ollama, save settings, test the connection, and use the existing generate -> review/edit flow without backend restarts.
- A Chrome MV3 recorder extension now lives in `frontend/recorder-extension`; load it as an unpacked extension during local development.
- `progress.md` tracks checkpoints. `plan.md` defines the broader MVP. A Graphify run exists in `graphify-out/`.

## Completed in Latest Session
- **Completed milestone:** Extract shared recorder selector policy (`design-001-shared-recorder-selector-policy` in `design-improvement-progress.json`).
- **Branch:** `design/001-shared-recorder-selector-policy`.
- **PR:** [#18](https://github.com/jakegibs617/qa-automation-tool/pull/18) — merged (squash).
- **What changed in `frontend/recorder-extension/`:**
  - New `selector-policy.js` is now the single implementation of `targetFromElement`, `attr`, `visibleText`, `explicitOrInferredRole`, `cssSelector`, `cssEscape`, and test-id detection (`TEST_ID_ATTRS`) — previously byte-duplicated across `content-script.js` and `recorder-core.js`.
  - Because MV3 declarative `content_scripts` cannot be loaded as ES modules, `selector-policy.js` deliberately avoids `import`/`export` syntax and instead assigns one namespace onto `globalThis.RecorderSelectorPolicy`. `manifest.json`'s `content_scripts[].js` now lists `["selector-policy.js", "content-script.js"]` so both classic scripts share the same execution context. `recorder-core.js` (a real ES module, used by `background.js`/`popup.js`/the Node smoke test) does a side-effect `import './selector-policy.js'` and destructures off the same global object, so there is exactly one implementation left, not two kept in sync by hand.
  - `frontend/scripts/smoke-recorder.mjs`: added an identity assertion that `recorder-core.js`'s `targetFromElement` **is** `RecorderSelectorPolicy.targetFromElement` (not a copy), plus a static check that `content-script.js` no longer contains any of the duplicated helper function definitions.
- **Tests/validation run:** `cd frontend && npm run smoke:recorder`, `npm run lint`, `npm run build`, `npm run smoke:app-shell` — all passed. Backend suites untouched by this change were not re-run.
- **Review note:** The review subagent's `gh pr review --approve` was rejected by GitHub as self-approval (PR author and reviewer share the same authenticated `gh` account in this environment); it posted its verdict as a `--comment` review instead. The review was substantive (read full files on the branch, diffed selector logic against `main`, ran the test suite, and empirically reintroduced+reverted a duplicate helper to prove the new smoke assertion actually catches the regression) but carries no formal GitHub "approved" status. **This will recur for every task in the design-debt loop** — there is no second GitHub identity available to grant real approval in this environment.
- **Note on environment:** SSH (port 22) to GitHub is unreachable from this sandbox; the `origin` remote was switched to HTTPS (`git remote set-url origin https://github.com/jakegibs617/qa-automation-tool.git`) with `gh auth setup-git` configuring the credential helper globally, so plain `git fetch`/`push`/`gh` commands now work without per-command scoping. Also found stale/orphaned worktrees from prior sessions under `/private/tmp/claude-501/.../scratchpad/wt-*` (branches already merged) and an unrelated concurrent-looking checkout on `agent/product-leadership-package` with uncommitted scratch files (`.claude/`, `AGENTS.md`, `docs/`, `workflow.md`) — left untouched; used isolated `git worktree`s off `main` for every task instead of touching that shared checkout.

## Prior Milestone Notes
- Recorder extension selector-resilience / click-capture follow-up landed in PR #16: test-id matching also recognizes `data-test-id`, `data-test`, `data-qa` (not just `data-testid`); `selectorFromTarget` tracks whichever attribute actually matched; click capture falls back to the clicked element itself when no known interactive ancestor is found. A duplicate recorder-extension PR (**#9**, `checkpoint/09-recorder-extension`) was closed without merging — it reimplemented `frontend/recorder-extension/` from scratch in a separate `extension/` directory with no dashboard integration and a bug that would have recorded plaintext password values. Do not resurrect `extension/`.
- MVP demo validation and polish landed in PR #15: local-URL project creation (`baseUrl` accepts `http://localhost:3000`), README updates, and a full live demo loop verified via Playwright browser automation (create project -> import recorder JSON -> save test definition -> trigger run -> view run report).
- Recorder extension (Chrome MV3, `frontend/recorder-extension/`) landed in PR #14: captures click/fill/select/press/goto, selector priority `data-testid` -> `aria-label` -> role/name -> visible text -> CSS, sensitive fields (password/API key/token/secret-like) skipped by default, dashboard has a Recorder JSON import control.
- Worker resilience landed in PR #13.
- Runtime AI providers landed in PR #11, with follow-up PR #12 fixing `AiSettings.ollamaBaseUrl` TypeORM metadata after Docker-backed migration verification.
- AI settings API responses are redacted and never return raw API keys.
- Ollama base URLs are restricted to local/host Docker targets on the expected Ollama endpoint shape.
- CORS defaults to `CORS_ORIGIN=http://localhost:3000`.

## Known Limitations / Follow-Up Items
- The recorder is local/export-import MVP plumbing. It is not packaged for Chrome Web Store distribution and does not sync recordings to the backend.
- Recorder selector generation is deterministic and local; selector healing/AI repair remains a later milestone.
- Recorder click capture now records a click on any element when no known interactive ancestor matches (not just semantic controls/`[role]`), trading recall for potential noise on decorative/non-interactive clicks. Revisit if recordings turn out noisy in practice.
- Review subagent approvals in this environment are never a real GitHub "approve" (self-approval blocked) — see the "Review note" above. Treat "reviewed" in this repo's history as "read by a subagent and commented," not "independently approved," until a second GitHub identity is wired up.
- **Cancel/retry remains later:** the `canceled` status exists on the enum but there is no cancel endpoint; BullMQ `attempts`/`backoff` retry policy is not configured.
- **Secrets are stored plaintext in Postgres for now:** runtime AI provider settings redact secrets from APIs/logs, but do not add encryption-at-rest or auth. Revisit before multi-user or hosted deployment.
- Pre-existing: `npm audit --omit=dev --audit-level=high` reports production advisories needing major Nest/tooling upgrades; out of scope.

## Recommended Goal For Next Session
Continue the design-debt loop: implement `design-002-run-artifact-writer` next from `design-improvement-progress.json` (extract `RunArtifactWriter` out of `TestRunsService`), then `design-003` through `design-006` in order (task 6 depends on task 4 completing first; the rest are independent). Each task gets its own branch off `main`, its own PR, a review subagent, and a merge, per the workflow already used for PR #18. Once all 6 are done, fall back to `plan.md`'s Feature 5 (Scheduling) or Feature 6 (Notifications) for the next product milestone — check `plan.md` against the actual codebase first, its "Active Priorities" section is stale.

## Notes for the Next Agent
- Use NestJS + TypeORM in `backend/`; keep `npm`.
- Start infra: `docker compose up -d` (Postgres on `55432`, Redis on `6379`). Run migrations: `cd backend && npm run migration:run`.
- Start backend: `cd backend && npm run dev`. Start frontend: `cd frontend && npm run dev`.
- Load the recorder extension from `frontend/recorder-extension` via Chrome's unpacked extension flow.
- The Playwright runner needs browsers installed locally (`npx playwright install chromium`).
- The frontend uses `NEXT_PUBLIC_API_URL` (default `http://localhost:4000`); Next.js 16 / React 19 / Tailwind / lucide.
- Backend tests are Jest (`npm test`); smoke scripts are `smoke:checkpoint{2,4,5,7,9}`. Frontend smokes are `smoke:app-shell` and `smoke:recorder`.

## Prompt for Next Agent

You are continuing this project from the current `main` branch.

Start by reading `agent-handoff.md`, `design-improvement-progress.json`, `design-patterns-first-principles-audit.md`, `progress.md`, `plan.md`, the README, and the relevant test/smoke scripts.

A design-debt refactor loop is in progress. Task 1 (`design-001-shared-recorder-selector-policy`) is done — see "Completed in Latest Session" above and PR #18. Continue with `design-002-run-artifact-writer` in `design-improvement-progress.json`: extract `RunArtifactWriter` out of `backend/src/test-runs/test-runs.service.ts` (move `writeRunArtifacts`/`saveArtifact` responsibilities into a new injectable service; keep artifact storage keys, placeholder behavior, content types, and best-effort failure handling unchanged). After that, continue through `design-003` .. `design-006` in the order given in the file (task 6 depends on task 4; the rest have no dependencies between them).

For each task:
- Update its `status` to `in_progress` in `design-improvement-progress.json` when you start, then `complete` (with `completedAt`, `pr`, and any noteworthy `notes`) once merged.
- Implement on a new branch off `main` (an isolated `git worktree` is recommended — see environment note below).
- Add/update focused unit tests, then run the task's own `verificationCommands` plus:
  - `cd backend && npm test && npm run build`
  - `cd frontend && npm run lint && npm run build`
  - `cd backend && npm run smoke:checkpoint2 && npm run smoke:checkpoint4 && npm run smoke:checkpoint5 && npm run smoke:checkpoint7 && npm run smoke:checkpoint9`
  - `cd frontend && npm run smoke:app-shell && npm run smoke:recorder`
- Open a PR, spawn a review subagent to post feedback on GitHub, address any real findings, and merge when clean. Note: the review subagent cannot formally GitHub-approve since it shares the PR author's `gh` identity — it will post its verdict as a comment instead; that's expected, not a bug to fix.
- Update `agent-handoff.md` afterward with the completed milestone, PR link, tests run, known limitations, and a fresh copy/paste prompt for the next session (fold this into the same branch/PR for the next task rather than a separate PR, to avoid doubling the PR count across 6 tasks).

Do not work beyond the design-debt list's stated scope for each task — e.g. `design-005` (AI provider adapters) is explicitly optional/deferrable per its own notes if it turns out to add more ceremony than value; use judgment and say so in the handoff if you decide to skip or simplify it. Once all 6 design-debt tasks are done (or deliberately deferred with reasoning recorded), move to `plan.md`'s Feature 5 (Scheduling) or Feature 6 (Notifications) — verify against the actual codebase first, `plan.md`'s "Active Priorities" section is stale.

Note: SSH (port 22) to GitHub is unreachable from this sandbox. `origin` is already configured for HTTPS with `gh auth setup-git` as the global credential helper, so plain `git fetch`/`push`/`gh` commands work directly — no need to re-scope credential.helper per command. Also check for stale worktrees under `/private/tmp/claude-501/.../scratchpad/wt-*` and prune (`git worktree remove`/`git branch -D`) once their branches are merged; and check whether another agent session is concurrently using the shared checkout (unexpected branch/uncommitted scratch files) before touching it — prefer an isolated `git worktree` off `main` instead.
