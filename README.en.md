# FalconArena

FalconArena is a standalone tournament platform for team-based programming competitions. Organizers create tournaments and rounds, teams register and submit work, jury members evaluate submissions, and the system provides leaderboard results, archive views, communication flows, certificates, integrations, and operational tooling around the full tournament lifecycle.

Live site: `https://falconarena.live/`

Language versions:

- English: `README.en.md`
- Ukrainian: `README.md`

## Platform Overview

FalconArena is designed as a product platform for tournaments, where the core competition flows live in one system:

- tournament setup and status management;
- team registration and participant management;
- rounds with tasks, deadlines, and supporting materials;
- submissions through GitHub, demo, and live demo links;
- tournament-level jury assignment, round evaluation distribution, and leaderboard generation;
- archive views and certificates for completed tournaments;
- announcements, direct dialogs, and system notifications;
- public `About` page with platform copy, a banner, role blocks, CTA, contact channels, and user reviews;
- a modern interface with light and dark themes.

## Who FalconArena is for

- `ADMIN` and `ORGANIZER` manage tournaments, rounds, users, integrations, and platform settings.
- `TEAM` registers a team, follows the active round, and submits work.
- `JURY` reviews assigned submissions, scores projects, and works with final results.

## Product Capabilities

### Tournament flow

- role-based flow for `ADMIN`, `ORGANIZER`, `TEAM`, and `JURY`
- email/password authentication and OAuth sign-in through Google or GitHub
- public tournament pages
- rounds with descriptions, requirements, deadlines, and materials
- submissions with GitHub, demo, live demo, and structured summaries
- automatic submission locking after the deadline
- managed jury pool for each tournament
- submission distribution only across jury members assigned to the selected tournament
- category-based evaluation
- leaderboard, archive, and export flows

### Communication and delivery

- role-based announcements
- personal dialogs
- system notifications
- unread indicators in the UI
- email delivery through `console` or `resend`
- background processing for tournament events and reminders

### UX and personalization

- light and dark themes with the selected mode saved in the browser
- a unified `app shell` across roles
- quiet loading states without extra text noise
- responsive workspaces for desktop and mobile
- user profile with avatar, language, and time zone settings

### Administrative and operating layer

- user, role, access-block management, and CSV export
- tournament-level jury assignment from the Dashboard
- compact administrator guidance block with a launch checklist
- tournament schedule
- profile settings
- `About` page with managed platform copy, banner, contact channels, and user reviews
- participant and winner certificates
- Google Sheets export via webhook
- `Integrations / System settings` admin screen
- About page content management from `Integrations`: hero copy, banner, workflow copy, role blocks, CTA, contacts, and review moderation
- monitoring, activity history, automated checks, and deployment documentation

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

2. Run local bootstrap:

```bash
npm run bootstrap:local
```

What bootstrap does:

- verifies `Node.js >= 20`
- creates `infra/docker-compose/.env` from `.env.example` if needed
- generates Prisma Client for backend automatically

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
- `Production Smoke Check` runs scheduled and on-demand backend smoke automation against the deployed platform

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
- `EMAIL_NOTIFICATIONS_ENABLED` (optional, `true/false`)
- `EMAIL_PROVIDER` (optional, `console` or `resend`)
- `EMAIL_FROM` (required for real email sending)
- `EMAIL_REPLY_TO` (optional)
- `RESEND_API_KEY` (required only for `EMAIL_PROVIDER=resend`)
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` for Google OAuth
- `GH_OAUTH_CLIENT_ID` and `GH_OAUTH_CLIENT_SECRET` for GitHub OAuth
- `GOOGLE_CALLBACK_URL` and `GITHUB_CALLBACK_URL` when production callbacks differ from defaults
- `FRONTEND_OAUTH_SUCCESS_URL` and `FRONTEND_OAUTH_FAILURE_URL`

GitHub OAuth uses `GH_OAUTH_CLIENT_ID` in repository secrets because the `GITHUB_` prefix is reserved by GitHub.

Required repository secrets for manual smoke check:

- `SMOKE_ADMIN_EMAIL`
- `SMOKE_ADMIN_PASSWORD`
- `SMOKE_TEST_USER_PASSWORD` (optional, fallback supported)

Optional repository variable for manual smoke check:

- `SMOKE_BASE_URL` (defaults to `https://falconarena.live`, can also be overridden in manual workflow dispatch input)

