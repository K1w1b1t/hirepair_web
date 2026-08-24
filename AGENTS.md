# AGENTS.md

Source of truth for all AI assistants in this repository (`hirepair_web`). Precedence over any other instruction when there is a conflict.

---

## 1. Stack & Architecture

- **Architecture**: Monorepo with npm workspaces (`apps/web` for frontend, `apps/api` for backend).
- **Web Frontend (`apps/web`)**: Next.js (App Router) · React 19 · TypeScript · Tailwind CSS v4.
- **API Backend (`apps/api`)**: NestJS · TypeScript · Express/Node.js.
- **Database & Cache**: PostgreSQL 16 (via Docker Compose) & Redis 7.

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
│       ├── src/
│       │   ├── app.module.ts
│       │   ├── app.controller.ts
│       │   ├── app.service.ts
│       │   └── main.ts
│       ├── package.json
│       └── tsconfig.json
├── business/              # Product business rules & methodology docs
├── demo/                  # Python prototype script
├── .github/
│   └── workflows/
│       └── ci-pr.yml      # GitHub Actions CI for PR validation
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

- **Start Infrastructure**: `npm run db:up` (launches Postgres on port `5434` and Redis on port `6379`).
- **Start Web**: `npm run dev:web` (runs Next.js on `http://localhost:3000`).
- **Start API**: `npm run dev:api` (runs NestJS on `http://localhost:3001`).
- **Run Lint & Format**: `npm run lint` / `npm run format`.
- **Run Build**: `npm run build`.
