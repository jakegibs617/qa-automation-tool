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

## Next
- Wire real Playwright execution into `StepDispatcherService` so assertions can fail and produce real failure screenshots/traces.
- Add run history/run detail polling or live status for `running` runs.
