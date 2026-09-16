# (kalm) ops

Internal founder dashboard — budget tracking, contractor/developer pipeline
(CRM), equity & vesting, compliance calendar, KPIs, and flagged-contractor
reports.

This is a from-scratch rebuild of an earlier prototype that stored data via
`window.storage` (Claude.ai's Artifacts persistence API) — that only works
inside a Claude.ai artifact, so it silently did nothing on a real deployed
site. Every save/load here goes through real API routes backed by a real
Postgres database instead. The UI, layout, colors, and all module logic are
unchanged from the original design.

Kept as a **separate project** from buildbridge-app on purpose — this holds
sensitive founder-only data (budget, equity split, legal filings, business
contacts) that has no reason to share infrastructure with the public-facing
product.

## Stack

- Next.js (App Router) + TypeScript
- Prisma + PostgreSQL (Neon)
- A single shared password for login (not per-person accounts — see
  `src/lib/ops-auth.ts` for the reasoning), with an HMAC-signed session
  cookie so the plaintext password is never stored in the cookie itself
- No CSS framework — everything is inline styles, same as the original
  prototype

## Local setup

1. `npm install`
2. Copy `.env.example` to `.env` and fill in:
   - `DATABASE_URL` — create a **new** Neon project for this (don't reuse
     buildbridge-app's database)
   - `OPS_PASSWORD` — a long random password, shared privately between the
     three founders
   - `OPS_SESSION_SECRET` — generate with `openssl rand -base64 32`
3. `npx prisma db push` — creates all tables in your fresh database
4. `npm run dev` — visit `http://localhost:3000`, log in with `OPS_PASSWORD`

## Deploying

Same pattern as buildbridge-app:

1. Push this to its own GitHub repo (`kalm-ops`)
2. Import it as a new Vercel project
3. Set the same three environment variables (`DATABASE_URL`,
   `OPS_PASSWORD`, `OPS_SESSION_SECRET`) in Vercel's project settings
4. Deploy

## Notes on what changed from the original prototype

- `window.storage.get/set` calls → real `fetch()` calls to API routes
  under `src/app/api/`
- The original single "update the whole data blob" pattern was split into
  granular add/update/delete functions per module, since each now maps to
  a real CRUD endpoint rather than one big JSON blob
- Equity percentages are read as stored values; vesting math (months
  elapsed, vested %) is still computed live in the browser from
  `vestingStart`, exactly as before — nothing about that logic changed
- TypeScript's `strict` mode is off in `tsconfig.json` — the dashboard
  component itself is written in plain untyped JS-style React (no prop
  types), matching the original prototype as closely as possible rather
  than retrofitting types onto every component
