# FalconArena

FalconArena is a tournament platform where organizers run coding rounds with deadlines, teams submit results, and jury members evaluate work to build a leaderboard.

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

- PR to `main`: lint + build
- Push/merge to `main`: deploy workflow connects to Ubuntu over SSH and runs Docker Compose update

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

Production routing is handled by Caddy (`80/443`). Database and Redis are internal-only in Docker network.

Quick setup for GitHub + Ubuntu + `falconarena.live` is in `docs/deploy-quickstart.md`.

## Notes

- The repository includes only the base scaffold so team members can start parallel feature work.
- Product domain entities are pre-seeded in Prisma schema for tournaments, teams, rounds, submissions, and jury evaluation.

## Backend Foundation Status

- Auth + RBAC base is wired in NestJS (`JWT`, `register`, `login`, `me`, role guard).
- Current auth endpoints:
  - `POST /auth/register`
  - `POST /auth/login`
  - `GET /auth/me` (Bearer token)
  - `GET /auth/admin/ping` (roles: `ADMIN`, `ORGANIZER`)
- Health endpoints:
  - `GET /health`
  - `GET /admin/health` (roles: `ADMIN`, `ORGANIZER`)
