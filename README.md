# FalconArena

FalconArena - це завершена вебплатформа для проведення командних турнірів з програмування. Вона об'єднує весь цикл турніру в одному продукті: створення турніру, реєстрацію команд, запуск раундів, подання сабмітів, оцінювання, таблицю лідерів, архів, сертифікати, комунікацію та адміністративний контроль.

Продакшн-адреса: `https://falconarena.live/`

Мовні версії:

- Українська: `README.md`
- English: `README.en.md`

## Що робить FalconArena сильною платформою

### Повний турнірний цикл

- рольова модель `ADMIN`, `ORGANIZER`, `TEAM`, `JURY`
- публічна реєстрація команди через акаунт капітана
- створення користувачів і керування ролями через UI
- турніри зі статусами `Draft / Registration / Running / Finished`
- окрема публічна сторінка турніру
- раунди з описом, обов'язковими вимогами, технологічними вимогами, матеріалами, стартом і дедлайном
- подання сабмітів через GitHub, demo, live demo і короткий опис рішення
- блокування сабмітів після дедлайну
- розподіл оцінювання для журі
- оцінювання по категоріях і завершення етапу оцінювання
- таблиця лідерів, архів завершених турнірів і CSV-експорт результатів

### Комунікація та контроль

- оголошення для ролей
- особисті діалоги між користувачами
- системні сповіщення
- індикатори непрочитаних повідомлень і сповіщень
- автоматичне оновлення таблиці лідерів, повідомлень і topbar-індикаторів
- email-сповіщення через `console` або `resend`
- фонова обробка подій для дедлайнів, старту реєстрації, старту раундів, закриття сабмітів і доставки email

### Інфраструктурна зрілість

- розклад турніру
- профіль користувача з налаштуваннями
- аватар користувача з файловим збереженням
- мовні уподобання і часовий пояс
- сертифікати участі та переможця з підготовкою до друку
- експорт у Google Sheets через webhook
- admin-only сторінка `Інтеграції / Налаштування системи`
- моніторинг, архів, сертифікати, стрічка активності, автоматичні перевірки та документація для реальної експлуатації

## FalconArena повністю закриває базове ТЗ

Платформа реалізує повний функціональний контур, потрібний для демонстрації та захисту:

- ролі користувачів і контроль доступу
- турніри, команди та реєстрацію
- раунди й завдання
- сабміти
- оцінювання
- таблицю лідерів
- робочі кабінети для всіх ролей
- профіль користувача
- оголошення, діалоги, внутрішні та email-сповіщення
- архів турнірів
- розклад турніру
- сертифікати
- CSV-експорт і Google Sheets-експорт

## Технологічний стек

- Frontend: React + TypeScript + Vite
- Backend: NestJS + TypeScript
- Database: PostgreSQL + Prisma
- Cache / queue-ready layer: Redis
- Infrastructure: Docker Compose + Caddy
- CI/CD: GitHub Actions

## Структура монорепозиторію

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

## Основні екрани

- `/` - landing / вхід у застосунок
- `/app/login` - вхід
- `/app/register` - реєстрація
- `/app/tournaments` - список турнірів
- `/app/tournaments/:id` - публічна сторінка турніру
- `/app/team` - кабінет команди
- `/app/jury` - кабінет журі
- `/app/admin` - admin dashboard
- `/app/leaderboard` - leaderboard
- `/app/archive` - архів завершених турнірів
- `/app/messages` - оголошення, сповіщення, діалоги
- `/app/profile` - профіль і налаштування
- `/app/integrations` - admin-only інтеграції та системні налаштування
- `/app/certificates` - printable certificate preview

## Рольова модель

- `TEAM`
  - реєструється
  - створює/реєструє команду
  - бачить активний турнір і раунд
  - подає сабміт
  - читає оголошення, сповіщення, діалоги
- `JURY`
  - бачить призначені роботи
  - оцінює сабміти
  - читає повідомлення і розклад
- `ADMIN`
  - створює турніри
  - змінює статуси
  - створює раунди
  - розподіляє оцінювання
  - створює користувачів
  - керує оголошеннями, архівом, сертифікатами
- `ORGANIZER`
  - має доступ до більшості організаційних дій без повного admin scope

## Demo Flow

