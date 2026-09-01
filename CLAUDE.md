# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

pipntick.trade — a trading journal / performance analytics web app. Users log trades, view them on a calendar, analyze performance over time ranges, get AI analysis on individual trades, and check market news/economic calendar. See [docs/app-flow.md](docs/app-flow.md) for the full route map and page flow, and `docs/architecture/*.puml` (PlantUML, render with `plantuml.jar`) for C4 diagrams. [docs/production-readiness.md](docs/production-readiness.md) tracks the step-by-step checklist for taking Phase 1 to production on Railway — check it for current progress before assuming deploy/testing/infra work hasn't started.

## Phase 1 scope

Phase 1 ships Dashboard, Journal, and Performance as the working product surface. AI Analysis and Market News are intentionally gated behind a "Coming Soon" placeholder rather than removed:

- `apps/web/src/app/dashboard/_components/ComingSoon.tsx` is the shared placeholder component.
- `apps/web/src/app/dashboard/ai/page.tsx` renders it directly (there was no prior AI Analysis implementation).
- `apps/web/src/app/dashboard/news/page.tsx` renders it too; the full original Market News/economic-calendar implementation (~900 lines) was preserved as-is at `apps/web/src/app/dashboard/news/NewsPageContent.tsx` — it's not wired into the route, but not deleted either. To re-enable, swap `page.tsx`'s body back to rendering that component.

Don't delete either the `ComingSoon` gate or the preserved News implementation without being asked — the gate is a deliberate product decision, not a stub to clean up.

Dashboard, Journal, and Performance are now wired to the live API (see below) via React Query — no more local mock arrays. `apps/web/src/lib/trade-utils.ts` holds all the derived-data logic (period bucketing, duration formatting, calendar/chart aggregation) shared across the three pages, so page components stay focused on rendering.

## Stack & monorepo layout

pnpm workspaces + Turborepo. TypeScript throughout.

- `apps/web` — Next.js 15 (App Router) + React 19 + Tailwind CSS 4 frontend, port 3000
- `apps/api` — Fastify 5 backend, port 3001, run via `tsx watch`
- `packages/db` — Drizzle ORM schema/client for Postgres, shared by web/api via `@pipntick/db`
- `packages/shared` — shared TypeScript types (`Trade`, `TradingAccount`, `PerformanceSummary`, etc.), imported as `@pipntick/shared`
- `design-system/` — color palette (`colors.md`) and logo guidelines (`logo.md`), not code

Auth is Clerk, wired on both sides:
- `apps/api` registers `@clerk/fastify`'s `clerkPlugin` and guards every `/api/*` route through `getUserId(request)` (`apps/api/src/lib/auth.ts`) — **but only when `CLERK_SECRET_KEY` is set**. Without it, `registerAuth()` skips `clerkPlugin` entirely and every request is attributed to a fixed `DEV_USER_ID` (default `"user_dev_001"`) instead, with a startup warning logged. This is a local-dev-only escape hatch so the API is usable before real Clerk keys exist — it activates automatically (never in a real deployment, where the key is set) and is not something to "clean up". `/health` is registered outside the auth scope entirely, so it stays up regardless of Clerk config.
- `apps/web` wraps the root layout in `ClerkProvider` (`apps/web/src/app/layout.tsx`) and gates `/dashboard/*` via `clerkMiddleware()` in `apps/web/src/middleware.ts`. `/login` and `/register` use `useSignIn()`/`useSignUp()` directly against the existing hand-styled forms (no Clerk prebuilt `<SignIn />`/`<SignUp />` components) — `/register` is a two-stage flow (details, then an email verification code) since Clerk requires email verification by default. `apps/web/src/lib/api.ts`'s `request()` takes a `token: string | null` first/second argument and sets `Authorization: Bearer <token>`; `apps/web/src/lib/hooks.ts` resolves that token per-call via `useAuth().getToken()`. The dashboard sidebar shows the real signed-in user via `useUser()` and has a working sign-out button via `useClerk().signOut()`.
- **Both sides require real Clerk keys to actually authenticate.** These are now filled in locally: `apps/web/.env.local` and `apps/api/.env` both carry real `pk_test_`/`sk_test_` keys for a dev Clerk app (`elegant-racer-15.clerk.accounts.dev`) with Email+Password and Name enabled, so `pnpm dev` renders and auth works. Neither `.env` file is committed (`.gitignore`), so a fresh clone still needs keys added from a Clerk app before the web app will render — there's no web-side equivalent of the API's `DEV_USER_ID` bypass (ClerkProvider throws on an invalid publishable key).

Realtime (WebSockets + React Query — React Query itself is now wired for data fetching, but WebSocket realtime is not) is aspirational per the README; `@fastify/websocket` is an installed-but-unused dependency.

