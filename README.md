# RotaWise

<!-- Replace OWNER/REPO with your GitHub path to activate the badge -->
[![CI](https://github.com/OWNER/REPO/actions/workflows/ci.yml/badge.svg)](https://github.com/OWNER/REPO/actions/workflows/ci.yml)

A modern, multi-tenant **workforce scheduling** platform — rotas, availability, leave, shift swaps, time tracking, and reporting. This repository is the **runnable foundation**: a fully wired Next.js app with authentication, multi-tenancy, the complete database model, and a polished dashboard shell with several features already reading live data.

## Stack

- **Next.js 15** (App Router) + **TypeScript**
- **Tailwind CSS** + shadcn/ui-style components (dark mode included)
- **Prisma ORM** + **PostgreSQL**
- **Auth.js (NextAuth v5)** — email/password + optional Google, JWT sessions, role-based access
- **TanStack Query** + **Zustand** for client state

## What's built

| Area | Status |
|------|--------|
| Auth (login, register, sign-out, RBAC) | Working |
| Multi-tenancy (per-tenant data isolation) | Working |
| Database schema + seed data | Complete |
| Dashboard with live stats | Working |
| Schedule — weekly rota grid (read) | Working |
| Employees — directory (read) | Working |
| Leave — request list + approve UI | Working (read + UI) |
| Shift swaps / Timesheets / Reports | Scaffolded (model-backed, UI stubs) |
| Settings — company + scheduling rules | Working (read) |

Roles: **Super Admin → Business Owner → Manager → Employee**. The sidebar, routes, and APIs all enforce role permissions (`src/lib/permissions.ts`).

## Getting started

You need **Node 20+** and **Docker** (or any local PostgreSQL).

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
#   then set AUTH_SECRET:  npx auth secret   (or: openssl rand -base64 32)

# 3. Start PostgreSQL
docker compose up -d

# 4. Create the schema and seed demo data
npm run db:migrate      # creates tables (name the migration e.g. "init")
npm run db:seed         # adds a demo company + users + shifts

# 5. Run it
npm run dev             # http://localhost:3000
```

### Demo logins (after seeding)

| Email | Password | Role |
|-------|----------|------|
| `owner@acme.test` | `Password123!` | Business Owner |
| `manager@acme.test` | `Password123!` | Manager |
| `employee@acme.test` | `Password123!` | Employee |

The login form is pre-filled with the owner account for convenience — clear the fields to sign in as someone else.

## Useful scripts

```bash
npm run dev          # dev server
npm run build        # prisma generate + production build
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run db:migrate   # prisma migrate dev
npm run db:seed      # reseed demo data
npm run db:studio    # browse the DB in Prisma Studio
npm test             # run unit tests (Vitest)
npm run test:watch   # unit tests in watch mode
npm run test:e2e     # end-to-end smoke tests (Playwright)
```

## Testing

Run `npm install` first to pull in the test tooling (Vitest and Playwright were
added to `devDependencies`).

Unit tests (Vitest) cover the pure business logic — the scheduling rule engine,
RBAC permissions, the geofence distance helper, the Zod validators, and the invite
token helpers — and need no database:

```bash
npm test
```

End-to-end smoke tests (Playwright) drive a real browser against a running, seeded
app (landing page, sign-in, auth redirect). First time only, install the browser:

```bash
npx playwright install chromium
npm run db:seed        # ensure demo data exists
npm run test:e2e       # Playwright starts the dev server automatically
```

Tests live in `tests/unit` and `tests/e2e`. They're excluded from the app's
`tsconfig`, so `npm run typecheck` and `npm run build` only cover shipping code.

## Continuous integration

`.github/workflows/ci.yml` runs on every push to `main` and on pull requests:

- **quality** — `npm ci`, Prisma generate, lint, typecheck, unit tests, and a production build.
- **e2e** — spins up a PostgreSQL service, applies migrations, seeds demo data, installs Chromium, and runs the Playwright smoke tests (uploading the HTML report as an artifact).

The workflow uses `npm ci`, which requires `package-lock.json` to match `package.json`.
After pulling new dependencies (Vitest, Playwright, Nodemailer were added over time),
run `npm install` once and **commit the updated `package-lock.json`** so CI stays green.
Update the badge URL at the top of this file with your `OWNER/REPO` path.

## Deployment

### Docker (recommended)

A multi-stage `Dockerfile` builds a minimal standalone image, and
`docker-compose.prod.yml` runs Postgres, a one-shot migration, and the app:

```bash
# Required: a long random secret and your public URL
export AUTH_SECRET="$(openssl rand -base64 32)"
export AUTH_URL="https://your-domain.com"     # or http://localhost:3000

docker compose -f docker-compose.prod.yml up -d --build
# (optional) load demo data once:
docker compose -f docker-compose.prod.yml --profile seed run --rm seed
```

The `migrate` service applies `prisma migrate deploy` before the app starts,
the app serves on port 3000, and `/api/health` is wired as a container
healthcheck (it pings the database). This single-instance Node setup is where
the SSE real-time notifications work fully.

### Vercel

Push to GitHub and import the repo — Vercel auto-detects Next.js (`vercel.json`
pins `prisma generate && next build`). Set `DATABASE_URL`, `AUTH_SECRET`, and
`AUTH_URL` (plus optional `SMTP_*` / `AUTH_GOOGLE_*`) in the project's
environment variables, and point `DATABASE_URL` at a hosted Postgres (Neon,
Supabase, RDS, etc.). Run `prisma migrate deploy` against that database as a
release step.

Note: on Vercel's serverless runtime the in-process SSE push can't span
invocations, so the bell falls back to its periodic refetch. For real-time push
there, run the Docker image on a persistent Node host, or add a Redis pub/sub
adapter behind `publishToUser` / `subscribeUser`.

## Project structure

```
prisma/
  schema.prisma      # all models, enums, indexes, relations
  seed.ts            # demo tenant + users + shifts + leave
src/
  auth.ts            # Auth.js (Node): credentials + Google, JWT callbacks
  auth.config.ts     # edge-safe config used by middleware
  middleware.ts      # route protection
  lib/
    prisma.ts        # singleton client
    permissions.ts   # role ranks + capability map (RBAC)
    session.ts       # requireUser / requireRole / requirePermission
    tenant.ts        # tenant-scoping guard for queries & APIs
    utils.ts
  app/
    (auth)/          # login, register
    (dashboard)/     # dashboard, schedule, employees, leave, swaps,
                     # timesheets, reports, settings
    api/             # auth handler, register, employees, notifications
  components/
    ui/              # button, input, card, badge, label
    layout/          # sidebar, topbar, mobile nav, page header
    providers/       # theme + react-query + session
```

## How multi-tenancy works

Every business row carries a `tenantId`. The signed-in user's `tenantId` and `role` are baked into the JWT (`src/auth.config.ts`). Server pages resolve the tenant via `getCurrentUser()` and **always** filter queries by it; API routes go through `tenantContext()`. This keeps each company's data hard-isolated within a single shared database.

## Security & operations

- **Audit log** — important actions (publishing rotas, approving leave/swaps, employee and settings changes) are recorded via `src/lib/audit.ts` into an `AuditLog` table. Business Owners can review the trail at **/audit**. Logging is best-effort and never blocks the action.
- **Rate limiting** — `src/lib/ratelimit.ts` throttles abuse-prone endpoints (signup, invite redemption) by IP with a fixed window, returning `429` with `Retry-After`. In-memory per instance; back it with Redis for multi-instance.
- **Leave balances** — each employee has an annual `holidayAllowance` (days). The Leave page shows allowance / taken / remaining, computed from approved holiday in the current calendar year.
- **Scaling real-time** — set `REDIS_URL` to route notification pushes through Redis pub/sub so SSE works across multiple instances; unset, it's in-process. Same `publishToUser` / `subscribeUser` interface either way (`src/lib/realtime.ts`).

> After pulling these changes, run `npm install` (adds `ioredis`) and `npm run db:migrate` — a migration adds the `AuditLog` table and `Employee.holidayAllowance`, and regenerates the Prisma client.

## Roadmap (next build phases)

The data model already supports these — the remaining work is interaction logic and UI:

1. **Scheduling engine** — drag-and-drop shift editing, copy-previous-week, recurring shifts, publish flow, and rule validation (max weekly hours, min rest, skill match, availability, overtime warnings).
2. **Shift swapping** — offer → claim → manager approval, with auto-reassignment.
3. **Leave** — request form, balances, calendar overlap checks.
4. **Time tracking** — web/mobile clock in/out, GPS + geofence, timesheet approval & export.
5. **Reporting** — labour cost, overtime, attendance, absence, coverage dashboards.
6. **Notifications** — real-time (Socket.io) + email.
7. **Testing** — Vitest unit tests + Playwright e2e.

## Email

Invites and notifications are mirrored to email via SMTP (`src/lib/email.ts`,
using Nodemailer). Configure the `SMTP_*` variables in `.env` to send for real —
any provider works (Mailtrap, Resend, SendGrid, a Gmail app password, etc.).

If `SMTP_HOST` is left blank, emails are **logged to the console instead of sent**,
so the app runs fully without an email provider and you can develop offline. In-app
notifications (the bell) always work regardless of SMTP config.

## Notes & known simplifications

- **Sessions use the JWT strategy** (required for the credentials provider). The Prisma adapter is wired in for Google OAuth account storage.
- **Login lookup** uses `findFirst({ where: { email } })`. Emails are unique *per tenant* in the schema; if you later need the same email across multiple companies, add a tenant/workspace selector to the login flow.
- **Email sending is best-effort** — a delivery failure is logged but never breaks the request that triggered it (e.g. approving leave still succeeds even if the email bounces).
- **Real-time notifications use Server-Sent Events** (`/api/notifications/stream`) backed by an in-process pub/sub (`src/lib/realtime.ts`). The bell pushes instantly with no polling. This works for a single Node instance (dev and single-instance prod); for multi-instance/serverless, swap the in-process emitter for a Redis pub/sub adapter behind the same `publishToUser` / `subscribeUser` interface.
- Run `npm install && npm run typecheck` after pulling new dependencies; it's expected to pass.