1. `TEAM`: зареєструвати акаунт через `/app/register`, увійти, відкрити турніри, зареєструвати команду і подати сабміт.
2. `ADMIN`: увійти, створити турнір, перевести його в `Registration`, створити раунд і за потреби створити `JURY` та `ORGANIZER`.
3. `JURY`: увійти, перейти в кабінет журі, відкрити призначені роботи та виставити оцінки.
4. `ADMIN`: розподілити оцінювання, закрити сабміти або завершити оцінювання, перевірити `Leaderboard`, `Archive`, сертифікати.
5. Будь-яка роль: відкрити `Повідомлення`, перевірити оголошення, системні сповіщення та особисті діалоги.

## Локальний запуск

1. Встановіть залежності:

```bash
npm install
```

2. Запустіть локальний bootstrap:

```bash
npm run bootstrap:local
```

Що робить bootstrap:

- перевіряє `Node.js >= 20`
- створює `infra/docker-compose/.env` з `.env.example`, якщо файл ще не існує
- автоматично генерує Prisma Client для backend

3. Запустіть локальне оточення:

```bash
docker compose -f infra/docker-compose/docker-compose.yml --env-file infra/docker-compose/.env up -d --build
```

4. Відкрийте:

- `http://localhost` - frontend через Caddy
- `http://localhost/health` - backend health через proxy

## Змінні середовища

Базові:

- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `VITE_API_URL`
- `APP_DOMAIN`
- `PRISMA_SYNC_MODE`

Для email-нотифікацій:

- `EMAIL_NOTIFICATIONS_ENABLED`
- `EMAIL_PROVIDER` - `console` або `resend`
- `EMAIL_FROM`
- `EMAIL_REPLY_TO`
- `RESEND_API_KEY`

Для Google Sheets:

- `GOOGLE_SHEETS_WEBHOOK_URL`
- `GOOGLE_SHEETS_WEBHOOK_SECRET`
- `GOOGLE_SHEETS_DEFAULT_SHEET_NAME`

Для storage strategy:

- `STORAGE_PROVIDER` - `local` або `s3`
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

Примітка: ці env-параметри працюють як fallback. Основні налаштування Google Sheets, email delivery, notification rules і tournament defaults також можна зберігати через `/app/integrations` у базі даних.

## Seed і міграції

Seed admin:

```bash
SEED_ADMIN_EMAIL=admin@falconarena.live SEED_ADMIN_PASSWORD=change_me npm run prisma:seed -w @falconarena/backend
```

Корисні команди Prisma:

- `npm run prisma:generate -w @falconarena/backend`
- `npm run prisma:migrate:deploy -w @falconarena/backend`
- `npm run prisma:migrate:dev -w @falconarena/backend`
- `npm run prisma:migrate:resolve:init -w @falconarena/backend`

Примітка: після `npm install` Prisma Client також генерується автоматично через root `postinstall`.

## Backend API

### Auth

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `POST /auth/admin/users`

### Tournaments

- `GET /tournaments`
- `GET /tournaments/:id`
- `POST /tournaments`
- `PATCH /tournaments/:id/status`
- `GET /tournaments/:tournamentId/leaderboard`
- `GET /tournaments/:tournamentId/leaderboard/export.csv`
- `POST /tournaments/:tournamentId/leaderboard/export.google-sheets`

### Teams

- `POST /tournaments/:tournamentId/teams/register`
- `GET /tournaments/:tournamentId/teams`
- `GET /tournaments/:tournamentId/teams/me`

### Rounds

- `POST /tournaments/:tournamentId/rounds`
- `GET /tournaments/:tournamentId/rounds`
- `GET /tournaments/:tournamentId/rounds/active`
- `PATCH /tournaments/:tournamentId/rounds/:roundId/status`
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

### Announcements, messages, notifications

- `GET /announcements`
- `POST /announcements`
- `PATCH /announcements/:id`
- `GET /messages/dialogs`
- `POST /messages/dialogs`
- `GET /messages/dialogs/:id`
- `POST /messages/dialogs/:id`
- `GET /notifications`
- `PATCH /notifications/read-state`

### System integrations

- `GET /admin/system-integrations/google-sheets`
- `PATCH /admin/system-integrations/google-sheets`
- `POST /admin/system-integrations/google-sheets/test`
- `GET /admin/system-integrations/email`
- `PATCH /admin/system-integrations/email`
- `GET /admin/system-integrations/notification-rules`
- `PATCH /admin/system-integrations/notification-rules`

### Observability

- `GET /admin/error-reports`

### Tournament extras

