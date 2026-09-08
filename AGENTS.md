# AGENTS.md

Source of truth for all AI assistants in this repository (`hirepair_web`). Precedence over any other instruction when there is a conflict.

---

## 1. Stack & Architecture

- **Architecture**: Monorepo with npm workspaces (`apps/web` for frontend, `apps/api` for backend).
- **Web Frontend (`apps/web`)**: Next.js (App Router) · React 19 · TypeScript · Tailwind CSS v4.
- **API Backend (`apps/api`)**: NestJS · TypeScript · Express/Node.js.
- **ORM & Migrations**: Prisma 7 with the `@prisma/adapter-pg` driver adapter.
- **Database & Cache**: PostgreSQL 16 & Redis 7 (via Docker Compose locally).
- **Managed Postgres**: Supabase, consumed **only** through the connection string.
  We do not use the Supabase CLI, `supabase/migrations`, or Supabase Auth —
  authentication is modelled and implemented in this repository.

---

## 2. Directory Structure

```
hirepair_web/
├── apps/
│   ├── web/               # Next.js App Router Frontend
│   │   ├── src/
│   │   │   └── app/       # Next.js App Router routes & pages
│   │   ├── public/        # Static assets
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── next.config.ts
│   └── api/               # NestJS API Backend
│       ├── prisma/
│       │   ├── schema.prisma   # Single-file schema (source of truth)
│       │   ├── migrations/     # Prisma-generated; migration_lock.toml committed
│       │   ├── seed.ts         # Dev seed entrypoint
│       │   └── seed/           # Composable seed modules
│       ├── src/
│       │   ├── common/filters/ # PrismaExceptionFilter (P2002 → 409)
│       │   ├── config/         # Env validation (class-validator)
│       │   ├── health/         # GET /health/db
│       │   ├── prisma/         # Global PrismaModule + PrismaService
│       │   ├── app.module.ts
│       │   ├── app.controller.ts
│       │   ├── app.service.ts
│       │   └── main.ts
│       ├── prisma.config.ts    # Datasource URL + seed registration
│       ├── package.json
│       └── tsconfig.json
├── docs/
│   ├── business/          # Product business rules & methodology docs
│   ├── database/          # Schema, RLS decision, migration & deploy workflow
│   ├── demo/              # Python prototype script
│   └── design/            # Brand manual & static visual prototype
├── .github/
│   └── workflows/
│       ├── ci.yml         # Quality, browser E2E and disposable-DB validation
│       └── supabase-migrations.yml # Migrations after merge by environment
├── .husky/                # Git hooks (pre-commit, commit-msg)
├── commitlint.config.js   # Conventional commit rules
├── docker-compose.yml     # Local Postgres (5434:5432) + Redis (6379:6379)
├── package.json           # Workspace root configuration
└── README.md
```

---

## 3. Git Commit & Branch Standards

- **Branch Naming Standard**: `{issue_number}-{task_title}` (e.g. `4-task-01-inicializar-monorepo`).
- **Commit Pattern**: `type(scope): subject` (e.g. `feat(4): setup monorepo packages`).
- **Allowed Types**: `feat`, `fix`, `chore`, `docs`, `style`, `refactor`, `test`, `perf`.
- **Mandatory Scope**: Scope is required (issue number or feature scope).

---

## 4. Local Environment Setup

- **Configure**: `cp .env.example .env` (defaults already work locally).
- **Start Infrastructure**: `npm run db:up` (launches Postgres on port `5434` and Redis on port `6379`).
- **Apply Migrations**: `npm run db:migrate`, then `npm run db:seed` for sample data.
- **Start Web**: `npm run dev:web` (runs Next.js on `http://localhost:3000`).
- **Start API**: `npm run dev:api` (runs NestJS on `http://localhost:3001`).
- **Run Format**: `npm run format` (writes) — CI checks it with `npm run format:check`.

---

## 5. Database & Prisma Migrations

Full reference: [`docs/database/README.md`](./docs/database/README.md).

- **Never** handcraft migrations as the main workflow. Always generate them:

```bash
npm run db:migrate        # prisma migrate dev
```

- After a schema change, keep these three consistent:
  1. `apps/api/prisma/schema.prisma`
  2. `apps/api/prisma/migrations/*`
  3. the code that consumes Prisma Client
- **Never edit an already-applied migration** — the checksum changes and Prisma
  reports it as modified from then on. Add a new migration instead.
- For SQL the Prisma DSL cannot express (RLS, grants, triggers, functions,
  partial indexes): `npx prisma migrate dev --create-only`, then append the
  manual SQL **below** the generated diff with a comment explaining why.
- **Row Level Security is enabled on every table, with no policies** (deny-all).
  It is not the authorization mechanism — that lives in the NestJS layer — but
  Supabase publishes the whole `public` schema through its Data API, so a table
  without RLS is readable with the project's anon key. A new model with no
  `ENABLE ROW LEVEL SECURITY` line fails `apps/api/src/prisma/schema-rls.spec.ts`.
- `npm run db:reset` destroys all data. **Development databases only.**
- Ownership is enforced in application code, so every read must filter by the
  acting user; soft-deleted rows (`deletedAt`) must be filtered explicitly.

---

## 6. Mandatory Quality Gate

All five commands must pass before delivering any change (same gate declared in
`.codex/instructions.md`):

```bash
npm run lint
npm run format:check
npm run typecheck
npm run test
npm run build
```

No shortcuts to force a green pipeline: no `skip`, `only`, `--no-verify`, ad hoc
disabled lint rules or commented-out tests.

## 6.1 Test-Driven Development and Test Strategy

Every behavior change follows strict TDD:

1. Write the smallest unit test that describes the intended behavior.
2. Run that test alone and confirm it fails for the expected missing behavior — a
   failure caused by a typo, broken import, or invalid fixture is not evidence.
3. Implement only what makes the test pass.
4. Refactor while the test remains green, then run the relevant suite.

Unit tests are the primary proof of correctness. All new or changed production
code must have **100% unit coverage** of statements, branches, functions, and
lines. Existing uncovered code is technical debt: do not lower the baseline, and
cover it when touching the behavior; a dedicated coverage task must eliminate
the remaining legacy gap before a repository-wide 100% threshold is enabled.

E2E tests verify only the main user journeys and system boundaries:

- Frontend browser flows use Playwright under `apps/web/e2e/` and are excluded
  from Jest discovery.
- Backend E2E flows, when introduced, must exercise real HTTP contracts and
  disposable infrastructure; business rules remain covered by unit tests.
- Do not duplicate unit-level permutations in E2E. Keep E2E scenarios focused
  on critical happy paths and their essential failure/authorization boundaries.

Never use `skip`, `only`, weakened coverage thresholds, mocks that bypass the
behavior under test, or commented-out tests to make a pipeline pass.

These five need no database — `npm ci` runs `prisma generate` via the `postinstall`
of `apps/api`, so Prisma Client types exist without a live connection. CI adds
three database steps on top, against a throwaway Postgres (never Supabase):
`db:deploy` on an empty database, a schema drift check, and `db:seed` run twice
to prove idempotency. When you change the schema, run these locally too:

```bash
npm run db:up && npm run db:migrate && npm run db:seed && npm run db:seed
```
