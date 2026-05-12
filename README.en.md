# FalconArena

FalconArena is a web platform for running team-based programming tournaments. It brings the full tournament lifecycle into one product: tournament setup, team registration, rounds, submissions, jury evaluation, leaderboard results, archive, certificates, communication, integrations, and operational control.

Live site: `https://falconarena.live/`

Language versions:

- English: `README.en.md`
- Ukrainian: `README.md`

## Platform Overview

FalconArena is built as a product platform for programming tournaments, where every key workflow is connected in one workspace:

- tournament creation and status management;
- team registration and participant management;
- rounds with tasks, requirements, deadlines, and materials;
- submissions through GitHub, demo, live demo, and a short project summary;
- tournament-level jury assignment, round evaluation distribution, and leaderboard generation;
- archive views, printable certificates, CSV export, and Google Sheets export;
- announcements, direct dialogs with message management, and system notifications;
- public `About` and `Presentation` pages for reviewers, guests, and project stakeholders;
- a polished responsive interface with light, blue, and dark themes.

## Who FalconArena Is For

- `ADMIN` and `ORGANIZER` manage tournaments, rounds, users, integrations, content, and operational settings.
- `TEAM` registers a team, follows the active round, submits work, and tracks results.
- `JURY` receives assigned submissions, scores them by criteria, and works with final results.

## Product Capabilities

### Tournament Flow

- role-based platform for `ADMIN`, `ORGANIZER`, `TEAM`, and `JURY`
- email/password authentication plus Google OAuth and GitHub OAuth
- public tournament pages
- registration windows, team limits, tournament schedule, and tournament statuses
- rounds with descriptions, must-have requirements, technical requirements, deadlines, and materials
- submissions with GitHub, demo, live demo, and structured summaries
- automatic submission locking after deadline or round closure
- managed jury pool for each tournament
- submission distribution only across jury members assigned to the selected tournament
- category-based evaluation on a `0-100` scale
- leaderboard, archive, certificate, CSV, and Google Sheets export flows

### Communication and Notifications

- role-aware announcements
- direct dialogs with support for deleting individual messages or a full dialog
- system notifications for tournament events, deadlines, submissions, and operational updates
- unread indicators in the shell and messages workspace
- email delivery through `console` or `resend`
- background processing for tournament events and reminders

### UX and Personalization

- light, blue, and dark themes with the selected theme saved in the browser
- Ukrainian and English UI with the selected language saved in the browser
- unified `app shell` across roles
- stable responsive layouts for desktop and mobile
- profile settings with avatar, language, timezone, and password update
- product-style public pages for `About` and project presentation video

### Administrative and Operational Layer

- user management with role updates, account blocking, CSV export, and admin-only password reset
- tournament-level jury assignment from the Dashboard
- compact administrator guidance and launch checklist blocks
- integration settings for Google Sheets, email delivery, notification rules, tournament defaults, and public content
- managed `About` page content: hero copy, banner, workflow text, role blocks, CTA, contacts, and moderated reviews
- monitoring workspace, activity history, error reports, audit trail, automated checks, and deployment documentation

## Tech Stack

- Frontend: React + TypeScript + Vite
- Backend: NestJS + TypeScript
- Database: PostgreSQL + Prisma
- Cache / queue-ready layer: Redis
- Infrastructure: Docker Compose + Caddy
- CI/CD: GitHub Actions

## Monorepo Layout

```text
apps/
  frontend/
  backend/
docs/
infra/
  docker-compose/
.github/
  workflows/
```

## Main Screens

- `/` - public entry point
- `/app/login` - sign in
- `/app/register` - team account registration
- `/app/about` - public platform page with product copy, banner, contacts, and reviews
- `/app/presentation` - public video presentation page
- `/app/tournaments` - tournament catalog
- `/app/tournaments/:id` - public tournament details page
- `/app/teams` - teams list with tournament filtering
- `/app/team` - team workspace
- `/app/jury` - jury workspace
- `/app/admin` - admin dashboard
- `/app/users` - admin-only user, role, blocking, password reset, and CSV export management
- `/app/leaderboard` - leaderboard
- `/app/archive` - completed tournament archive
- `/app/messages` - announcements, system notifications, and direct dialogs
- `/app/profile` - profile and settings
- `/app/integrations` - admin-only integrations and system settings
- `/app/monitoring` - admin-only monitoring, system signals, and reports
- `/app/certificates` - printable certificate preview