Production routing is handled by Caddy (`80/443`). Database and Redis are internal-only in Docker network.

Quick setup for GitHub + Ubuntu + `falconarena.live` is in `docs/deploy-quickstart.md`.
API smoke scenario is in `docs/mvp-smoke-api.md`.
UI smoke scenario is in `docs/ui-smoke-runbook.md`.
Acceptance review checklist is in `docs/acceptance-checklist.md`.

Ukrainian docs:

- `docs/deploy-quickstart.uk.md`
- `docs/mvp-smoke-api.uk.md`
- `docs/ui-smoke-runbook.uk.md`
- `docs/project-decisions.uk.md`
- `docs/acceptance-checklist.uk.md`

## Role Onboarding

- `TEAM`: open `https://falconarena.live/`, go to `Register`, create an account, then open `My team` and register a team in a tournament.
- `ADMIN`: create the initial admin with the seed command, sign in, open `Admin panel`, and create a tournament and round.
- `ORGANIZER` / `JURY`: sign in as `ADMIN`, open the user creation block in `Admin panel`, and create the required roles through the UI.

## Product Flow

1. `TEAM`: creates an account through `/app/register`, opens tournaments, registers a team, and submits work for the active round.
2. `ADMIN`: creates a tournament, switches it to `Registration`, starts a round, and creates `JURY` and `ORGANIZER` users if needed.
3. `JURY`: works in the jury workspace, opens assigned submissions, and scores them.
4. `ADMIN`: assigns jury members to the tournament, distributes evaluation across that jury pool, closes submissions or finishes evaluation, then reviews `Leaderboard`, `Archive`, and certificates.
5. Any role: uses `Messages` (`/app/messages`) for announcements, system notifications, and personal dialogs.

## Backend API and Platform Capabilities

- Auth + RBAC are implemented in NestJS (`JWT`, `register`, `login`, `me`, role guard).
- Auth endpoints:
  - `POST /auth/register` (public, always creates `TEAM` user)
  - `POST /auth/admin/users` (roles: `ADMIN`, `ORGANIZER`)
  - `POST /auth/login`
  - `GET /auth/google`
  - `GET /auth/google/callback`
  - `GET /auth/github`
  - `GET /auth/github/callback`
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
  - `GET /tournaments/:id/jury` (roles: `ADMIN`, `ORGANIZER`)
  - `PATCH /tournaments/:id/jury` (roles: `ADMIN`, `ORGANIZER`)
- Team registration endpoints:
  - `GET /teams`
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
- Announcement endpoints:
  - `GET /announcements` (authenticated users, role-aware feed)
  - `POST /announcements` (roles: `ADMIN`, `ORGANIZER`)
  - `PATCH /announcements/:id` (roles: `ADMIN`, `ORGANIZER`)
- Personal dialog endpoints:
  - `GET /messages/dialogs`
  - `POST /messages/dialogs` (create/open dialog by recipient email)
  - `GET /messages/dialogs/:id`
  - `POST /messages/dialogs/:id` (send message)
- Notification endpoints:
  - `GET /notifications`
  - `PATCH /notifications/read-state`
- Email delivery:
  - system notifications can also be delivered by email
  - supported providers: `console`, `resend`

Additional env setting:

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
- Current message-related migrations: `0003_announcements`, `0004_direct_dialogs`.

Backend API automation scripts:

- `BASE_URL=http://localhost:4000 ADMIN_EMAIL=admin@falconarena.live ADMIN_PASSWORD=change_me npm run smoke:mvp -w @falconarena/backend`
- `BASE_URL=http://localhost:4000 ADMIN_EMAIL=admin@falconarena.live ADMIN_PASSWORD=change_me npm run test:e2e:finish-evaluation -w @falconarena/backend`
- `BASE_URL=http://localhost:4000 ADMIN_EMAIL=admin@falconarena.live ADMIN_PASSWORD=change_me npm run test:e2e:profile-avatar -w @falconarena/backend`