### Local database

Postgres runs in Docker (Docker Desktop, WSL2 backend). Managed by `docker-compose.yml` at the repo root (service `postgres`, container name `pipntick-postgres`, data in the named volume `pipntick-pgdata` so it survives `docker compose down`). Root `package.json` wraps it:

```bash
pnpm setup      # first run / fresh clone: pnpm install + db:up + db:push + db:seed
pnpm dev:full   # db:up (idempotent) then turbo dev — the normal daily command
pnpm db:up      # start Postgres, block until it passes its healthcheck
pnpm db:down    # stop + remove the container (volume/data kept)
pnpm db:reset   # down -v (wipe volume) + up + db:push + db:seed
```

`pnpm db:up` runs `docker compose up -d --wait`, so schema/seed steps never race the container coming up. Docker Desktop still has to be running first.

`packages/db/.env` and `apps/api/.env` both point `DATABASE_URL` at `postgresql://pipntick:pipntick@localhost:5432/pipntick` (matches the compose credentials). Schema/seed can also be run directly from `packages/db/`:

```bash
pnpm db:push    # or db:generate + db:migrate
pnpm db:seed
```

**`.env` loading**: `apps/api`'s `dev`/`start` scripts and `packages/db`'s `db:seed` script all run with Node's native `--env-file-if-exists=.env` flag (Node 20.6+; this repo uses Node 24) — that's what makes `DATABASE_URL` in `.env` actually reach `process.env` for those entry points. It degrades silently if `.env` doesn't exist, so a fresh clone without env files still runs (just without a DB connection). `drizzle-kit` commands (`db:push`/`db:generate`/`db:migrate`/`db:studio`) load `.env` on their own regardless — that's built into drizzle-kit, not something this repo wires up.

Without a reachable database, every `/api/*` route 500s with a Drizzle `ECONNREFUSED` error (not an auth error) — the frontend pages handle this gracefully (loading → error state), they just show no data.

### Local dev environment (this machine, Windows)

- **pnpm isn't preinstalled** and `corepack enable`/`corepack prepare pnpm@latest --activate` fails here with `EPERM: operation not permitted, open 'C:\Program Files\nodejs\yarnpkg'` (a pre-existing yarn shim in a non-writable location). Fix used: `npm install -g pnpm` instead — installs fine and doesn't touch that shim.
- **PowerShell blocked pnpm's shim script** (`pnpm.ps1 cannot be loaded because running scripts is disabled on this system`) because bare `pnpm` resolves to the `.ps1` shim before `pnpm.cmd`. Fixed permanently via `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned` (user-scope only, no admin needed) — already applied on this machine, so plain `pnpm` works in any new terminal now.
- **Docker Desktop must be started manually** before `pnpm db:up` will work — `docker ps` fails with a named-pipe error (`dockerDesktopLinuxEngine`) if the Desktop app isn't running yet.
- `apps/web/.env.local` and `apps/api/.env` exist locally with real Clerk dev keys plus `DATABASE_URL`/`NEXT_PUBLIC_API_URL` (see auth + local-database notes above).
- Python 3.13 (`Python.Python.3.13`) was installed via `winget` for the UI/UX Pro Max skill's search script — see below.

## Commands

Run from repo root (Turborepo fans these out per-package; use `--filter` to target one):

```bash
pnpm install                        # install all workspace deps
pnpm setup                          # one-shot: install + start Postgres + push schema + seed

pnpm dev                            # run web + api dev servers (assumes DB already up)
pnpm dev:full                       # start Postgres (if needed) then run web + api
pnpm --filter @pipntick/web dev     # web only (port 3000)
pnpm --filter @pipntick/api dev     # api only (port 3001)

pnpm db:up                          # start the Postgres container, wait for healthcheck
pnpm db:down                        # stop + remove it (data kept in the volume)
pnpm db:reset                       # wipe volume, recreate, re-push schema, re-seed

pnpm build                          # turbo build (web + api)
pnpm lint                           # turbo lint (next lint, web only has a lint script)
pnpm typecheck                      # turbo typecheck (tsc --noEmit in every package)
pnpm test                           # turbo test (vitest run in web, api, shared)
```

Package-specific, run from `packages/db/`:

```bash
pnpm db:generate   # generate drizzle migration from schema changes
pnpm db:migrate    # apply migrations
pnpm db:push       # push schema directly to db (no migration file)
pnpm db:studio     # open Drizzle Studio
pnpm db:seed       # run src/seed/index.ts
```

