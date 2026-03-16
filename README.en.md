# FalconArena

FalconArena is a tournament platform where organizers run coding rounds with deadlines, teams submit results, and jury members evaluate work to build a leaderboard.

Live site: `https://falconarena.live/`

Language versions:

- English: `README.en.md`
- Ukrainian: `README.md`

## Tech Stack

- Frontend: React + TypeScript + Vite
- Backend: NestJS + TypeScript
- Database: PostgreSQL + Prisma
- Cache/queue-ready layer: Redis
- Infrastructure: Docker Compose
- CI/CD: GitHub Actions

## Monorepo Layout

```text
apps/
  frontend/
  backend/
infra/
  docker-compose/
.github/
  workflows/
```

## Git Flow

- Protected branch: `main`
- Feature development: `feature/*`
- Integration path: Pull Request into `main` only
- No direct pushes to `main`

### Small team mode (self-merge)

Recommended settings for a 1-2 developer team:

- Require pull request before merge: enabled
- Required approvals: `0` (self-review with checklist in PR template)
- Require status checks before merge: enabled (`CI / checks`)
- Auto-deploy after merge to `main`: enabled via `deploy.yml`

## Local Start

1. Install dependencies:

```bash
npm install
```

2. Copy Docker env template:

```bash
cp infra/docker-compose/.env.example infra/docker-compose/.env
```

3. Start local infrastructure and apps:

```bash
docker compose -f infra/docker-compose/docker-compose.yml --env-file infra/docker-compose/.env up -d --build
```

4. Open apps:

- App entrypoint (Caddy): `http://localhost`
- Backend health via proxy: `http://localhost/health`

## CI / CD

- PR to `main`: lint + test + build
- Push/merge to `main`: deploy workflow connects to Ubuntu over SSH and runs Docker Compose update
- Manual trigger: `Smoke Check (Manual)` runs backend MVP smoke script on demand

Required repository secrets for deploy:

- `SSH_HOST`
- `SSH_USER`
- `SSH_PRIVATE_KEY`
- `SSH_PORT` (optional, defaults to `22`)
- `DEPLOY_PATH`
- `GH_PULL_USERNAME`
- `GH_PULL_TOKEN` (fine-grained token with repo read access)
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `VITE_API_URL` (optional, fallback supported)

Required repository secrets for manual smoke check:

- `SMOKE_ADMIN_EMAIL`
- `SMOKE_ADMIN_PASSWORD`
- `SMOKE_TEST_USER_PASSWORD` (optional, fallback supported)

Optional repository variable for manual smoke check:

- `SMOKE_BASE_URL` (defaults to `https://falconarena.live`, can also be overridden in manual workflow dispatch input)

Production routing is handled by Caddy (`80/443`). Database and Redis are internal-only in Docker network.

Quick setup for GitHub + Ubuntu + `falconarena.live` is in `docs/deploy-quickstart.md`.
MVP API smoke script is in `docs/mvp-smoke-api.md`.
Acceptance checklist is in `docs/acceptance-checklist.md`.

Ukrainian docs:

- `docs/deploy-quickstart.uk.md`
- `docs/mvp-smoke-api.uk.md`
- `docs/project-decisions.uk.md`
- `docs/acceptance-checklist.uk.md`

## Role Onboarding

- `TEAM`: open `https://falconarena.live/`, go to `Register`, create an account, then open `My team` and register a team in a tournament.
- `ADMIN`: create the initial admin with the seed command, sign in, open `Admin panel`, and create a tournament and round.
- `ORGANIZER` / `JURY`: sign in as `ADMIN`, open the user creation block in `Admin panel`, and create the required roles through the UI.

## Demo Flow

1. `TEAM`: register through `/app/register`, sign in, register a team in a tournament, and submit work for the active round.
2. `ADMIN`: sign in, create a tournament, switch it to `Registration`, create a round, and create `JURY` and `ORGANIZER` users if needed.
3. `JURY`: sign in, open `My jury`, choose a round, and evaluate assigned submissions.
4. `ADMIN`: distribute assignments, close submissions or finish evaluation, then review the `Leaderboard`.