- `GET /tournaments/:tournamentId/archive`
- `GET /tournaments/:tournamentId/schedule`
- `POST /tournaments/:tournamentId/schedule`
- `PATCH /tournaments/:tournamentId/schedule/:eventId`
- `DELETE /tournaments/:tournamentId/schedule/:eventId`
- `GET /tournaments/:tournamentId/certificate-template`
- `PATCH /tournaments/:tournamentId/certificate-template`
- `GET /tournaments/:tournamentId/certificates/teams/:teamId`

## Автоматичні перевірки

Backend:

- `BASE_URL=http://localhost:4000 ADMIN_EMAIL=admin@falconarena.live ADMIN_PASSWORD=change_me npm run smoke:mvp -w @falconarena/backend`
- `BASE_URL=http://localhost:4000 ADMIN_EMAIL=admin@falconarena.live ADMIN_PASSWORD=change_me npm run test:e2e:admin-team-jury-leaderboard -w @falconarena/backend`
- `BASE_URL=http://localhost:4000 ADMIN_EMAIL=admin@falconarena.live ADMIN_PASSWORD=change_me npm run test:e2e:archive-certificate-export -w @falconarena/backend`
- `BASE_URL=http://localhost:4000 ADMIN_EMAIL=admin@falconarena.live ADMIN_PASSWORD=change_me npm run test:e2e:finish-evaluation -w @falconarena/backend`
- `BASE_URL=http://localhost:4000 ADMIN_EMAIL=admin@falconarena.live ADMIN_PASSWORD=change_me npm run test:e2e:profile-avatar -w @falconarena/backend`

Типові перевірки:

- `npm run lint -w @falconarena/frontend`
- `npm run lint -w @falconarena/backend`
- `npm test -w @falconarena/frontend`
- `npm test -w @falconarena/backend`

## CI / CD

- Pull Request у `main`: lint + test + build
- Merge у `main`: GitHub Actions запускає deploy
- Продакшн працює через Docker Compose і Caddy
- PostgreSQL і Redis доступні тільки у внутрішній Docker мережі
- Backend uploads/storage підтримує:
  - `local` provider через окремий persistent Docker volume
  - `s3` provider для S3-compatible storage (`R2 / MinIO / S3`)

Основні GitHub secrets для deploy:

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
- email secrets за потреби

## Документація

- `docs/project-brief.uk.md` - повне ТЗ
- `docs/implementation-plan.uk.md` - план реалізації
- `docs/deploy-quickstart.uk.md` - деплой
- `docs/ops-runbook.uk.md` - deploy / rollback / backup / logs
- `docs/backup-restore-drill.uk.md` - rehearsal для backup / restore БД та uploads
- `docs/release-checklist.uk.md` - короткий checklist перед merge / deploy
- `docs/admin-runbook.uk.md` - щоденний сценарій роботи для ADMIN
- `docs/support-troubleshooting.uk.md` - типові проблеми і їх розбір
- `docs/mvp-smoke-api.uk.md` - API smoke
- `docs/ui-smoke-runbook.uk.md` - UI smoke-сценарій
- `docs/project-decisions.uk.md` - архітектурні рішення
- `docs/acceptance-checklist.uk.md` - acceptance checklist
- `docs/product-overview.uk.md` - короткий продуктовий огляд платформи
- `docs/defense-demo-script.uk.md` - рекомендований сценарій демонстрації для захисту

## Google Sheets export

Поточна реалізація зроблена у прагматичному форматі через webhook:

1. Створіть Google Apps Script або інший сумісний endpoint, який приймає `POST` JSON.
2. Або додайте `GOOGLE_SHEETS_*` у env як bootstrap/fallback, або відкрийте `/app/integrations` під `ADMIN` і збережіть webhook у базі даних.
3. У `Лідерборді` або `Архіві` натисніть `Експортувати в Google Sheets`.

Backend надсилає:

- metadata турніру
- scoring model
- headers
- rows
- rowObjects
- generatedAt
- exportedBy

## Backup / Restore

Базові server-side команди:

```bash
cd /opt/falconarena-deploy
sh infra/scripts/backup-all.sh
sh infra/scripts/verify-backup.sh <timestamp>
```

Окремо також доступні:

- `sh infra/scripts/backup-db.sh`
- `sh infra/scripts/backup-storage.sh`
- `sh infra/scripts/restore-db.sh backups/<backup-file>.sql`
- `sh infra/scripts/restore-storage.sh backups/<storage-archive>.tar.gz`
