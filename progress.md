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

## Next
- Add artifact detail views and richer runner outputs.