## Notes

- The repository includes only the base scaffold so team members can start parallel feature work.
- Product domain entities are pre-seeded in Prisma schema for tournaments, teams, rounds, submissions, and jury evaluation.

## Backend Foundation Status

- Auth + RBAC base is wired in NestJS (`JWT`, `register`, `login`, `me`, role guard).
- Current auth endpoints:
  - `POST /auth/register` (public, always creates `TEAM` user)
  - `POST /auth/admin/users` (roles: `ADMIN`, `ORGANIZER`)
  - `POST /auth/login`
  - `GET /auth/me` (Bearer token)
  - `GET /auth/admin/ping` (roles: `ADMIN`, `ORGANIZER`)
- Health endpoints:
  - `GET /health`
  - `GET /admin/health` (roles: `ADMIN`, `ORGANIZER`)
- Tournament endpoints:
  - `GET /tournaments`
  - `GET /tournaments/:id`
  - `POST /tournaments` (roles: `ADMIN`, `ORGANIZER`)
  - `PATCH /tournaments/:id/status` (roles: `ADMIN`, `ORGANIZER`)
- Team registration endpoints:
  - `POST /tournaments/:tournamentId/teams/register` (roles: `TEAM`, `ADMIN`, `ORGANIZER`)
  - `GET /tournaments/:tournamentId/teams`
  - `GET /tournaments/:tournamentId/teams/me` (roles: `TEAM`, `ADMIN`, `ORGANIZER`)
- Round/task endpoints:
  - `POST /tournaments/:tournamentId/rounds` (roles: `ADMIN`, `ORGANIZER`)
  - `GET /tournaments/:tournamentId/rounds`
  - `GET /tournaments/:tournamentId/rounds/active`
  - `PATCH /tournaments/:tournamentId/rounds/:roundId/status` (roles: `ADMIN`, `ORGANIZER`)
- Submission endpoints:
  - `POST /rounds/:roundId/submissions` (role: `TEAM`)
  - `GET /rounds/:roundId/submissions/me` (role: `TEAM`)
  - `GET /rounds/:roundId/submissions` (roles: `ADMIN`, `ORGANIZER`, `JURY`)
- Evaluation endpoints:
  - `POST /rounds/:roundId/assignments/distribute` (roles: `ADMIN`, `ORGANIZER`)
  - `GET /rounds/:roundId/assignments` (roles: `ADMIN`, `ORGANIZER`)
  - `GET /rounds/:roundId/assignments/me` (role: `JURY`)
  - `POST /rounds/:roundId/assignments/:assignmentId/evaluation` (role: `JURY`, scale `0-100`)
  - `POST /rounds/:roundId/finish-evaluation` (roles: `ADMIN`, `ORGANIZER`, supports optional `{ "force": true }`)
- Leaderboard endpoint:
  - `GET /tournaments/:tournamentId/leaderboard`

Optional env setting:

- `MAX_TEAM_MEMBERS` (default: `8`)

Optional admin seed command:

```bash
SEED_ADMIN_EMAIL=admin@falconarena.live SEED_ADMIN_PASSWORD=change_me npm run prisma:seed -w @falconarena/backend
```

Database migrations:

- Versioned Prisma migration files are stored in `apps/backend/prisma/migrations`.
- Generate Prisma client: `npm run prisma:generate -w @falconarena/backend`
- Apply tracked migrations: `npm run prisma:migrate:deploy -w @falconarena/backend`
- For already-running databases created with `db push`, baseline once: `npm run prisma:migrate:resolve:init -w @falconarena/backend`
- Runtime DB sync mode is controlled by `PRISMA_SYNC_MODE` (`dbpush` by default, switch to `migrate` after baseline).

Backend API automation scripts:

- `BASE_URL=http://localhost:4000 ADMIN_EMAIL=admin@falconarena.live ADMIN_PASSWORD=change_me npm run smoke:mvp -w @falconarena/backend`
- `BASE_URL=http://localhost:4000 ADMIN_EMAIL=admin@falconarena.live ADMIN_PASSWORD=change_me npm run test:e2e:finish-evaluation -w @falconarena/backend`