**Testing**: Vitest, added to `apps/web`, `apps/api`, and `packages/shared` (each has its own
`vitest.config.mts` + `test`/`test:watch` scripts); `packages/db` has none (no pure logic worth
unit testing there). Tests live under each package's `src/test/`, mirroring the source tree they
cover (e.g. `apps/api/src/routes/trades.ts` → `apps/api/src/test/routes/trades.pure.test.ts`) —
not colocated next to the source file. In `apps/api`, files split `*.pure.test.ts` (pure
functions, no I/O) vs `*.route.test.ts` (Fastify `app.inject()` route tests) where a route module
has both. Route tests mock `@pipntick/db`'s `db` export with a minimal fake chainable query
builder (`vi.hoisted` + `vi.mock`, see `apps/api/src/test/routes/trades.route.test.ts`) rather
than hitting a real Postgres — `vi.importActual`
for the real `trades`/`tradingAccounts` schema objects is safe since `postgres()` connects lazily
and never touches the network just from being constructed. There's no real-Postgres integration
test path yet (see [docs/production-readiness.md](docs/production-readiness.md) §7 for the
tradeoff and what a future CI Postgres service container would unlock). `pnpm lint` currently fails
on `apps/web` (`next lint` has no committed ESLint config and prompts interactively) — pre-existing,
unrelated to the test setup.

Env vars: `apps/web/.env.example` (Clerk keys), `apps/api/.env.example` (`DATABASE_URL`, Clerk keys, `CORS_ORIGIN`, `PORT`), and `packages/db/.env.example` (`DATABASE_URL`) show what's needed; copy each to `.env.local` (web) / `.env` (api, db).

## Database schema

