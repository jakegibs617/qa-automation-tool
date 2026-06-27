# qa-automation-tool

## Local infrastructure

Start PostgreSQL and Redis:

```bash
docker compose up -d postgres redis
```

Install dependencies and run migrations:

```bash
cd backend
npm install
npm run migration:run
```

Start the API:

```bash
npm run dev
```

The backend listens on `http://localhost:4000`. Database settings default to
the values in `backend/.env.example`; the Compose database is published on
host port `55432` to avoid conflicts with a local PostgreSQL install. Redis is
published on host port `6379` and is required for async run execution.

### Run artifacts

Each run writes a structured `report.json` log artifact (and, for failed runs, a
failure-screenshot and trace placeholder) to local disk. The storage directory
defaults to `backend/.artifacts` and can be overridden with `ARTIFACTS_DIR`.
Artifact endpoints:

- `GET /test-runs/:id/artifacts` — list artifacts for a run
- `GET /artifacts/:id` — artifact metadata
- `GET /artifacts/:id/content` — stream the artifact content

Build and smoke check the backend:

```bash
cd backend
npm test
npm run build
npm run smoke:checkpoint2
npm run smoke:checkpoint4
npm run smoke:checkpoint5
npm run smoke:checkpoint7
npm run smoke:checkpoint9
```

`smoke:checkpoint5` launches a real headless Chromium, so Playwright browsers
must be installed locally (`npx playwright install chromium`).

## Frontend app shell

Install dependencies and start the Next.js app:

```bash
cd frontend
npm install
npm run dev
```

The frontend defaults to `http://localhost:3000` and calls the backend at
`http://localhost:4000`. Override the API URL with `NEXT_PUBLIC_API_URL` if
needed.

Build and smoke check the app shell:

```bash
cd frontend
npm run lint
npm run build
npm run smoke:app-shell
npm run smoke:recorder
```

## Recorder extension

The local Chrome recorder MVP lives in `frontend/recorder-extension` and can be
loaded unpacked:

1. Open Chrome extensions at `chrome://extensions`.
2. Enable Developer mode.
3. Choose "Load unpacked" and select `frontend/recorder-extension`.
4. Open the site you want to record, click the extension, and start recording.
5. Exercise the flow, stop recording, copy the JSON, and paste it into the
   dashboard's "Recorder JSON" field.
6. Click "Import recording", review the generated name/start URL/steps, then
   save and run the definition.

The recorder captures discrete actions only: initial navigation, clicks, fills,
select changes, and Enter/Escape/Tab key presses on form controls. It skips
password/API key/token-like fields by default and exports the same structured
step schema used by AI generation and manual editing.

## Demo loop

For a local MVP demo:

1. Start Docker infrastructure and run backend migrations.
2. Start the backend (`cd backend && npm run dev`).
3. Start the frontend (`cd frontend && npm run dev`).
4. Create a project. Local URLs such as `http://localhost:3000` are supported.
5. Generate a definition with AI or import recorder JSON.
6. Run the definition and open the run detail page.
7. Inspect logs and artifacts. Passing runs write `report.json`; failing runs
   also capture a PNG screenshot and Playwright trace zip.
