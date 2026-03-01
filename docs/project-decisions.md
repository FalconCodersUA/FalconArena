# Project Decisions

## Confirmed Stack

- Frontend: React + TypeScript + Vite
- Backend: NestJS + TypeScript
- Database: PostgreSQL
- ORM: Prisma
- Async-ready infrastructure: Redis
- Runtime packaging: Docker Compose
- CI/CD: GitHub Actions

## Repository Layout

- `apps/frontend`
- `apps/backend`
- `infra/docker-compose`
- `.github/workflows`

## Team Workflow

- Main branch: `main`
- Feature branches: `feature/*`
- Integration: Pull Request into `main`
- Small-team mode: self-review in PR template + mandatory CI checks

## CI/CD Contract

- Pull request to `main`: `lint + build`
- Push/merge to `main`: deploy to Ubuntu over SSH
- One environment: `production` (or `demo` label)

## Delivery Priorities

1. Auth + RBAC (`ADMIN`, `TEAM`, `JURY`, optional `ORGANIZER`)
2. Tournament creation and registration window logic
3. Team registration and validation rules
4. Round/task activation and deadline control
5. Submission flow and lock after deadline
6. Jury assignment and evaluation forms
7. Leaderboard and score aggregation
