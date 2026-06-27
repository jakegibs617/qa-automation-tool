# Agent Handoff

## Current Repo State
- Latest completed milestone: **worker resilience — recover orphaned `running`/`queued` runs**.
- PR #13 (`agent/worker-resilience` -> `main`) implements the milestone.
- NestJS backend in `backend/` listens on `http://localhost:4000`. Next.js frontend in `frontend/` listens on `http://localhost:3000`.
- `docker-compose.yml` provides PostgreSQL (host port `55432`) and Redis (host port `6379`). Start both with `docker compose up -d`.
- Run execution is asynchronous: the run endpoint enqueues a BullMQ job and returns a `queued` run immediately; a background worker drives `queued` -> `running` -> `passed`/`failed`.
- AI test generation is runtime-configurable from the app. Users can select Anthropic or local Ollama, save settings, test the connection, and use the existing generate -> review/edit flow without backend restarts.
- `progress.md` tracks checkpoints. `plan.md` defines the broader MVP. A Graphify run exists in `graphify-out/`.

## Completed in Latest Session
- **Completed milestone:** Worker resilience — recover orphaned `running`/`queued` runs.
- **Branch:** `agent/worker-resilience`.
- **PR:** #13 (`agent/worker-resilience` -> `main`).
- **Merged into main:** yes.
- **Tests run:**
  - `cd backend && npm test -- --runTestsByPath src/test-runs/test-runs.service.spec.ts src/test-runs/run-worker.service.spec.ts` (24 focused test-run resilience tests pass)
  - `docker compose up -d postgres redis && cd backend && npm run migration:run && npm run smoke:checkpoint9`
  - `cd backend && npm test` (77 Jest tests pass)
  - `cd backend && npm run build`
  - `cd backend && npm run smoke:checkpoint2 && npm run smoke:checkpoint4 && npm run smoke:checkpoint5 && npm run smoke:checkpoint7 && npm run smoke:checkpoint9`
  - `git diff --check`
- **Important implementation notes:**
  - `RunWorkerService.onModuleInit()` now reconciles pending runs before creating the BullMQ worker.
  - `TestRunsService.reconcilePendingRuns()` marks `running` runs failed with `Run interrupted by worker restart`.
  - Queued DB runs are checked against BullMQ via `RunQueueService.getRunJobState(runId)`; missing/failed/completed/unknown jobs are marked failed instead of polling forever.
  - Worker `failed` and `stalled` events call `TestRunsService.markRunInterrupted()` for the matching pending run. Terminal runs are not overwritten.
  - Added `backend/scripts/checkpoint9-smoke.ts` and `npm run smoke:checkpoint9` to validate orphaned-run reconciliation against real Postgres + Redis.

## Prior Milestone Notes
- Runtime AI providers landed in PR #11, with follow-up PR #12 fixing `AiSettings.ollamaBaseUrl` TypeORM metadata after Docker-backed migration verification.
- AI settings API responses are redacted (`hasAnthropicApiKey`, `hasSavedAnthropicApiKey`, `usesEnvAnthropicApiKey`) and never return raw API keys.
- Ollama base URLs are restricted to local/host Docker targets on the expected Ollama endpoint shape.
- CORS defaults to `CORS_ORIGIN=http://localhost:3000`.

## Known Limitations / Follow-Up Items
- **Cancel/retry remains later:** the `canceled` status exists on the enum but there is no cancel endpoint; BullMQ `attempts`/`backoff` retry policy is not configured.
- **Secrets are stored plaintext in Postgres for now:** runtime AI provider settings redact secrets from APIs/logs, but do not add encryption-at-rest or auth. Revisit before multi-user or hosted deployment.
- Pre-existing: `npm audit --omit=dev --audit-level=high` reports production advisories needing major Nest/tooling upgrades; out of scope.

## Recommended Goal For Next Session
Implement the **Recorder** milestone so users can create tests by capturing browser actions instead of writing JSON or relying only on AI prompts.

This is the next best product milestone because the core run lifecycle is now much more reliable, and the MVP still needs a low-code creation path: discrete browser actions -> resilient-selector test steps.

## Next Milestone: Recorder
Capture discrete browser actions and convert them into the existing structured step schema.

Scope:
- Build the Chrome extension/browser recorder flow described in `plan.md`.
- Capture discrete actions only: navigation, clicks, fills, presses, selects, waits/assertions if explicitly supported.
- Do not store continuous mouse movement; use pointer movement only to infer current targets if needed.
- Generate resilient selectors in order: `data-testid` -> `aria-label` -> role -> visible text -> CSS.
- Export/import recorded actions as the same MVP test-step JSON schema already used by the runner and AI generation.
- Add focused tests around selector preference and action-to-step conversion.
- Keep changes scoped: do not add scheduling, Slack notifications, auth, AI failure analysis, selector healing, or hosted deployment hardening in this milestone.

## Notes for the Next Agent
- Use NestJS + TypeORM in `backend/`; keep `npm`.
- Start infra: `docker compose up -d` (Postgres on `55432`, Redis on `6379`). Run migrations: `cd backend && npm run migration:run`.
- Start backend: `cd backend && npm run dev`. Start frontend: `cd frontend && npm run dev`.
- The Playwright runner needs browsers installed locally (`npx playwright install chromium`).
- The frontend uses `NEXT_PUBLIC_API_URL` (default `http://localhost:4000`); Next.js 16 / React 19 / Tailwind / lucide.
- Backend tests are Jest (`npm test`); smoke scripts are `smoke:checkpoint{2,4,5,7,9}`. Checkpoint 7/9 require Redis; checkpoint 9 also uses Postgres.

## Prompt for Next Agent

You are continuing this project from the current `main` branch.

Start by reading `agent-handoff.md`, `progress.md`, `plan.md`, the README, and the relevant test suite.

Your task is to implement the next milestone:

**Recorder — capture discrete browser actions into structured test steps**

Scope:
- Build the initial recorder flow for discrete actions -> test-step JSON.
- Prefer resilient selectors in this order: `data-testid`, `aria-label`, role, visible text, CSS.
- Support MVP step types where practical: `goto`, `click`, `fill`, `press`, `select`, `wait`, `assertText`, `assertVisible`, `assertUrl`.
- Preserve the existing runner schema and generate test definitions that can be reviewed/edited before saving.
- Add focused tests for selector generation and action-to-step conversion.
- Run focused tests, full relevant suites, builds, and smoke checks.

Do not work beyond this milestone: no scheduling, Slack notifications, auth, AI failure analysis, selector healing, or deployment hardening.
