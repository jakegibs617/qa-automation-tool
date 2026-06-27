# Agent Handoff

## Current Repo State
- Work completed on branch `agent/runtime-ai-providers`.
- Latest completed milestone in this session: **runtime-configurable AI test-generation providers**.
- NestJS backend in `backend/` listens on `http://localhost:4000`. Next.js frontend in `frontend/` listens on `http://localhost:3000`.
- `docker-compose.yml` provides PostgreSQL (host port `55432`) and Redis (host port `6379`). Start both with `docker compose up -d`.
- Run execution is asynchronous: the run endpoint enqueues a BullMQ job and returns a `queued` run immediately; a background worker drives `queued` -> `running` -> `passed`/`failed`.
- AI test generation is now runtime-configurable from the app. Users can select Anthropic or local Ollama, save settings, test the connection, and use the existing generate -> review/edit flow without backend restarts.
- `progress.md` tracks all checkpoints. `plan.md` defines the broader MVP. A Graphify run exists in `graphify-out/`.

## Completed in Latest Session
- **Completed milestone:** Runtime-configurable AI test-generation providers.
- **Branch:** `agent/runtime-ai-providers`.
- **PR:** #11 (`agent/runtime-ai-providers` -> `main`).
- **Merged into main:** yes.
- **Tests run:**
  - `cd backend && npm test -- --runTestsByPath src/ai/ai-test-generation.service.spec.ts src/ai/ai-settings.service.spec.ts` (21 focused AI tests pass)
  - `cd backend && npm test` (67 Jest tests pass)
  - `cd backend && npm run build`
  - `cd backend && npm run smoke:checkpoint2`
  - `docker compose up -d postgres redis && cd backend && npm run migration:run`
  - `cd backend && npm run smoke:checkpoint4 && npm run smoke:checkpoint5 && npm run smoke:checkpoint7`
  - `cd frontend && npm run lint && npm run build`
  - `cd frontend && npm run smoke:app-shell`
  - `git diff --check`
- **Post-merge fix:** Docker-backed migration verification initially caught a TypeORM metadata issue on `AiSettings.ollamaBaseUrl`; fixed by declaring the column type explicitly as `varchar(500)`.
- **Review:** A review subagent reviewed the final diff. Findings addressed:
  - Restricted CORS to `CORS_ORIGIN` (default `http://localhost:3000`) instead of allowing all browser origins.
  - Restricted Ollama base URLs to local/host Docker targets on the expected Ollama endpoint shape to avoid server-side arbitrary fetches.
  - Added a 30s timeout to Ollama HTTP calls.
  - Scoped AI-generated `startUrl`, `goto`, and `assertUrl` absolute URLs to the supplied project `baseUrl` origin.
  - Removed the hardcoded migration seed so service-created defaults can honor env defaults.
  - Reset model defaults when switching providers in the UI.
  - Added explicit saved-key clearing and allowed connection tests for disabled settings.

## Important Implementation Notes
- New persistent settings model/API:
  - `backend/src/ai/ai-settings.entity.ts`
  - `backend/src/ai/ai-settings.dto.ts`
  - `backend/src/ai/ai-settings.service.ts`
  - `backend/src/database/migrations/1719254400000-CreateAiSettings.ts`
- New/updated endpoints:
  - `GET /ai/settings` returns redacted settings only (`hasAnthropicApiKey`, `hasSavedAnthropicApiKey`, `usesEnvAnthropicApiKey`), never raw API keys.
  - `PUT /ai/settings` saves provider/model/enabled plus provider-specific config.
  - `POST /ai/settings/test` tests transient settings merged with saved secrets where appropriate.
  - `POST /ai/generate-steps` keeps the existing frontend contract and uses the saved runtime provider.
- Anthropic behavior:
  - Uses the saved key when present; falls back to `ANTHROPIC_API_KEY`.
  - Uses saved model, seeded from `ANTHROPIC_MODEL` or `claude-opus-4-8` when the settings row is first created.
- Ollama behavior:
  - Calls `/api/generate` with `stream: false` and the existing structured JSON schema.
  - Default model is `OLLAMA_MODEL` or `llama3.1`; default base URL is `OLLAMA_BASE_URL` or `http://localhost:11434`.
  - Allowed base URL hosts are `localhost`, `127.0.0.1`, `::1`, and `host.docker.internal`.
