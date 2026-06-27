# Agent Handoff

## Current Repo State
- Latest completed milestone: **Recorder — capture discrete browser actions into structured test steps**.
- PR #14 (`agent/recorder-mvp` -> `main`) implements the milestone.
- NestJS backend in `backend/` listens on `http://localhost:4000`. Next.js frontend in `frontend/` listens on `http://localhost:3000`.
- `docker-compose.yml` provides PostgreSQL (host port `55432`) and Redis (host port `6379`). Start both with `docker compose up -d`.
- Run execution is asynchronous and resilient to worker restarts: pending runs are reconciled on worker startup, and BullMQ failed/stalled jobs mark matching DB runs failed.
- AI test generation is runtime-configurable from the app. Users can select Anthropic or local Ollama, save settings, test the connection, and use the existing generate -> review/edit flow without backend restarts.
- A Chrome MV3 recorder extension now lives in `frontend/recorder-extension`; load it as an unpacked extension during local development.
- `progress.md` tracks checkpoints. `plan.md` defines the broader MVP. A Graphify run exists in `graphify-out/`.

## Completed in Latest Session
- **Completed milestone:** Recorder — capture discrete browser actions into structured test steps.
- **Branch:** `agent/recorder-mvp`.
- **PR:** #14 (`agent/recorder-mvp` -> `main`).
- **Merged into main:** yes.
- **Tests run:**
  - `cd frontend && npm run smoke:recorder`
  - `cd frontend && npm run lint && npm run build && npm run smoke:app-shell`
  - `cd backend && npm test && npm run build` (77 Jest tests pass)
  - `docker compose up -d postgres redis && cd backend && npm run migration:run`
  - `cd backend && npm run smoke:checkpoint2 && npm run smoke:checkpoint4 && npm run smoke:checkpoint5 && npm run smoke:checkpoint7 && npm run smoke:checkpoint9`
  - `git diff --check`
- **Important implementation notes:**
  - `frontend/recorder-extension/manifest.json` defines a local MV3 Chrome extension.
  - `content-script.js` captures discrete click, fill/change, select/change, key press, and initial navigation actions through the extension background worker.
  - Recording is scoped to the tab/window/origin that started the session so other tabs/sites cannot pollute the flow.
  - Password/API key/token/secret-like form fields are skipped by default and are not stored/exported.
  - `popup.html`/`popup.js` provide start/stop/clear/copy controls and export recorded flows as test-definition JSON.
  - `recorder-core.js` converts recorder actions to the existing MVP step schema, checks recording scope, drops actions flagged sensitive, and applies selector priority: `data-testid` -> `aria-label` -> role/name -> visible text -> CSS.
  - The dashboard test-definition form now has a Recorder JSON import control that fills name, start URL, and steps for review/edit before saving.
  - `frontend/scripts/smoke-recorder.mjs` covers selector priority and action-to-step conversion.

## Prior Milestone Notes
- Worker resilience landed in PR #13.
- Runtime AI providers landed in PR #11, with follow-up PR #12 fixing `AiSettings.ollamaBaseUrl` TypeORM metadata after Docker-backed migration verification.
- AI settings API responses are redacted and never return raw API keys.
- Ollama base URLs are restricted to local/host Docker targets on the expected Ollama endpoint shape.
- CORS defaults to `CORS_ORIGIN=http://localhost:3000`.

## Known Limitations / Follow-Up Items
- The recorder is local/export-import MVP plumbing. It is not packaged for Chrome Web Store distribution and does not sync recordings to the backend.
- Recorder selector generation is deterministic and local; selector healing/AI repair remains a later milestone.
- **Cancel/retry remains later:** the `canceled` status exists on the enum but there is no cancel endpoint; BullMQ `attempts`/`backoff` retry policy is not configured.
- **Secrets are stored plaintext in Postgres for now:** runtime AI provider settings redact secrets from APIs/logs, but do not add encryption-at-rest or auth. Revisit before multi-user or hosted deployment.
- Pre-existing: `npm audit --omit=dev --audit-level=high` reports production advisories needing major Nest/tooling upgrades; out of scope.

## Recommended Goal For Next Session
Run an **MVP demo validation and polish pass** across the creation/execution loop: project -> AI or recorder-created definition -> queued run -> artifacts/run detail.

This is the right next unit because both active priorities from `plan.md` (AI generation and Recorder) are now implemented. The product is ready for a cohesive demo pass before adding larger new surfaces like scheduling or notifications.

## Next Milestone: MVP demo validation and polish
Make the current MVP loop smooth enough to demo end to end.

Scope:
- Walk through a fresh local setup with Docker, migrations, backend, frontend, and the recorder extension.
- Create a project, import a recorder flow or generate with AI, save a definition, run it, and inspect artifacts.
- Fix small UX or integration rough edges found in that loop.
- Update README/setup docs for the recorder extension and current smoke commands.
- Add smoke coverage only where it catches a real integration gap.
- Keep changes scoped: do not add scheduling, Slack notifications, auth, AI failure analysis, selector healing, or hosted extension packaging in this milestone.

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

Start by reading `agent-handoff.md`, `progress.md`, `plan.md`, the README, and the relevant test/smoke scripts.

Your task is to implement the next milestone:

**MVP demo validation and polish**

Scope:
- Validate the full current MVP flow locally: project -> AI-generated or recorder-imported test definition -> async run -> run detail/artifacts.
- Load and use the Chrome extension from `frontend/recorder-extension`.
- Fix small scoped issues that block or materially weaken that demo loop.
- Update README/setup docs for recorder usage and current verification commands.
- Run focused checks, full relevant suites, builds, and smoke checks.

Do not work beyond this milestone: no scheduling, Slack notifications, auth, AI failure analysis, selector healing, or hosted extension packaging.
