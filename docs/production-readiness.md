---
name: Production Readiness
description: Step-by-step checklist for taking pipntick.trade Phase 1 to production on Railway
---

# Production Readiness Checklist

Working list for deploying Phase 1 (Dashboard, Journal, Performance) to production. Check items
off as they're done — come back to this file and say "next item" or point at a specific section
to keep going.

Context this list assumes (see [CLAUDE.md](../CLAUDE.md) for full detail): monorepo on
`feature/web-app`, target host is Railway (already used for another project), domain purchased
via Namecheap, Clerk currently on test-mode keys, no migrations generated yet, no test runner
installed yet.

## Already verified (no action needed)
- [x] No `.env`/`.env.local` files were ever committed to git history — checked `git log --all`
      across all three; clean. Safe despite the repo being public.
- [x] Fastify already binds `process.env.PORT` on `0.0.0.0`, and `next start` respects `PORT`
      automatically — Railway's per-service port injection needs no code change.

## 1. Database
- [ ] Provision a Postgres service on Railway (in a **new** project, separate from the minemaster one).
- [x] Run `pnpm db:generate` from `packages/db/` to produce the first real migration —
      `packages/db/migrations/0000_clumsy_komodo.sql` now exists (3 tables: `users`,
      `trading_accounts`, `trades`, matching enums and FKs — generated purely from schema
      introspection, no live DB connection needed for `generate` itself).
- [ ] Run `pnpm db:migrate` against the Railway Postgres to apply it. Use `db:migrate` as the
      production sync path going forward, not `db:push`. **Needs the Railway `DATABASE_URL`
      first** (previous checklist item) — can't run until that service exists.

## 2. Auth (Clerk)
- [ ] Shippable as-is with current test-mode keys (`pk_test_`/`sk_test_`) — not a blocker for
      first deploy.
- [ ] When ready: create a Clerk **Production** instance, get `pk_live_`/`sk_live_` keys.
- [ ] Add Clerk's required DNS records (e.g. `accounts.`/`clerk.` subdomains) in Namecheap
      alongside the domain step below.

## 3. Railway service setup
- [ ] New Railway **project** (not added into the minemaster one).
- [ ] Three services: `apps/web`, `apps/api`, Postgres plugin.
- [ ] Set **Root Directory** per service + explicit build/start commands — Nixpacks won't
      correctly auto-detect a pnpm-filtered monorepo:
  - web: `pnpm install --frozen-lockfile && pnpm --filter @pipntick/web build` /
    `pnpm --filter @pipntick/web start`
  - api: same pattern with `@pipntick/api` (build runs `tsc`, start runs `node dist/index.js`)

## 4. Domain (Namecheap)
- [ ] Decide the split — likely apex/`www` → web, `api.pipntick.trade` → api.
- [ ] Add each service's custom domain in Railway, get the CNAME target.
- [ ] Add those CNAME records in Namecheap (+ Clerk's records from step 2 if doing Clerk
      production now). Do this **before** step 5 — env vars depend on the final domain.

## 5. Environment variables
None of this exists on Railway yet — `.env`/`.env.local` are gitignored, so nothing carries over
automatically.
- [ ] `CORS_ORIGIN` (api) → the web service's final domain, not `localhost:3000`.
- [ ] `NEXT_PUBLIC_API_URL` (web) → the api service's final domain. **Must be set as a build-time
      variable** — it's baked into the client bundle at `next build`, not read at runtime, so get
      the domain pinned (step 4) before the first production build.
- [ ] `DATABASE_URL` (api) → Railway Postgres connection string.
- [ ] Clerk keys (both sides) → copied from Clerk dashboard, live or test per step 2.

## 6. Verify after first deploy
- [ ] Hit `/api/trades/parse-screenshot` once live — `tesseract.js` has no explicit
      `langPath`/`corePath` set (`apps/api/src/routes/screenshot.ts`), so confirm it correctly
      uses the committed `eng.traineddata` (or successfully reaches out over the network) rather
      than failing silently.