- Frontend:
  - `frontend/app/page.tsx` now includes an AI provider settings panel in the right-side work area.
  - Existing “Generate steps with AI” flow still fills name/start URL/steps for review before saving.
  - `frontend/lib/api.ts` includes typed settings/test APIs.
- `.env.example` documents runtime AI settings defaults and the Docker-on-macOS/Windows Ollama URL.

## Known Limitations / Follow-Up Items
- **Worker resilience remains next:** if the worker process dies mid-`executeRun`, the DB row can stay `running` and the UI polls indefinitely. Needs BullMQ stalled-event handling plus a reconciliation sweep that marks orphaned runs `failed` on boot.
- **Secrets are stored plaintext in Postgres for now:** this milestone redacts secrets from APIs/logs, but does not add encryption-at-rest or auth. That should be revisited before multi-user or hosted deployment.
- **Cancel/retry remains later:** the `canceled` status exists on the enum but there is no cancel endpoint; BullMQ `attempts`/`backoff` retries are not configured.
- Pre-existing: `npm audit --omit=dev --audit-level=high` still reports production advisories needing major Nest/tooling upgrades; out of scope.

## Recommended Goal For Next Session
Implement **worker resilience — recover orphaned `running`/`queued` runs** so a worker restart never leaves the run lifecycle stuck in a non-terminal state.

This is now the best next milestone because runtime AI providers are in place, and the remaining async-run crash recovery issue directly affects reliability of the core runner workflow.

## Next Milestone: Worker resilience — recover orphaned `running`/`queued` runs
Make the async run lifecycle crash-safe.

Scope:
- On worker startup, reconcile runs left in `running` and mark them `failed` with a clear `errorMessage` such as `Run interrupted by worker restart`.
- Reconcile `queued` DB runs whose BullMQ job is missing or terminal in a way the DB did not observe.
- Wire BullMQ stalled/failed job handling in `RunWorkerService` so corresponding DB runs transition to `failed`.
- Add focused unit tests for reconciliation and stalled/failed job handling.
- Add or extend a smoke check for a simulated interrupted run if Docker/Redis are available.
- Keep changes scoped: do not implement cancel endpoints, retries/backoff policy, scheduling, Slack notifications, auth, recorder, AI failure analysis, or selector healing.

## Notes for the Next Agent
- Use NestJS + TypeORM in `backend/`; keep `npm`.
- Start infra: `docker compose up -d` (Postgres on `55432`, Redis on `6379`). Run migrations: `cd backend && npm run migration:run`. Start backend: `cd backend && npm run dev`. Start frontend: `cd frontend && npm run dev`.
- The Playwright runner needs browsers installed locally (`npx playwright install chromium`).
- The frontend uses `NEXT_PUBLIC_API_URL` (default `http://localhost:4000`); Next.js 16 / React 19 / Tailwind / lucide. Keep it a practical QA operations shell.
- Backend tests are Jest (`npm test`); smoke scripts are `smoke:checkpoint{2,4,5,7}`. `checkpoint7` requires Redis.

## Prompt for Next Agent

You are continuing this project from the current `main` branch.

Start by reading `agent-handoff.md`, `progress.md`, the README, and the relevant test suite.

Your task is to implement the next milestone:

**Worker resilience — recover orphaned `running`/`queued` runs**

Scope:
- On worker startup, reconcile runs stuck in `running` and mark them `failed` with a clear `errorMessage`.
- Reconcile `queued` DB runs whose BullMQ job is missing or already failed/completed without the DB being updated.
- Wire BullMQ stalled/failed event handling in `RunWorkerService` so stalled jobs transition the matching DB run to `failed`.
- Add focused unit tests for the reconciliation behavior and event handling.
- Run focused tests, the full backend Jest suite, backend build, frontend lint/build if touched, and Docker/Redis-backed smokes when Docker is available.

Do not work beyond this milestone: no cancel endpoint, retry/backoff policy, scheduling, Slack notifications, auth, recorder, AI failure analysis, or selector healing.
