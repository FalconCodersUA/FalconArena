# Contributing to FalconArena

Thank you for your interest in FalconArena. This repository is maintained as a product-focused tournament platform, so contributions should keep the user experience, reliability, and role-based workflows clear.

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Prepare the local environment:

```bash
npm run bootstrap:local
```

3. Start the local Docker environment:

```bash
docker compose -f infra/docker-compose/docker-compose.yml --env-file infra/docker-compose/.env up -d --build
```

4. Open the app:

- Frontend through Caddy: `http://localhost`
- Backend health check: `http://localhost/health`

## Development Commands

- Frontend dev server: `npm run dev:frontend`
- Backend dev server: `npm run dev:backend`
- Generate Prisma Client: `npm run prisma:generate`
- Run Prisma migrations locally: `npm run prisma:migrate:dev`

## Before Opening a Pull Request

Run the relevant checks before submitting changes:

```bash
npm run lint
npm test
npm run build
```

For focused frontend or backend checks:

```bash
npm run lint -w @falconarena/frontend
npm run test -w @falconarena/frontend
npm run lint -w @falconarena/backend
npm run test -w @falconarena/backend
```

## Pull Request Guidelines

- Keep changes focused on one feature, fix, or documentation update.
- Describe the user-facing impact and the checks you ran.
- Include screenshots or short screen recordings for visible UI changes.
- Do not commit real secrets, production credentials, database dumps, or private user data.
- Keep Ukrainian and English user-facing copy aligned when both versions exist.

## Product Quality Notes

FalconArena supports multiple roles, themes, and responsive layouts. When changing UI or product behavior, check the affected flow for `ADMIN`, `ORGANIZER`, `TEAM`, and `JURY` where relevant.