- [ ] Confirm `/api/quote` works end-to-end — depends on outbound egress to `zenquotes.io` from
      the Railway container.

## 7. Testing
- [x] Add **Vitest** across the workspace — `apps/web`, `apps/api`, `packages/shared` each have
      their own `vitest.config.mts` + `test`/`test:watch` scripts; root `pnpm test` fans out via
      `turbo test`. `packages/db` has no pure logic worth unit testing (schema + client wiring
      only), so it was left out.
- [x] Test the pure logic first — 84 tests total:
  - [x] `getContractSize` (`packages/shared/src/test/index.test.ts`) and `computePnl`
        (`apps/api/src/test/routes/trades.pure.test.ts`) — both were already exported/local pure
        functions, `computePnl` just needed the `export` keyword added.
  - [x] `apps/web/src/lib/trade-utils.ts` (`trade-utils.test.ts`, 31 tests) — period bucketing,
        duration formatting, journal/performance/dashboard/calendar aggregation.
  - [x] `apps/api/src/routes/performance.ts` aggregation — the inline aggregation logic was
        extracted into an exported pure `computePerformanceSummary()` (route handler now just
        calls it) so it's testable without a database; win rate, profit factor,
        division-by-zero guards all covered (`performance.pure.test.ts`).
  - [x] `parseTradeCardText` in `apps/api/src/routes/screenshot.ts` — exported and covered with
        mobile-card, desktop-table-row, and malformed-input fixtures (`screenshot.pure.test.ts`).
        Note: found while writing tests that a genuinely open position (price pair shown as a
        live/current price, single timestamp) is the only path that actually reaches the
        "single date token" handling — a bare single price with no pair never sets `cardStyle`
        and so never gets a date at all. Not fixed (out of scope for a testing pass) — worth a
        look if OCR parsing gets revisited.
  - [x] Route-level tests via Fastify's `app.inject()` (`trades.route.test.ts`,
        `performance.route.test.ts`) — auth guarding (`401` without a user), 404s for
        unowned/missing accounts and trades, and create/update persisting the recomputed
        `pnl`/`status` (asserted against what's passed to `db.insert()`/`.update()`, not a real
        row — see note below). No real Postgres involved: `@pipntick/db`'s `db` export is
        replaced with a minimal fake chainable query builder per test file (constructing the
        real `postgres()` client is harmless since it connects lazily, so `vi.importActual` for
        the real `trades`/`tradingAccounts` schema objects works safely without a reachable DB).
  - [x] Along the way: `vi.mocked(getDefaultAccount).mockResolvedValue(null)` failed typecheck —
        `getDefaultAccount`'s inferred return type doesn't actually include `null` (TS treats
        `const [existing] = await ...` as non-optional without `noUncheckedIndexedAccess`, so
        `existing ?? null` collapses away the `null` branch in the *static* type even though it
        really can happen at runtime). Worked around in the test files with `as any`; the
        underlying type gap in `apps/api/src/lib/ensure-account.ts` is real but wasn't touched —
        every caller already null-checks defensively at runtime, so it's not an active bug, just
        a spot where the type system isn't catching what the code correctly guards against.
- [ ] Skip e2e/Playwright for now — not worth the maintenance overhead pre-launch; the `run`
      skill already covers manual visual verification.
- [ ] No real-Postgres integration tests yet — route tests above assert against what's passed to
      the mocked `db` calls, not an actual persisted row. If that gap matters later, the natural
      next step is a Postgres service container in CI (GitHub Actions `services:` or similar)
      rather than depending on the local Docker container, which isn't guaranteed to exist/be
      running in CI.

## 8. Repo hygiene
- [ ] `feature/web-app` still isn't merged to `main` — decide merge timing relative to first deploy.
- [ ] Add a CI workflow (`.github/workflows/`, currently empty) running
      `pnpm lint && pnpm typecheck && pnpm test` on push — covers this and the CI item from
      Testing in one pass, once Vitest is in place.