## Role Model

- `TEAM`
  - registers through the public site
  - creates or registers a team in a tournament
  - sees the active tournament and active round
  - submits work before the deadline
  - reads announcements, notifications, and direct dialogs
- `JURY`
  - sees assigned submissions
  - reviews repository and demo links
  - submits category-based scores and comments
  - reads messages and schedule context
- `ADMIN`
  - creates tournaments and rounds
  - updates tournament and round statuses
  - creates and manages users
  - assigns jury members to tournaments
  - distributes submissions for evaluation
  - manages announcements, archive, certificates, integrations, public content, monitoring, and users
- `ORGANIZER`
  - handles most tournament operations without full admin scope

## Product Flow

1. `TEAM`: creates an account through `/app/register`, opens tournaments, registers a team, and submits work.
2. `ADMIN`: creates a tournament, opens registration, starts a round, and creates `JURY` or `ORGANIZER` users if needed.
3. `JURY`: works in the jury workspace, opens assigned submissions, and submits scores.
4. `ADMIN`: assigns jury members to the tournament, distributes evaluation across that jury pool, closes submissions or finishes evaluation, then reviews `Leaderboard`, `Archive`, and certificates.
5. Any role: uses `Messages` for announcements, system notifications, and direct dialogs.
6. Signed-in users can leave a review on the `About` page; `ADMIN` moderates reviews from `Integrations`.

## Local Start

1. Install dependencies:

```bash
npm install
```

2. Run the local bootstrap:

```bash
npm run bootstrap:local
```

Bootstrap:

- checks `Node.js >= 20`
- creates `infra/docker-compose/.env` from `.env.example` if needed
- generates the Prisma Client for the backend

3. Start local infrastructure:

```bash
docker compose -f infra/docker-compose/docker-compose.yml --env-file infra/docker-compose/.env up -d --build
```

4. Open:

- `http://localhost` - frontend through Caddy
- `http://localhost/health` - backend health through the proxy

## Environment Variables

Core:

- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `VITE_API_URL`
- `APP_DOMAIN`
- `PRISMA_SYNC_MODE`

Email notifications:

- `EMAIL_NOTIFICATIONS_ENABLED`
- `EMAIL_PROVIDER` - `console` or `resend`
- `EMAIL_FROM`
- `EMAIL_REPLY_TO`
- `RESEND_API_KEY`

Google Sheets export:

- `GOOGLE_SHEETS_WEBHOOK_URL`
- `GOOGLE_SHEETS_WEBHOOK_SECRET`
- `GOOGLE_SHEETS_DEFAULT_SHEET_NAME`

OAuth sign-in:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_CALLBACK_URL`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GITHUB_CALLBACK_URL`
- `FRONTEND_OAUTH_SUCCESS_URL`
- `FRONTEND_OAUTH_FAILURE_URL`

Storage:

- `STORAGE_PROVIDER` - `local` or `s3`
- `STORAGE_LOCAL_DIR`
- `STORAGE_LOCAL_PUBLIC_PREFIX`
- `STORAGE_S3_ENDPOINT`
- `STORAGE_S3_REGION`
- `STORAGE_S3_BUCKET`
- `STORAGE_S3_ACCESS_KEY_ID`
- `STORAGE_S3_SECRET_ACCESS_KEY`
- `STORAGE_S3_PUBLIC_BASE_URL`
- `STORAGE_S3_KEY_PREFIX`
- `STORAGE_S3_FORCE_PATH_STYLE`

Additional setting:

- `MAX_TEAM_MEMBERS` - default: `8`

Integration values can be provided through env as bootstrap/fallback values. Google Sheets, email delivery, notification rules, tournament defaults, and public About-page content can also be managed from `/app/integrations`.

## Seed and Migrations

Seed admin:

```bash
SEED_ADMIN_EMAIL=admin@falconarena.live SEED_ADMIN_PASSWORD=change_me npm run prisma:seed -w @falconarena/backend
```

Useful Prisma commands:

- `npm run prisma:generate -w @falconarena/backend`
- `npm run prisma:migrate:deploy -w @falconarena/backend`
- `npm run prisma:migrate:dev -w @falconarena/backend`
- `npm run prisma:migrate:resolve:init -w @falconarena/backend`

Production deploy uses `PRISMA_SYNC_MODE=migrate` by default and applies tracked Prisma migrations during backend container startup.

