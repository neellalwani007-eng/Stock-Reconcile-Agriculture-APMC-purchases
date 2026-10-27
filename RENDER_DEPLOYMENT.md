# Deploying the reconciliation app to Render

This repository is a pnpm monorepo. The root `render.yaml` builds the web app and
API together, then starts the API server, which also serves the built frontend.
It intentionally does not create a new database: connect the service to the
Render PostgreSQL database that contains the app's data.

Use the Blueprint to create a new Render service. If you already have a Render
web service, keep it and copy the build command, start command, health-check
path, and environment variables from `render.yaml` into that service instead
of creating a duplicate.

## Required Render environment variables

Set these on the Render web service:

- `DATABASE_URL`: the PostgreSQL connection string for the app's database.
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`: the Google OAuth web client
  credentials.
- `ADMIN_EMAIL`: the Google account email that can access the admin page.
- `NODE_ENV`: set to `production` (the Blueprint sets this automatically).

Run the web service in the same region as its Render PostgreSQL database, then
use the database's internal connection URL for `DATABASE_URL`.

Do not commit real credentials or database URLs. `.env.example` contains
placeholders only; `.gitignore` excludes `.env` files.

## Google OAuth callback

In the Google OAuth client settings, add this authorized redirect URI:

`https://<your-render-service>.onrender.com/api/callback`

Use the actual Render service hostname. The application uses Google OAuth, not
Replit Auth, so it can run on Render with the Google credentials above.

## Database setup and migrations

The checked-in Drizzle baseline migration is safe to run against either an
empty database or an existing database from this app: it creates missing tables
and indexes and adds the optional payment-source and payment-reference columns
without dropping or rewriting existing records.

The migration command is:

```sh
pnpm --filter @workspace/db run migrate
```

Before deploying the updated app, apply pending migrations using the Render
database URL. On a paid Render web service, set the pre-deploy command to the
migration command above so future migrations run before the new app starts.
Render only provides pre-deploy commands on paid web services.

For plans without pre-deploy commands, run the migration from a trusted shell
with `DATABASE_URL` set to the database's external connection URL, before
deploying the schema-dependent code. For the running app, set `DATABASE_URL` to
the Render database's internal connection URL; the database and web service
must be in the same Render workspace and region for that URL to work.

The migration is additive and idempotent. It updates the schema only; it does
not copy data from a different database. Keep real database URLs and OAuth
credentials in Render's secret settings, never in GitHub.

## Render service commands

The Blueprint uses:

- Build: `pnpm install --frozen-lockfile --prod=false && pnpm run build`
- Start: `pnpm --filter @workspace/api-server run start`
- Health check: `/api/healthz`

Render supplies `PORT` to the API server. No separate static-site service is
needed.
