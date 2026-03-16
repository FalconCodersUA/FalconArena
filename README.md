# FalconArena

FalconArena — це платформа турнірів з програмування, де організатори проводять раунди з дедлайнами, команди здають результати, а журі оцінює роботи з формуванням таблиці лідерів.

Сайт доступний за адресою: `https://falconarena.live/`

Мовні версії:

- Українська: `README.md`
- English: `README.en.md`

## Технологічний стек

- Frontend: React + TypeScript + Vite
- Backend: NestJS + TypeScript
- Database: PostgreSQL + Prisma
- Cache/queue-ready layer: Redis
- Infrastructure: Docker Compose
- CI/CD: GitHub Actions

## Структура монорепозиторію

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

- Захищена гілка: `main`
- Розробка: `feature/*`
- Інтеграція: тільки Pull Request у `main`
- Прямих push у `main` немає

### Режим малої команди (self-merge)

Рекомендовані налаштування для 1-2 розробників:

- Require pull request before merge: enabled
- Required approvals: `0` (self-review за шаблоном PR)
- Require status checks before merge: enabled (`CI / checks`)
- Auto-deploy після merge у `main`: enabled через `deploy.yml`

## Локальний запуск

1. Встановіть залежності:

```bash
npm install
```

2. Скопіюйте Docker env шаблон:

```bash
cp infra/docker-compose/.env.example infra/docker-compose/.env
```

3. Запустіть інфраструктуру і застосунки:

```bash
docker compose -f infra/docker-compose/docker-compose.yml --env-file infra/docker-compose/.env up -d --build
```

4. Відкрийте сервіси:

- Вхідна точка (Caddy): `http://localhost`
- Health backend через proxy: `http://localhost/health`

## CI / CD

- PR у `main`: lint + test + build
- Push/merge у `main`: deploy workflow підключається до Ubuntu через SSH і оновлює Docker Compose
- Ручний запуск: `Smoke Check (Manual)` виконує backend MVP smoke перевірку за запитом

Необхідні GitHub secrets для deploy:

- `SSH_HOST`
- `SSH_USER`
- `SSH_PRIVATE_KEY`
- `SSH_PORT` (optional, default `22`)
- `DEPLOY_PATH`
- `GH_PULL_USERNAME`
- `GH_PULL_TOKEN` (fine-grained token з доступом Read до repository)
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `VITE_API_URL` (optional, fallback підтримується)

Необхідні GitHub secrets для ручної smoke перевірки:

- `SMOKE_ADMIN_EMAIL`
- `SMOKE_ADMIN_PASSWORD`
- `SMOKE_TEST_USER_PASSWORD` (optional, fallback підтримується)

Опційна GitHub variable для ручної smoke перевірки:

- `SMOKE_BASE_URL` (за замовчуванням `https://falconarena.live`, також можна перевизначити через input у ручному запуску workflow)

У production маршрути обслуговує Caddy (`80/443`). PostgreSQL і Redis доступні тільки у внутрішній Docker мережі.

## Документація

- Швидкий деплой: `docs/deploy-quickstart.md`
- Smoke API перевірка MVP: `docs/mvp-smoke-api.md`
- Архітектурні рішення: `docs/project-decisions.md`

Українські версії:

- `docs/deploy-quickstart.uk.md`
- `docs/mvp-smoke-api.uk.md`
- `docs/project-decisions.uk.md`

## Статус backend foundation

- Auth + RBAC реалізовано (`JWT`, `register`, `login`, `me`, role guard)
- Публічна реєстрація `POST /auth/register` створює тільки роль `TEAM`
- Адмінське створення користувачів: `POST /auth/admin/users` (`ADMIN`, `ORGANIZER`)
- Турніри, команди, раунди, сабміти, оцінювання і leaderboard реалізовані
- Додано `POST /rounds/:roundId/finish-evaluation`
- Міграції Prisma версіонуються у `apps/backend/prisma/migrations`

## Корисні команди

Опційний seed admin:

```bash
SEED_ADMIN_EMAIL=admin@falconarena.live SEED_ADMIN_PASSWORD=change_me npm run prisma:seed -w @falconarena/backend
```

Міграції:

- `npm run prisma:generate -w @falconarena/backend`
- `npm run prisma:migrate:deploy -w @falconarena/backend`
- baseline для існуючої БД після `db push`: `npm run prisma:migrate:resolve:init -w @falconarena/backend`
- режим runtime синхронізації БД керується `PRISMA_SYNC_MODE` (`dbpush` або `migrate`)

Автоматичні API перевірки backend:

- `BASE_URL=http://localhost:4000 ADMIN_EMAIL=admin@falconarena.live ADMIN_PASSWORD=change_me npm run smoke:mvp -w @falconarena/backend`
- `BASE_URL=http://localhost:4000 ADMIN_EMAIL=admin@falconarena.live ADMIN_PASSWORD=change_me npm run test:e2e:finish-evaluation -w @falconarena/backend`