## Backend API

### Auth

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/admin/users`
- `GET /auth/google`
- `GET /auth/google/callback`
- `GET /auth/github`
- `GET /auth/github/callback`
- `GET /auth/me`
- `GET /auth/admin/ping`

### Users and profile

- `GET /admin/users`
- `GET /admin/users/export.csv`
- `PATCH /admin/users/:userId`
- `PATCH /admin/users/:userId/password`
- `GET /profile/settings`
- `PATCH /profile/settings`

### Dashboard and activity

- `GET /dashboard/admin/metrics`
- `GET /dashboard/jury/metrics`
- `GET /dashboard/team/metrics`
- `GET /activity/mine`
- `GET /activity/admin`

### Tournaments

- `GET /tournaments`
- `GET /tournaments/:id`
- `GET /tournaments/:id/archive`
- `GET /tournaments/:id/announcements`
- `GET /tournaments/:id/jury`
- `PATCH /tournaments/:id/jury`
- `POST /tournaments`
- `PATCH /tournaments/:id/status`
- `PATCH /tournaments/:id/status/override`
- `GET /tournaments/:tournamentId/schedule`
- `POST /tournaments/:tournamentId/schedule`
- `PATCH /tournaments/:tournamentId/schedule/:eventId`
- `DELETE /tournaments/:tournamentId/schedule/:eventId`
- `GET /tournaments/:tournamentId/certificate-template`
- `PATCH /tournaments/:tournamentId/certificate-template`
- `GET /tournaments/:tournamentId/certificates/teams/:teamId`

### Teams

- `GET /teams`
- `POST /tournaments/:tournamentId/teams/register`
- `GET /tournaments/:tournamentId/teams`
- `GET /tournaments/:tournamentId/teams/me`

### Rounds

- `POST /tournaments/:tournamentId/rounds`
- `GET /tournaments/:tournamentId/rounds`
- `GET /tournaments/:tournamentId/rounds/active`
- `PATCH /tournaments/:tournamentId/rounds/:roundId/status`
- `PATCH /tournaments/:tournamentId/rounds/:roundId/status/override`
- `POST /rounds/:roundId/finish-evaluation`

### Submissions

- `POST /rounds/:roundId/submissions`
- `GET /rounds/:roundId/submissions/me`
- `GET /rounds/:roundId/submissions`

### Evaluation

- `POST /rounds/:roundId/assignments/distribute`
- `GET /rounds/:roundId/assignments`
- `GET /rounds/:roundId/assignments/me`
- `POST /rounds/:roundId/assignments/:assignmentId/evaluation`

### Leaderboard

- `GET /tournaments/:tournamentId/leaderboard`
- `GET /tournaments/:tournamentId/leaderboard/export.csv`
- `POST /tournaments/:tournamentId/leaderboard/export.google-sheets`

### Announcements, messages, notifications

- `GET /announcements`
- `POST /announcements`
- `PATCH /announcements/:id`
- `PATCH /announcements/read-state`
- `GET /messages/dialogs`
- `POST /messages/dialogs`
- `GET /messages/dialogs/:id`
- `POST /messages/dialogs/:id`
- `DELETE /messages/dialogs/:id`
- `DELETE /messages/dialogs/:id/messages/:messageId`
- `GET /notifications`
- `PATCH /notifications/read-state`

### System integrations and public content

- `GET /admin/system-integrations/google-sheets`
- `PATCH /admin/system-integrations/google-sheets`
- `POST /admin/system-integrations/google-sheets/test`
- `GET /admin/system-integrations/email`
- `PATCH /admin/system-integrations/email`
- `POST /admin/system-integrations/email/test`
- `GET /admin/system-integrations/notification-rules`
- `PATCH /admin/system-integrations/notification-rules`
- `GET /admin/system-integrations/platform-content`
- `PATCH /admin/system-integrations/platform-content`
- `POST /admin/system-integrations/platform-content/banner`
- `GET /admin/system-integrations/platform-reviews`
- `PATCH /admin/system-integrations/platform-reviews/:reviewId`
- `GET /admin/system-integrations/tournament-defaults`
- `PATCH /admin/system-integrations/tournament-defaults`
- `GET /platform/about`
- `GET /platform/about/reviews`
- `POST /platform/about/reviews`
- `GET /platform/defaults`

### Observability

- `GET /health`
- `GET /admin/health`
- `GET /admin/error-reports`

## Automated Checks

Backend:

- `BASE_URL=http://localhost:4000 ADMIN_EMAIL=admin@falconarena.live ADMIN_PASSWORD=change_me npm run smoke:mvp -w @falconarena/backend`
- `BASE_URL=http://localhost:4000 ADMIN_EMAIL=admin@falconarena.live ADMIN_PASSWORD=change_me npm run test:e2e:admin-team-jury-leaderboard -w @falconarena/backend`
- `BASE_URL=http://localhost:4000 ADMIN_EMAIL=admin@falconarena.live ADMIN_PASSWORD=change_me npm run test:e2e:archive-certificate-export -w @falconarena/backend`
- `BASE_URL=http://localhost:4000 ADMIN_EMAIL=admin@falconarena.live ADMIN_PASSWORD=change_me npm run test:e2e:finish-evaluation -w @falconarena/backend`
- `BASE_URL=http://localhost:4000 ADMIN_EMAIL=admin@falconarena.live ADMIN_PASSWORD=change_me npm run test:e2e:profile-avatar -w @falconarena/backend`

