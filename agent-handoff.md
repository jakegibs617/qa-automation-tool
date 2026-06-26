# Agent Handoff

## Current Repo State
- Latest commit on `main` is the merge of PR #5 (`checkpoint/07-async-runs`). Checkpoints 1–7 are implemented and merged. `main` is clean and up to date with `origin/main`.
- NestJS backend in `backend/` listens on `http://localhost:4000`. Next.js frontend in `frontend/` listens on `http://localhost:3000`.
- `docker-compose.yml` provides PostgreSQL (host port `55432`) and Redis (host port `6379`). Start both with `docker compose up -d`.
- Run execution is now **asynchronous**: the run endpoint enqueues a BullMQ job and returns a `queued` run immediately; a background worker drives `queued` → `running` → `passed`/`failed`.
- `progress.md` tracks all checkpoints. `plan.md` defines the broader MVP. A Graphify run exists in `graphify-out/`.

## Completed in Latest Session
- **Completed milestone:** Checkpoint 7 — async run execution (move runs off the request path).
- **PR:** #5 (`checkpoint/07-async-runs`), squash/merge-committed to `main`.
- **Merged into main:** yes.
- **Tests run:**
  - `cd backend && npm run build` (clean; no spec files leak into `dist/`)
  - `cd backend && npm test` (46 Jest tests pass)
  - `docker compose up -d redis && cd backend && npm run smoke:checkpoint7` (queue/worker round-trip vs real Redis)
  - `cd backend && npm run smoke:checkpoint2 && npm run smoke:checkpoint4 && npm run smoke:checkpoint5`
  - `cd frontend && npm run lint && npm run build`
  - Full-stack async flow vs local Postgres + Redis: trigger returned `202`/`queued`; polling observed `running` → `passed` (only `report.json`); a failing definition produced `running` → `failed` with a real `failure.png` + `trace.zip`.
- **Important implementation notes:**
  - New files: `backend/src/test-runs/run-queue.ts` (shared `RUN_QUEUE_NAME`/`RUN_JOB_NAME` + `buildRedisConnection`, which sets `maxRetriesPerRequest: null` and optional `REDIS_PASSWORD`), `run-queue.service.ts` (`RunQueueService.enqueue`), `run-worker.service.ts` (`RunWorkerService` — a BullMQ `Worker` started in `onModuleInit`, closed in `onModuleDestroy`, concurrency from `RUN_WORKER_CONCURRENCY`, default 1).
  - `TestRunsService` split: `enqueueRun(testDefinitionId)` creates a `queued` run, enqueues it, and returns immediately (marks the run `failed` if enqueue throws so it isn't stuck `queued`); `executeRun(runId)` is worker-driven — loads the run + definition, transitions to `running`, drives Playwright, and persists the outcome/artifacts (same artifact logic as before).
  - Controller `POST /test-definitions/:id/runs` now returns `202 Accepted` and calls `enqueueRun`. `RunQueueService`/`RunWorkerService` registered in `TestRunsModule`.
  - Frontend polls every 1.5s while a run is `queued`/`running`: run-detail route (`frontend/app/runs/[runId]/page.tsx`) and dashboard run history (`frontend/app/page.tsx`).
  - `.env.example` gained `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `RUN_WORKER_CONCURRENCY`.
- **Known limitations / follow-up items:**
  - **Stuck-`running` recovery:** if the worker process dies mid-`executeRun`, the DB row stays `running` and the UI polls it indefinitely. Needs BullMQ stalled-event handling + a reconciliation sweep that marks orphaned runs `failed` on boot. (Raised in review; deferred as its own unit of work.)
  - **Cancel/retry:** the `canceled` status exists on the enum but there is no cancel endpoint; BullMQ `attempts`/`backoff` retries are not configured. `jobId: runId` dedupes but there's no idempotency flow yet.
  - Pre-existing: `npm audit --omit=dev --audit-level=high` still reports production advisories needing major Nest/tooling upgrades — out of scope.

## Next Milestone: Worker resilience — recover orphaned `running`/`queued` runs
Make the async run lifecycle crash-safe so a worker restart never leaves a run stuck in a non-terminal state.

Scope:
- On worker startup (or via a small reconciliation service), find runs left in `running` (and `queued` jobs no longer on the queue) and mark them `failed` with a clear `errorMessage` (e.g. "Run interrupted by worker restart").
- Wire BullMQ stalled-job handling: configure `stalledInterval`/`maxStalledCount` and a `failed`/`stalled` handler in `RunWorkerService` that transitions the corresponding DB run to `failed`.
- Add focused unit tests (reconciliation marks orphaned runs failed; stalled handler transitions a run) and extend `smoke:checkpoint7` (or add `smoke:checkpoint8`) to cover a simulated interrupted run.
- Keep `npm` as the package manager; keep changes scoped — do not start the cancel endpoint or retries (that's a later milestone).

## Notes for the Next Agent
- Use NestJS + TypeORM in `backend/`; keep `npm`. Backend defaults in `backend/.env.example`.
- Start infra: `docker compose up -d` (Postgres on `55432`, Redis on `6379`). Run migrations: `cd backend && npm run migration:run`. Start backend: `cd backend && npm run dev`. Start frontend: `cd frontend && npm run dev`.
- The Playwright runner needs browsers installed locally (`npx playwright install chromium`); they were present in the dev environment used for Checkpoint 7.
- The frontend uses `NEXT_PUBLIC_API_URL` (default `http://localhost:4000`); Next.js 16 / React 19 / Tailwind / lucide. Keep it a practical QA operations shell.
- Backend tests are Jest (`npm test`); smoke scripts are `smoke:checkpoint{2,4,5,7}`. `checkpoint7` requires Redis.

## Prompt for Next Agent

You are continuing this project from the current `main` branch.

Start by reading this handoff document, `progress.md`, the README, and the test suite.

Your task is to implement the next milestone:

**Worker resilience — recover orphaned `running`/`queued` runs**

Scope:
- On worker startup (or a reconciliation service), mark runs stuck in `running` (and `queued` jobs missing from the queue) as `failed` with a clear `errorMessage`.
- Wire BullMQ stalled-job handling in `RunWorkerService` so a stalled job transitions its DB run to `failed`.
- Add unit tests for reconciliation + stalled handling, and a smoke check for a simulated interrupted run.

Do not work beyond this milestone (no cancel endpoint, no retry/backoff — those are later).

Before coding:
1. Summarize your understanding of the milestone.
2. Identify expected files to change.
3. Describe the test plan.

During implementation:
1. Add or update unit tests.
2. Run focused tests, then the full Jest suite + smokes (`docker compose up -d redis` first).
3. Open a PR.
4. Spawn a review subagent to review the PR and post its review.
5. Address review feedback.
6. Merge once clean.
7. Update this handoff document with what changed and the next prompt.
