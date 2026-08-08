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
- [x] Provision a Postgres service on Railway — project `pipntick`, environment `production`,
      service `Postgres`, separate from the minemaster project.
- [x] Run `pnpm db:generate` from `packages/db/` to produce the first real migration —
      `packages/db/migrations/0000_clumsy_komodo.sql` now exists (3 tables: `users`,
      `trading_accounts`, `trades`, matching enums and FKs — generated purely from schema
      introspection, no live DB connection needed for `generate` itself).
- [x] Run `pnpm db:migrate` against the Railway Postgres to apply it. Applied via a temporary
      `railway connect postgres --tunnel-only --ssh` tunnel (SSH, not the public TCP proxy — no
      public exposure) rather than making the database publicly reachable; verified afterward via
      a one-off `postgres` query that all 3 tables exist. Requires a Railway-registered SSH key
      (`railway ssh keys add`) and the Railway CLI (`npm i -g @railway/cli`) — both now set up on
      this machine, plus the `use-railway` agent skill/MCP (`railway setup agent`) for future
      Railway operations from this session. Use `db:migrate` as the production sync path going
      forward, not `db:push`.

## 2. Auth (Clerk)
- [x] Real Clerk **test-mode** app created (Email+Password, Google OAuth, Name field required at
      sign-up) — `pk_test_`/`sk_test_` keys now set as Railway variables on both `api`
      (`CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`) and `web` (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`,
      `CLERK_SECRET_KEY`, plus the sign-in/up/redirect URL vars). Test-mode is shippable as-is —
      not a blocker for first deploy.
- [ ] When ready: create a Clerk **Production** instance, get `pk_live_`/`sk_live_` keys.
- [ ] Add Clerk's required DNS records (e.g. `accounts.`/`clerk.` subdomains) in Namecheap
      alongside the domain step below.

## 3. Railway service setup
- [x] New Railway **project** (`pipntick`, not added into the minemaster one).
- [x] Services: `api` and `web` created via Railway's TypeScript Infrastructure-as-Code
      (`.railway/railway.ts`, `railway config apply`) alongside the existing `Postgres` service.
      Three stray empty services from earlier manual dashboard setup (`compassionate-exploration`,
      `beautiful-determination`, `pipntick-trade`) were left untouched, not deleted — pending a
      cleanup pass.
- [x] **Correction from the original plan**: do **not** set Root Directory per service. This repo
      is a "Shared monorepo" — `apps/api`/`apps/web` depend on `packages/shared`/`packages/db` via
      `workspace:*`, so isolating a service to its `apps/*` subdirectory would hide those sibling
      packages from the build. Instead, `.railway/railway.ts` sets only `build`/`deploy` commands,
      with the full repo checkout as build context:
  - web: `pnpm install --frozen-lockfile && pnpm --filter @pipntick/web build` /
    `pnpm --filter @pipntick/web start`
  - api: `pnpm install --frozen-lockfile && pnpm --filter @pipntick/api build` (now just
    `tsc --noEmit`, a type-check gate) / `pnpm --filter @pipntick/api start` (now `tsx
    --env-file-if-exists=.env src/index.ts`, matching `dev` — see note below).
- [x] **Real bug found and fixed via this first deploy attempt**: `api`'s original production
      path (`tsc` emit to `dist/` + `node dist/index.js`) crashed on boot with
      `ERR_MODULE_NOT_FOUND` — the compiled output's relative imports (`from "./lib/auth"`) have
      no file extension, which Node's own ESM resolver requires and `tsx`/dev never needed. This
      path was never actually exercised before (dev always uses `tsx watch`), so it shipped
      untested. Fixed by running `tsx` directly in production too (`start` script), rather than
      chasing extension fixes through every workspace package Node's resolver would otherwise
      need them in (`packages/db`'s raw, un-built TS source hit the same issue one level deeper).
      Verified locally (clean boot + health check) and via 84 passing tests before redeploying.
- [x] `web`'s first deploy attempt failed for an unrelated, expected reason: `next build`
      prerenders `/` and `ClerkProvider` throws on a missing `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
      — this project had never had real Clerk keys. Resolved by creating a real Clerk app (see
      Section 2) and setting the key as a Railway build-time variable.
- [x] `api` redeployed with the `tsx`-start fix (`railway redeploy --from-source`) — green,
      1/1 replica running, real Clerk auth active (dev-bypass log line no longer present).
- [x] `web` redeployed with the real Clerk key — green, 1/1 replica running, clean boot
      (`next start`, ready in <1s).
- [ ] Clean up the 3 stray empty services once confirmed unneeded (with explicit confirmation
      first — low risk since none have ever deployed, but destructive).

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
