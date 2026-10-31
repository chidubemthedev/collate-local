# collate

collation system for election data

## Database setup

The app talks to a cloud-hosted PostgreSQL instance through TypeORM. Schema changes only ever happen through migrations (`synchronize` is always off).

1. Get your connection string (PostgreSQL URI) from your hosting provider.
2. Copy `.env.example` to `.env` and fill it in:

   ```sh
   cp .env.example .env
   ```

   - `DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/DBNAME`
   - `DATABASE_SSL=true` — required by most cloud providers. Set `false` for a plain local connection. (If your provider gives you a CA certificate, wire it into the `ssl` setting in `lib/db/data-source.ts`.)

   ⚠️ Never commit `.env`. It is already git-ignored.

3. Run the migrations against the database:

   ```sh
   npm run db:migrate
   ```

4. Start the app (`npm run dev`) and check the health endpoint at [`/api/health`](http://localhost:3000/api/health) — it should return `{"ok":true}`.

### Additional migration commands

| Command | What it does |
| --- | --- |
| `npm run db:migrate` | Runs pending migrations |
| `npm run db:migrate:revert` | Reverts the last migration |
| `npm run db:migrate:generate -- lib/db/migrations/AddFeature` | Generates a migration from entity changes |
| `npm run db:migrate:create -- lib/db/migrations/AddFeature` | Creates an empty migration |

> If your provider hands out two connection strings (e.g. Supabase, Neon), the **pooled** one is fine for the app runtime, but migrations usually need the **direct** (non-pooled) connection string — DDL contracts/connection timeouts on poolers can make `db:migrate` fail unpredictably.
