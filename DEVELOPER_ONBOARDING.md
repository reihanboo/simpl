# SIMPL Developer Onboarding

Welcome to SIMPL. This guide helps you set up the project, find the code for a feature, validate your changes, and open a pull request.

## What is SIMPL?

SIMPL is a business management platform for Indonesian businesses. The main product areas include point of sale (POS), inventory, sales reports, customer and loyalty management, employee management, multi-branch access, and an AI assistant.

The application is a full-stack monorepo:

- `frontend/` — React 19, TypeScript, Vite, and Tailwind CSS.
- `backend/` — Go, Gin, GORM, and PostgreSQL.
- `docker-compose.dev.yml` — local development stack with PostgreSQL, backend, and frontend.
- `DOCKER.md` — extended Docker and release instructions.
- `Agent.md` — project-level product and code conventions.

## Prerequisites

For the recommended Docker workflow, install:

- Git
- Docker Desktop with Docker Compose

For running services directly on your machine, also install the Go version specified in `backend/go.mod`, Node.js/npm compatible with the frontend package, and PostgreSQL.

## Get the project running

### Recommended: Docker development stack

From the repository root:

```bash
git clone <repository-url>
cd simpl
docker compose -f docker-compose.dev.yml up --build
```

The development Compose file supplies local PostgreSQL credentials and application defaults. It starts all three services with source mounts and frontend hot reload.

- Frontend: <http://localhost:3000>
- Backend health check: <http://localhost:8080/health>
- PostgreSQL: `localhost:5432`

To stop the stack, press `Ctrl+C`, or run `docker compose -f docker-compose.dev.yml down` in another terminal. The database is stored in the `pgdata-dev` volume and remains between restarts. To intentionally remove that local data, use `docker compose -f docker-compose.dev.yml down -v`.

Optional local environment overrides go in a root `.env` file. Compose reads it automatically. Available settings include `FRONTEND_PORT`, `BACKEND_PORT`, `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`, `JWT_SECRET`, and optional AI/email/payment integration credentials. Never commit secrets; `.env` files are ignored by Git.

### Optional: run frontend and backend on the host

Start PostgreSQL first. The backend expects `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, and `DB_PORT`; it loads a `.env` from its current directory, so place local settings in `backend/.env`. The database user must be allowed to create the configured database on first startup. `PORT` defaults to `8080` and `JWT_SECRET` should be set for local use.

Then install dependencies and start the services in separate terminals:

```bash
# Terminal 1 — repository root (installs the root concurrently runner)
npm ci

# Terminal 2 — frontend
cd frontend
npm ci
npm run dev

# Terminal 3 — backend
cd backend
go run .
```

The frontend Vite server defaults to port `5173` when run directly. The root `npm run dev` script also starts both applications concurrently, but still requires frontend dependencies and a running/configured PostgreSQL instance.

## Demo data

After the development backend and database are running, seed sample businesses and accounts:

```bash
docker compose -f docker-compose.dev.yml exec backend go run ./cmd/seed
```

The seeder is designed for local/demo databases and is safe to run repeatedly. It creates demo accounts with a shared known password. See the [root README](README.md) for account names and the password. Do not run it against production or customer data.

## Where to find things

### Backend (`backend/`)

- `main.go` — loads configuration, initializes the database, and registers HTTP routes.
- `controllers/` — Gin handlers for authentication, business/branch access, products, orders, reports, customers, loyalty, employees, forecasting, and AI chat.
- `models/` — GORM models and persisted domain data.
- `middlewares/` — authentication, employee access control, and error recovery.
- `config/database.go` — PostgreSQL connections and GORM model migration. The optional `AI_DB_USER` connection is intended for read-only AI tools.
- `utils/` — shared utilities such as JWT, phone, timezone, forecasting, and error handling.
- `ai/` — assistant orchestration, DeepSeek integration, and MCP tools.
- `cmd/seed/` — local/demo data seeder.

Most business endpoints are registered under `/api` in `main.go`. Authenticated branch endpoints are grouped under `/api/branches/:id` and use the branch access middleware. Check the route registration and middleware before adding or changing an endpoint.

### Frontend (`frontend/src/`)

- `App.tsx` — application routes and page composition.
- `pages/auth/` — sign-in, registration, password recovery, and account setup.
- `pages/dashboard/` — business dashboard and branch screens.
- `pages/dashboard/branch/` — POS, inventory, reports, customers, employees, attendance, and settings.
- `components/` — shared UI and route components.
- `components/layout/` — dashboard and branch layouts.
- `utils/` — shared frontend helpers.

When tracing a feature, follow the path from the page/component through its backend request to the route, controller, model, and tests. Preserve authorization and business/branch scoping at every layer.

## Development conventions

- Follow existing patterns in the feature area before introducing a new abstraction or dependency.
- Keep user-facing product text in Indonesian where consistent with the surrounding UI and API.
- Do not commit secrets, real customer data, or generated build/dependency directories.
- For database changes, update the relevant GORM model and consider existing data/backward compatibility. Startup runs `AutoMigrate`, but changes that need data transformation may also need an explicit, safe migration/backfill.
- Treat sales and inventory writes as transactional operations. Add tests for validation, permissions, and edge cases when behavior changes.
- Keep AI database access scoped and read-only; review MCP tool behavior before adding database capabilities.
- Do not use `npm test` as a validation command: the root package currently defines it as a placeholder that exits with an error.

## Validate your changes

Run checks relevant to the code you changed before opening a PR.

Backend:

```bash
cd backend
go test ./...
go vet ./...
```

Frontend:

```bash
cd frontend
npm run build
npm run lint
```

The frontend lint command checks the whole project; if it reports issues outside your changes, identify them separately and run ESLint against changed files where appropriate. For UI changes, also verify the screen in the browser at desktop and narrow/mobile widths.

## Create a branch and open a PR

1. Start from an up-to-date base branch (usually `main`; follow the repository's team conventions if different):

   ```bash
   git switch main
   git pull --ff-only
   git switch -c feat/short-description
   ```

   Use a descriptive prefix such as `feat/`, `fix/`, or `docs/`.

2. Make a focused change. Add or update tests and documentation when behavior or setup changes.

3. Review your own diff and run the relevant checks:

   ```bash
   git status --short
   git diff --check
   git diff
   ```

4. Stage only the files belonging to the change and commit with a short imperative subject:

   ```bash
   git add <files>
   git commit -m "Add a concise description"
   ```

5. Push your branch and open a pull request against the project's target branch:

   ```bash
   git push -u origin feat/short-description
   ```

6. In the PR description, explain **what** changed and **why**, list the validation you ran (and any checks you could not run), and attach screenshots or a short recording for UI changes. Link relevant issues and call out database, configuration, or rollout considerations.

7. Respond to review feedback, push follow-up commits to the same branch, and wait for required approvals and CI checks before merging. Do not merge unless the repository's maintainers have authorized you to do so.

Before requesting review, make sure the PR is focused, does not include secrets or unrelated formatting churn, and accurately describes any known limitations.
