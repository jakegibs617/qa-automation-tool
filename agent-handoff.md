# Agent Handoff

## Current Repo State
- Work for Checkpoint 5 is on branch `checkpoint/05-playwright-runner` (branched from `main`), pending PR/merge.
- Latest commit on `main` is `e090c6e Merge pull request #2 from jakegibs617/checkpoint/04-artifacts-run-detail`.
- Checkpoints 1, 2, 3, and 4 are implemented and merged. Checkpoint 5 (real Playwright runner) is implemented on the working branch.
- NestJS backend exists in `backend/` and listens on `http://localhost:4000`.
- Next.js frontend exists in `frontend/` and listens on `http://localhost:3000`.
- Local PostgreSQL is provided by `docker-compose.yml` and published on host port `55432`.
- `progress.md` shows Checkpoint 5 completed and verified.
- `plan.md` defines the broader MVP: projects, test definitions, runner, run history, scheduling, notifications, artifacts, and AI workflows.
- A Graphify run exists in `graphify-out/`.

## Completed Work
- Checkpoint 1: PostgreSQL + TypeORM configuration, core entities (`Project`, `TestDefinition`, `TestRun`, `Artifact`), and initial migration.
- Checkpoint 2: test definition model and runner scaffolding (`TestDefinitionsModule`, `TestRunsModule`, MVP step validation, run creation/execution stub, `npm run smoke:checkpoint2`).
- Checkpoint 3: Next.js frontend app shell (project list/create, definition create/list, run trigger, run history; `npm run smoke:app-shell`).
- Checkpoint 4: `ArtifactStorageService` (local-disk under `ARTIFACTS_DIR`), structured `report.json` log artifact, `ArtifactsModule` content/streaming endpoints, frontend run detail route `/runs/[runId]`, `npm run smoke:checkpoint4`.
- Checkpoint 5: real Playwright execution.
  - `StepDispatcherService` (`backend/src/test-runs/step-dispatcher.service.ts`) now executes real Playwright actions against a live `Page` for every supported step type. A `resolveUrl` helper resolves relative `goto`/`assertUrl` targets against the project `baseUrl`. Actions throw on failure (timeout, missing element, failed assertion).
  - New `PlaywrightRunnerService` (`backend/src/test-runs/playwright-runner.service.ts`) owns the headless Chromium lifecycle: launches a browser/context with tracing, navigates to the definition `startUrl`, runs each step, and on failure captures a real PNG screenshot (`page.screenshot`) and a Playwright trace zip. On success tracing is stopped and discarded. Operational test failures are returned in the `RunnerOutcome` rather than thrown; a failed initial navigation is reported as `failureStep` 0. Browser/temp cleanup is in a `finally`. Default action timeout is `PLAYWRIGHT_TIMEOUT_MS` (15s).
  - `TestRunsService` (`backend/src/test-runs/test-runs.service.ts`) loads the definition with its `project` relation, delegates execution to `PlaywrightRunnerService`, and persists the real `failure.png` (`image/png`) and `trace.zip` (`application/zip`) on failure. The SVG/JSON placeholder builders in `run-report.ts` are now only a fallback used when real capture returns null. Artifact persistence remains best-effort. If the runner itself throws (infra error), the run is saved as `failed` with the error message.
  - `PlaywrightRunnerService` is registered in `TestRunsModule` providers.
  - Added `npm run smoke:checkpoint5` (`backend/scripts/checkpoint5-smoke.ts`): DB-free, launches real Chromium against an in-process HTTP server and asserts the passing path (no failure artifacts), the failing path (real PNG screenshot + zip trace buffers), and the navigation-failure path. The checkpoint 2 smoke no longer calls the dispatcher directly (it needs a live page now); it still covers DTO validation.

## Verification Already Performed (Checkpoint 5)
- `cd backend && npm run build`
- `cd backend && npm run smoke:checkpoint2 && npm run smoke:checkpoint4 && npm run smoke:checkpoint5`
- Full-stack API smoke against local Postgres (`docker compose up -d postgres`, `npm run migration:run`, `npm run dev`):
  - created a project whose `baseUrl` pointed at a local static page server,
  - created a definition with a deliberately failing `assertText` and ran it,
  - confirmed `status: failed`, `failureStep: 2`, a descriptive `errorMessage`, and three artifacts: `report.json` (log), `failure.png` (`image/png`, real 1280×720 screenshot), `trace.zip` (`application/zip`),
  - downloaded the screenshot via `GET /artifacts/:id/content` and confirmed correct `Content-Type`/`Content-Disposition` and real PNG bytes,
  - confirmed a passing run produced only the `report.json` log artifact (no failure screenshot/trace).

## Goal for Next Agent
Move run execution off the request path so the UI can reflect live `queued`/`running` status, and/or harden the runner.

## Recommended Next Work
1. Create or switch to a dedicated branch, e.g. `checkpoint/06-async-runs`.
2. Move run execution to a background worker (BullMQ + ioredis are already dependencies). NOTE: there is no Redis service in `docker-compose.yml` yet — add one. The run endpoint should enqueue and return immediately with status `queued`; the worker transitions `queued` → `running` → `passed`/`failed`.
3. Add run-detail/run-history polling (or SSE/websocket) in the frontend so `running` runs update live. The run detail route is `frontend/app/runs/[runId]/page.tsx`.
4. Optionally capture video and richer per-step output in `report.json`.
5. Add focused smoke checks for the async path and update `progress.md` when finished.

## Notes for the Next Agent
- Use NestJS + TypeORM in `backend/`; keep `npm` as the package manager.
- Backend defaults are in `backend/.env.example`; Compose PostgreSQL uses `DB_PORT=55432`. Start it with `docker compose up -d postgres`, run migrations with `cd backend && npm run migration:run`.
- Start backend with `cd backend && npm run dev`; start frontend with `cd frontend && npm run dev`.
- The Playwright runner needs browsers installed locally (`npx playwright install chromium`); they were already present in the dev environment used for Checkpoint 5.
- The frontend uses `NEXT_PUBLIC_API_URL`, defaulting to `http://localhost:4000`; Next.js 16 / React 19 / Tailwind / lucide icons. Keep it a practical QA operations shell, not a marketing page.
- There is still no formal backend unit test suite; only the smoke scripts exist. Jest tests for DTO validation, `StepDispatcherService`, and `TestRunsService` would be a useful hardening step.
- After implementation, create a PR and perform a code review before merging if the environment supports it.
