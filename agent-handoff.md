# Agent Handoff

## Current Repo State
- **The design-debt refactor list in `design-improvement-progress.json` is now fully complete** (source audit: `design-patterns-first-principles-audit.md`). All 6 tasks are merged: design-001 (PR #18), design-002 (PR #20), design-003 (PR #21), design-004 (PR #22), design-005 + design-006 (PR #23, one combined PR at user direction). The next milestone is a product feature from `plan.md` — see "Recommended Goal For Next Session".
- Prior: Recorder extension selector-resilience / click-capture follow-up (PR #16).
- Prior: MVP demo validation and polish merged in PR #15. Recorder milestone merged in PR #14 (`agent/recorder-mvp` -> `main`).
- A duplicate recorder-extension PR (**#9**, `checkpoint/09-recorder-extension`) was closed without merging — it reimplemented `frontend/recorder-extension/` from scratch in a separate `extension/` directory, branched before PR #14 merged, with no dashboard integration and a bug that would have recorded plaintext password values. Its two genuinely useful ideas were ported into `frontend/recorder-extension/` via PR #16 instead. Do not resurrect `extension/`.
- NestJS backend in `backend/` listens on `http://localhost:4000`. Next.js frontend in `frontend/` listens on `http://localhost:3000`.
- `docker-compose.yml` provides PostgreSQL (host port `55432`) and Redis (host port `6379`). Start both with `docker compose up -d`.
- Run execution is asynchronous and resilient to worker restarts: pending runs are reconciled on worker startup, and BullMQ failed/stalled jobs mark matching DB runs failed.
- AI test generation is runtime-configurable from the app. Users can select Anthropic or local Ollama, save settings, test the connection, and use the existing generate -> review/edit flow without backend restarts. Provider transport now lives behind `AiProviderAdapter` implementations (PR #23).
- A Chrome MV3 recorder extension now lives in `frontend/recorder-extension`; load it as an unpacked extension during local development.
- `progress.md` tracks checkpoints. `plan.md` defines the broader MVP. A Graphify run exists in `graphify-out/`.

## Completed in Latest Session
- **Completed milestones:** `design-005-ai-provider-adapters` and `design-006-shared-test-step-kernel`, plus tracker backfill for design-002/003/004 (those merged earlier as PRs #20/#21/#22 but `design-improvement-progress.json` was never updated at merge time — done here).
- **Branch:** `design/005-006-complete-design-debt` (single PR for both tasks at the user's direction: "complete design-improvement-progress.json and raise one PR").
- **PR:** [#23](https://github.com/jakegibs617/qa-automation-tool/pull/23).
- **design-005 (`backend/src/ai/`):** provider transport moved out of `AiTestGenerationService` into `AnthropicProviderAdapter` and `OllamaProviderAdapter` behind the `AiProviderAdapter` interface (`ai-provider-adapter.ts`, injected via the `AI_PROVIDER_ADAPTERS` token from `ai.module.ts`). The shared system prompt + JSON output schema moved to `generation-prompt.ts`. Prompt construction, step validation, base-URL scoping, and response parsing stay centralized in the service; adapters own only credential checks, the API call, and raw-text extraction. Behavior-preserving — all error messages, the 30s Ollama timeout, and the unsupported-provider 400 are unchanged. `ANTHROPIC_FACTORY` now lives in `anthropic-provider.adapter.ts`. The task's own notes marked it deferrable until a third provider existed; it was implemented anyway to close out the list, with a deliberately minimal adapter surface (one method + one predicate).
- **design-006 (lightweight form, per its own implementation notes):** no shared package/monorepo tooling. The step registry (`backend/src/test-steps/step-registry.ts`, from design-004) remains the single source of truth, and the new `step-language-sync.spec.ts` turns the hand-sync checklist into executable drift detection: AI output schema enumerates exactly the registry step types and covers every step field, the system prompt documents every type, the frontend `TestStep` union (read from `frontend/lib/api.ts` on disk) includes every type, and `recorderActionTypes` stays a subset of registry types. Pointer comments were added at each surface. Revisit a real shared package only if the step language churns enough that these tests become friction.
- **Tests/validation run (all passed):** `cd backend && npm test` (11 suites / 98 tests, includes the new sync spec and unsupported-provider tests), `npm run build`, `npm run smoke:checkpoint2/4/5/7/9` (against live Docker Postgres/Redis after `migration:run`); `cd frontend && npm run lint`, `npm run build`, `npm run smoke:app-shell`, `npm run smoke:recorder`.
- **Note on environment:** SSH (port 22) to GitHub is unreachable from this sandbox; `origin` is HTTPS with `gh auth setup-git` as the global credential helper, so plain `git fetch`/`push`/`gh` work directly. Work happened in an isolated `git worktree` off `main` (the shared checkout has another session's uncommitted scratch files — left untouched). Turbopack (`next build`) rejects a symlinked `node_modules` in a worktree ("points out of the filesystem root") — use a real copy (`cp -ac`) or a fresh `npm ci` instead of symlinking.

## Prior Milestone Notes
- Design-debt tasks 1–4: shared recorder selector policy (`frontend/recorder-extension/selector-policy.js`, PR #18), `RunArtifactWriter` extracted from `TestRunsService` (PR #20), dashboard workflow hooks `useProjectDetail`/`useRunPolling` (PR #21), step handler registry `backend/src/test-steps/step-registry.ts` (PR #22).
- Recorder extension selector-resilience / click-capture follow-up landed in PR #16: test-id matching also recognizes `data-test-id`, `data-test`, `data-qa` (not just `data-testid`); `selectorFromTarget` tracks whichever attribute actually matched; click capture falls back to the clicked element itself when no known interactive ancestor is found.
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
- The step-language sync spec reads `frontend/lib/api.ts` and `recorder-core.js` from disk with regexes — it catches missing step types, not subtler type drift (e.g. a field's optionality). Good enough until the step language changes again.
- Review subagent approvals in this environment are never a real GitHub "approve" (self-approval blocked — PR author and reviewer share the same authenticated `gh` account). Treat "reviewed" in this repo's history as "read by a subagent and commented," not "independently approved," until a second GitHub identity is wired up.
- **Cancel/retry remains later:** the `canceled` status exists on the enum but there is no cancel endpoint; BullMQ `attempts`/`backoff` retry policy is not configured.
- **Secrets are stored plaintext in Postgres for now:** runtime AI provider settings redact secrets from APIs/logs, but do not add encryption-at-rest or auth. Revisit before multi-user or hosted deployment.
- Pre-existing: `npm audit --omit=dev --audit-level=high` reports production advisories needing major Nest/tooling upgrades; out of scope.

## Recommended Goal For Next Session
The design-debt list is done. Move to `plan.md`'s Feature 5 (Scheduling) or Feature 6 (Notifications) for the next product milestone — verify against the actual codebase first, `plan.md`'s "Active Priorities" section is stale. Scheduling is the natural next step: BullMQ is already in place for run execution, so repeatable schedules can build on the existing queue plus a `schedules` table, and notifications would then have scheduled-run results worth notifying about.

## Notes for the Next Agent
- Use NestJS + TypeORM in `backend/`; keep `npm`.
- Start infra: `docker compose up -d` (Postgres on `55432`, Redis on `6379`). Run migrations: `cd backend && npm run migration:run`.
- Start backend: `cd backend && npm run dev`. Start frontend: `cd frontend && npm run dev`.
- Load the recorder extension from `frontend/recorder-extension` via Chrome's unpacked extension flow.
- The Playwright runner needs browsers installed locally (`npx playwright install chromium`).
- The frontend uses `NEXT_PUBLIC_API_URL` (default `http://localhost:4000`); Next.js 16 / React 19 / Tailwind / lucide.
- Backend tests are Jest (`npm test`); smoke scripts are `smoke:checkpoint{2,4,5,7,9}`. Frontend smokes are `smoke:app-shell` and `smoke:recorder`.
- Adding a step type? Start at `backend/src/test-steps/step-registry.ts` — its header comment lists every surface to update, and `step-language-sync.spec.ts` fails on drift.
- There is an in-app tutorial; extend it whenever a user-facing feature ships (design-debt refactors did not need it).

## Prompt for Next Agent

You are continuing this project from the current `main` branch.

Start by reading `agent-handoff.md`, `plan.md`, `progress.md`, the README, and `design-improvement-progress.json` (all 6 design-debt tasks are complete — PRs #18, #20–#23; that loop is closed, do not reopen it).

Your milestone: implement **Feature 5 (Scheduling)** from `plan.md` — but first verify `plan.md` against the actual codebase, since its "Active Priorities" section is stale. Scope a minimal end-to-end slice: a schedule model (cron or interval) attached to a test definition, a BullMQ repeatable job (Redis is already in place) that enqueues runs on schedule, CRUD API endpoints, and a small frontend surface to create/enable/disable a schedule and see the next run time. Reuse the existing run-execution pipeline (`RunQueueService` / worker) rather than adding a second execution path. If Feature 5 turns out to already be partially built or ill-defined, fall back to Feature 6 (Notifications) and say so in the handoff.

Workflow (same as prior milestones):
- Implement on a new branch off `main` (an isolated `git worktree` is recommended — see environment note below).
- Add/update focused unit tests, then run: `cd backend && npm test && npm run build`; `cd frontend && npm run lint && npm run build`; `cd backend && npm run smoke:checkpoint2/4/5/7/9`; `cd frontend && npm run smoke:app-shell && npm run smoke:recorder`. New backend behavior with infrastructure (repeatable jobs) deserves its own smoke script.
- Open a PR, spawn a review subagent to post feedback on GitHub, address any real findings, and merge when clean. Note: the review subagent cannot formally GitHub-approve since it shares the PR author's `gh` identity — it posts its verdict as a comment instead; that's expected, not a bug to fix.
- Extend the in-app tutorial for the new user-facing feature.
- Update `agent-handoff.md` (same branch/PR) with the completed milestone, PR link, tests run, known limitations, and a fresh copy/paste prompt for the next session.

Environment notes: SSH (port 22) to GitHub is unreachable from this sandbox; `origin` is already HTTPS with `gh auth setup-git` as the global credential helper, so plain `git fetch`/`push`/`gh` work directly. Check for stale worktrees under `/private/tmp/claude-501/.../scratchpad/wt-*` and prune (`git worktree remove` / `git branch -D`) once their branches are merged. Another agent session may be using the shared checkout (unexpected branch/uncommitted scratch files) — prefer an isolated `git worktree` off `main`. If you symlink `node_modules` into a worktree, Turbopack (`next build`) will reject it — use a real copy (`cp -ac`) or `npm ci` for the frontend.
