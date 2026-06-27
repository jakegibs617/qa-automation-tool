# Agent Handoff

## Current Repo State
- `main` has checkpoints 1–8 merged and is clean/up to date with origin. Latest merged milestone: **Checkpoint 8 — AI test generation** (PR #8).
- **Checkpoint 9 — browser recorder extension is on branch `checkpoint/09-recorder-extension` and open as PR #9. It is implemented and unit-tested but NOT yet reviewed or merged.** That review + merge is the next agent's first task.
- NestJS backend in `backend/` (`http://localhost:4000`); Next.js frontend in `frontend/` (`http://localhost:3000`); new `extension/` holds the recorder Chrome extension.
- `docker-compose.yml` provides PostgreSQL (host `55432`) and Redis (host `6379`). `docker compose up -d`. These were left running.
- Runs execute asynchronously (BullMQ worker, checkpoint 7). `plan.md` has an "Active Priorities" section: AI generation (done) and the recorder (PR #9).

## Completed in Latest Session
- **Checkpoint 7 — async run execution** (PR #5), **handoff doc** (PR #6), **onboarding tutorial** (PR #7): all merged.
- **Checkpoint 8 — AI test generation** (PR #8, merged): `POST /ai/generate-steps` turns a natural-language prompt into structured steps via Claude (`@anthropic-ai/sdk`, model `claude-opus-4-8`, `output_config` JSON-schema), validated with the runner's own `validateTestStep`. The Anthropic client is injected and `null` when `ANTHROPIC_API_KEY` is unset, so the app boots without a key and the endpoint returns **503** with a clear message. Frontend "Generate steps with AI" panel fills the definition form for review/edit; tutorial gained an AI step. 55 backend tests pass.
- **Checkpoint 9 — recorder extension (PR #9, pending review/merge):** MV3 Chrome extension in `extension/` that records clicks/input/navigation/`<select>` as test steps with resilient selectors (`data-testid → aria-label → role+name → text → CSS`), Playwright-compatible. Core logic in `recorder.js` (shared by the content script and tests); `content.js`/`background.js`/`popup.*`; 15 Jest+jsdom tests pass (`cd extension && npm test`); `extension/README.md` has load/usage instructions.

## Important Notes / Known Limitations
- **No `ANTHROPIC_API_KEY` is set in this environment.** The AI feature is exercised only by mocked unit tests; to demo it live, put a key in `backend/.env` and restart the backend.
- The recorder is a standalone extension: it exports JSON the user pastes into the definition form. It is not yet surfaced in the web app UI, and there is no in-app "import recording" path.
- Open follow-ups from earlier: worker resilience (recover runs orphaned in `running`/`queued` if the worker crashes); a cancel/retry endpoint (the `canceled` status exists but is unwired); `npm audit` production advisories needing major Nest/tooling upgrades.

## Next Milestone (do this first)
**Land the recorder, then make it demoable.**
1. Review and merge **PR #9** (`checkpoint/09-recorder-extension`). Spawn a review subagent per the workflow; address feedback; merge.
2. Surface the recorder in the app for discoverability — e.g. a one-line hint/link near the definition form's steps field, and a corresponding tutorial step (`data-tutorial` target) so the in-app tutorial stays in sync with shipped features.
3. (Optional, higher value) add an "import recorded steps" affordance so a recording can be pulled into the form without manual copy/paste.

Then, with `ANTHROPIC_API_KEY` set, do an **MVP demo pass**: prompt → generate steps → review → run (async) → view artifacts; and record a flow with the extension → paste → run.

## Setup quick reference
- `docker compose up -d` (Postgres 55432, Redis 6379) · `cd backend && npm run migration:run`.
- Backend: `cd backend && npm run dev`. Frontend: `cd frontend && npm run dev`.
- Tests: backend `cd backend && npm test`; extension `cd extension && npm install && npm test`. Backend smokes: `smoke:checkpoint{2,4,5,7}` (checkpoint7 needs Redis).
- Playwright browsers must be installed locally (`npx playwright install chromium`).

## Prompt for Next Agent

You are continuing this project from the current `main` branch (checkpoints 1–8 merged). Read this handoff, `plan.md` (Active Priorities), `progress.md`, and the test suites.

Your task:
1. Review and **merge PR #9** (`checkpoint/09-recorder-extension`, the Phase 2 browser recorder). Spawn a review subagent that posts its review to the PR, address required feedback, then merge.
2. Make the recorder discoverable in the app: add a brief pointer near the test-definition steps field and a matching tutorial step (keep the in-app tutorial in sync — it lives in `frontend/components/tutorial-modal.tsx` + `tutorial-walkthrough.tsx`, targets via `data-tutorial`).
3. Verify: `cd extension && npm test`, `cd backend && npm test`, `cd frontend && npm run lint && npm run build`.

Then prepare the MVP demo (note: set `ANTHROPIC_API_KEY` in `backend/.env` to exercise AI generation live).

Do not start the worker-resilience or cancel/retry work yet — those are later milestones. Follow the milestone → PR → review → merge → handoff workflow, and update this document when done.
