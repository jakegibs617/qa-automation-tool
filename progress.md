# Progress Tracker

## Completed
- Initialized Git repository and pushed initial commit.
- Scaffolding backend with NestJS and a `Project` entity.
- Checkpoint 1 database schema: PostgreSQL TypeORM config, core entities, and migration/schema sync scripts.
- Verified Checkpoint 1 with `npm run build`, `npm run migration:run`, and `GET /projects` against local Compose Postgres on host port `55432`.
- Checkpoint 2 test definition and runner scaffolding: definition APIs, MVP step validation, run creation/execution stub, run logs, and log artifact records.
- Verified Checkpoint 2 with `npm run build`, `npm run migration:run`, `npm run smoke:checkpoint2`, and an API smoke against local Postgres.
- Checkpoint 3 frontend app shell: Next.js, TypeScript, Tailwind, project navigation, project creation, test definition creation, run trigger, and run history views.
- Verified Checkpoint 3 with `npm run build` and `npm run smoke:app-shell` in `frontend/`.
- Checkpoint 4 artifact detail views and richer runner outputs:
  - Local-disk artifact storage (`ArtifactStorageService`, configurable via `ARTIFACTS_DIR`, defaults to `backend/.artifacts`).
  - Runner now records per-step structured results and writes a structured `report.json` log artifact; failed runs additionally write an SVG failure-screenshot placeholder and a trace placeholder record.
  - `ArtifactsModule` endpoints: `GET /test-runs/:id/artifacts`, `GET /artifacts/:id`, and `GET /artifacts/:id/content` (streams content with correct content type/disposition).
  - Frontend run detail route `/runs/[runId]` showing status, duration, timestamp, failure step, error, structured steps, logs, and a downloadable artifact list; run history rows link into it.
- Verified Checkpoint 4 with `npm run build` + `npm run smoke:checkpoint4` (backend), `npm run build` + `npm run smoke:app-shell` (frontend), and a full-stack API smoke against local Postgres (created project/definition, ran it, confirmed `passed` status, persisted `report.json` log artifact, and content retrieval with correct headers). Failure-path artifacts (screenshot/trace) are covered by the unit smoke since the stub dispatcher does not fail for valid steps yet.
- Checkpoint 5 real Playwright runner:
  - `StepDispatcherService` now executes real Playwright actions against a live `Page` (`goto`, `click`, `fill`, `press`, `select`, `wait`, `assertText`, `assertVisible`, `assertUrl`), with relative URLs resolved against the project `baseUrl`.
  - New `PlaywrightRunnerService` owns the headless Chromium lifecycle: navigates to the definition `startUrl`, runs each step, and on failure captures a real PNG screenshot and a Playwright trace zip (tracing discarded on success). Operational test failures are returned as an outcome, not thrown; a navigation failure is reported as `failureStep` 0.
  - `TestRunsService` delegates execution to the runner, persists the real `failure.png` (`image/png`) and `trace.zip` (`application/zip`) on failure, and falls back to the SVG/JSON placeholders only if capture failed. Artifact persistence remains best-effort.
  - Added `npm run smoke:checkpoint5` (DB-free; launches real Chromium against an in-process server and asserts the passing path, the failing path's real PNG + zip-trace buffers, and the navigation-failure path).
- Verified Checkpoint 5 with `npm run build` + `npm run smoke:checkpoint2/4/5` (backend) and a full-stack API smoke against local Postgres: a failing run produced a real `failure.png` (1280×720, image/png) and `trace.zip` (application/zip) served with correct headers, while a passing run produced only the `report.json` log artifact.
- Backend hardening: added a Jest (ts-jest) unit suite (`npm test`), 41 tests across 4 specs.
  - `run-report.spec.ts`: `buildRunReport` ISO timestamps/duration/passthrough, `buildFailurePlaceholderSvg` XML escaping and step/error rendering (incl. unknown-step fallback), `buildTracePlaceholder` JSON shape.
  - `create-test-definition.spec.ts`: `validateTestStep` per supported step type (incl. optional/negative `wait` timeout, unknown types, missing fields) and `CreateTestDefinitionDto` class-validator rules (UUID, non-empty name, start-URL format, non-empty/valid steps).
  - `step-dispatcher.service.spec.ts`: `resolveUrl` cases and `StepDispatcherService.dispatch` for every step type against a mocked Playwright `Page`, including the assertText/assertUrl/unsupported-type throw paths.
  - `test-runs.service.spec.ts`: `TestRunsService.runTestDefinition` with mocked repos/runner/storage — not-found, runner delegation args, passing run (only `report.json`), failing run (real `failure.png` + `trace.zip`), null-capture placeholder fallback, runner-throws → failed run, best-effort artifact persistence, and final `findOne` reload.
  - `tsconfig.json` excludes `*.spec.ts` from the production build; verified `dist/` contains no spec files after a clean build.

## Next
- Consider moving run execution off the request path (BullMQ + ioredis are already dependencies; no Redis service is defined in `docker-compose.yml` yet) so runs can be `queued`/`running` and polled by the UI.
- Add run history/run detail polling or live status for `running` runs.
- Optionally capture video and expand `report.json` with richer per-step timings/outputs.
