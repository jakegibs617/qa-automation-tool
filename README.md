# qa-automation-tool

## Backend local database

Start PostgreSQL:

```bash
docker compose up -d postgres
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
host port `55432` to avoid conflicts with a local PostgreSQL install.