Typical local checks:

- `npm run lint -w @falconarena/frontend`
- `npm run lint -w @falconarena/backend`
- `npm test -w @falconarena/frontend`
- `npm test -w @falconarena/backend`

## CI / CD

- Pull Request to `main`: lint + test + build
- Merge to `main`: GitHub Actions runs deploy
- Production runs through Docker Compose and Caddy
- PostgreSQL and Redis are internal-only in the Docker network
- Backend uploads/storage supports:
  - `local` provider through a persistent Docker volume
  - `s3` provider for S3-compatible storage (`R2 / MinIO / S3`)

Key GitHub secrets for deploy:

- `SSH_HOST`
- `SSH_USER`
- `SSH_PRIVATE_KEY`
- `SSH_PORT`
- `DEPLOY_PATH`
- `GH_PULL_USERNAME`
- `GH_PULL_TOKEN`
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `VITE_API_URL`
- email secrets when needed

## Documentation

- `docs/implementation-plan.uk.md` - implementation summary and current product state
- `docs/deploy-quickstart.md` - deployment quickstart
- `docs/deploy-quickstart.uk.md` - Ukrainian deployment quickstart
- `docs/ops-runbook.uk.md` - deploy, rollback, backup, and logs runbook
- `docs/backup-restore-drill.uk.md` - database and uploads backup / restore drill
- `docs/release-checklist.uk.md` - short checklist before merge / deploy
- `docs/admin-runbook.uk.md` - daily ADMIN workflow
- `docs/support-troubleshooting.uk.md` - common support cases
- `docs/mvp-smoke-api.md` - API smoke scenario
- `docs/mvp-smoke-api.uk.md` - Ukrainian API smoke scenario
- `docs/ui-smoke-runbook.md` - UI smoke scenario
- `docs/ui-smoke-runbook.uk.md` - Ukrainian UI smoke scenario
- `docs/project-decisions.md` - architecture decisions
- `docs/project-decisions.uk.md` - Ukrainian architecture decisions
- `docs/acceptance-checklist.md` - review checklist
- `docs/acceptance-checklist.uk.md` - Ukrainian review checklist
- `docs/product-overview.uk.md` - concise product overview
- `docs/defense-demo-script.uk.md` - recommended product presentation script

## Google Sheets Export

The current implementation uses a pragmatic webhook-based export:

1. Create a Google Apps Script or another compatible endpoint that accepts `POST` JSON.
2. Add `GOOGLE_SHEETS_*` env values as bootstrap/fallback values, or open `/app/integrations` as `ADMIN` and save the webhook in the database.
3. Click `Export to Google Sheets` from `Leaderboard` or `Archive`.

Backend sends:

- tournament metadata
- scoring model
- headers
- rows
- row objects
- generation timestamp
- exporting user

## Backup / Restore

Basic server-side commands:

```bash
cd /opt/falconarena-deploy
sh infra/scripts/backup-all.sh
sh infra/scripts/verify-backup.sh <timestamp>
```

Available separately:

- `sh infra/scripts/backup-db.sh`
- `sh infra/scripts/backup-storage.sh`
- `sh infra/scripts/restore-db.sh backups/<backup-file>.sql`
- `sh infra/scripts/restore-storage.sh backups/<storage-archive>.tar.gz`