`packages/db/src/schema/`, Postgres via `drizzle-orm/postgres-js`. No migrations have been generated yet (`packages/db/migrations/` doesn't exist) — run `pnpm db:generate` after any schema change before `db:migrate`/`db:push`.

- **`users`** (`users.ts`) — `id` (text, Clerk user ID, PK), `email`, `createdAt`, `updatedAt`.
- **`trading_accounts`** (`accounts.ts`, exported as `tradingAccounts`) — `id` (uuid), `userId` (FK → `users.id`, cascade delete), `name` (default `"Default"`), `broker` (nullable), `currency` (default `"USD"`), `startingBalance` (`numeric(18,2)`, default `"0"`), `isDefault` (boolean), `createdAt`, `updatedAt`. Represents a "trading account" per `docs/app-flow.md`'s Add/Create Trading Account step — a user can have several, but Journal/Performance currently only ever operate on the default one.
- **`trades`** (`trades.ts`) — the journal entry itself: `id` (uuid), `accountId` (FK → `trading_accounts.id`, cascade delete), `symbol`, `direction` (`pgEnum trade_direction`: `long`/`short`), `status` (`pgEnum trade_status`: `open`/`closed`, default `closed`), `entryPrice`/`exitPrice` (`numeric(18,8)`, `exitPrice` nullable for open trades), `lotSize` (`numeric(18,8)`), `pnl` (`numeric(18,2)`, nullable until closed), `entryTime`/`exitTime` (timestamps, `exitTime` nullable), `session` (text, e.g. `"London"` — resolved from `entryTime` at write time, not recomputed on read), `source` (`pgEnum trade_source`: `manual`/`screenshot`/`csv`/`mt4`), `screenshotUrl` (nullable), `notes` (nullable), `createdAt`, `updatedAt`.

This replaced an earlier `portfolios`/`positions` pair that modeled open holdings (buy/sell + avg cost) — that shape didn't match what the Journal UI actually needed (closed trades with entry/exit price and P&L), so it was redesigned rather than extended. Since no migrations existed yet, this was a clean schema replacement, not a migration.

`pnpm db:seed` (from `packages/db/`) inserts one dev user, one default account, and a few sample trades mirroring the mock data shape used in the frontend.

## Server API (`apps/api`)

All routes below live under `/api/*` and require a caller identity via `getUserId(request)` — real Clerk session if configured, `DEV_USER_ID` otherwise (see auth note above). They return `401` if somehow no user id is available. `/health` is unauthenticated.

Requests with no `accountId` are resolved against the caller's default `trading_accounts` row, auto-creating both the `users` row and a default account on first use — see `apps/api/src/lib/ensure-account.ts`.

- `GET /api/accounts` — list the caller's trading accounts (ensures a default one exists first).
- `POST /api/accounts` — create an additional account (`name` required; `broker`, `currency`, `startingBalance` optional).
- `GET /api/trades?accountId=` — list trades for an account (defaults to the caller's default account), newest `entryTime` first.
- `POST /api/trades` — create a trade. `symbol`, `direction`, `entryPrice`, `lotSize`, `entryTime` required; omitting `exitPrice` creates an `open` trade with `pnl: null`. `pnl` is computed server-side from direction/entry/exit/lotSize, never accepted from the client.
- `PATCH /api/trades/:id` — partial update; recomputes `pnl`/`status` the same way. Scoped to trades owned (via account) by the caller.
- `DELETE /api/trades/:id` — scoped the same way.
- `GET /api/performance?accountId=&period=weekly|monthly|yearly` — aggregates closed trades in the account within the period window (last 7 days / 1 month / 1 year from now) into `{ pnl, winRate, profitFactor, avgWin, avgLoss, totalTrades, avgDurationMinutes, byInstrument[], byDirection[] }`.

`apps/web/src/lib/api.ts` is a thin fetch wrapper around these routes (`NEXT_PUBLIC_API_URL`, defaults to `http://localhost:3001`), consumed via the React Query hooks in `apps/web/src/lib/hooks.ts` (`useTrades`, `useAccounts`, `useCreateTrade`). Note: the Performance page does **not** call `GET /api/performance` — it fetches the same `useTrades()` list Journal uses and derives stats/charts client-side via `trade-utils.ts`, so both pages share one cached data source instead of the browser needing two divergent aggregation implementations to agree. `GET /api/performance` still exists and works (e.g. for a future mobile client) but has no current caller.

## Architecture notes

- **Workspace deps**: `@pipntick/shared` and `@pipntick/db` are referenced as `workspace:*`. `apps/web`'s `next.config.ts` sets `transpilePackages: ["@pipntick/shared"]` since it's consumed as raw TS source (`main`/`types` point at `src/index.ts`, no build step). `apps/api` consumes both `@pipntick/db` and `@pipntick/shared` the same way (no build step needed under `tsx`).
- **Numeric fields are strings**: Postgres `numeric` columns come back from `postgres-js`/drizzle as strings, not numbers, to avoid float precision loss. `packages/shared`'s `Trade`/`TradingAccount` types reflect this (`entryPrice: string`, etc.); API route handlers `Number(...)` them before doing arithmetic and `String(...)` them before inserting.
- **tsconfig chain**: `packages/shared/tsconfig.base.json` is the base (ES2022, strict) that `apps/web/tsconfig.json`, `packages/shared/tsconfig.json`, `apps/api/tsconfig.json`, and `packages/db/tsconfig.json` all extend; `apps/web` additionally adds the `@/*` → `./src/*` path alias.
- **Web app structure**: App Router under `apps/web/src/app/`. `app/layout.tsx` wraps everything in `Providers` (`app/providers.tsx`, a client component holding the React Query `QueryClient` — required since `@tanstack/react-query` needs a client-side provider even though the root layout itself is a server component). `/dashboard` has its own `layout.tsx` (sidebar nav + `QuoteBar`) wrapping `/dashboard`, `/dashboard/journal`, `/dashboard/news`, `/dashboard/performance`, `/dashboard/ai`. Public pages (`/`, `/login`, `/register`) use `app/layout.tsx` directly with no shared chrome. Data-fetching code lives outside `app/`, in `apps/web/src/lib/` (`api.ts` fetch client, `hooks.ts` React Query hooks, `trade-utils.ts` derived-data helpers), not colocated with pages.
- **Styling**: no component library — pages are large single files (400-900+ lines) using Tailwind utility classes mixed with inline `style={{ ... }}` for hex colors pulled from [design-system/colors.md](design-system/colors.md) (e.g. background `#05090f`, primary green `#7bc13b`, loss red `#e05252`). When adding UI, match this existing pattern rather than introducing a new styling approach or component abstraction.
- **Charts**: `recharts` is the charting library used on `apps/web` (performance page etc.).

## UI/UX Pro Max skill

`.claude/skills/ui-ux-pro-max/` is a third-party Claude Code skill (from [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill), MIT licensed) providing a searchable local database of UI styles, color palettes, typography pairings, and UX guidelines, plus per-stack (Next.js/Tailwind, etc.) recommendations. It activates automatically for UI/design work — see `.claude/skills/ui-ux-pro-max/SKILL.md` for usage.

Only this one skill from the upstream repo was installed (it bundles 6 others — banner-design, brand, design-system, design, slides, ui-styling — that weren't relevant here and weren't pulled in). It was installed by copying `.claude/skills/ui-ux-pro-max/` directly from the upstream repo rather than via its own `ui-ux-pro-max-cli` npm installer, to avoid running an unreviewed third-party install script.

Its `scripts/search.py` requires `python` on `PATH` (installed via winget, `Python.Python.3.13`).

## MCP servers

- **`21st`** — HTTP MCP server at `https://21st.dev/api/mcp`, added via `claude mcp add --transport http 21st https://21st.dev/api/mcp --header "x-api-key: ..."`. Registered at **local scope** (stored per-project in the user-level `~/.claude.json`, not in a repo-committed `.mcp.json`), specifically so the API key never lands in git history. Anyone else working on this repo needs to add their own `21st` server the same way — it isn't shared via the repo.
