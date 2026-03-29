# FalconArena

FalconArena - це вебплатформа для командного турніру з програмування. Організатори створюють турніри й раунди, команди реєструються та подають рішення, журі оцінює роботи, а система формує leaderboard, архів результатів і комунікацію навколо турніру.

Продакшн-адреса: `https://falconarena.live/`

Мовні версії:

- Українська: `README.md`
- English: `README.en.md`

## Що вже є в проєкті

### Основний функціонал

- Аутентифікація та ролі: `ADMIN`, `ORGANIZER`, `TEAM`, `JURY`
- Публічна реєстрація команди через акаунт капітана
- Адмінське створення користувачів через UI
- Турніри зі статусами `Draft / Registration / Running / Finished`
- Окрема публічна сторінка турніру
- Раунди із:
  - описом
  - must-have вимогами
  - вимогами до технологій
  - додатковими матеріалами
  - стартом і дедлайном
- Подання сабмітів:
  - GitHub repository URL
  - demo URL
  - live demo URL
  - короткий summary
- Блокування сабмітів після дедлайну
- Розподіл робіт для журі
- Оцінювання по категоріях
- Finish evaluation
- Leaderboard
- Архів завершених турнірів
- CSV-експорт результатів

### Комунікація та активність

- Оголошення для ролей
- Особисті діалоги
- Системні сповіщення
- Unread/read-state для:
  - оголошень
  - особистих діалогів
  - системних сповіщень
- Topbar bell з переходом у потрібний контекст
- Realtime у прагматичному форматі через автооновлення:
  - leaderboard
  - повідомлення
  - topbar сповіщення
- Email-нотифікації:
  - `console` fallback для dev/demo
  - `resend` для реальної доставки

### Додаткові можливості

- Розклад турніру
- Профіль користувача з налаштуваннями
- Аватар користувача
- Мовні уподобання
- Часовий пояс
- Printable сертифікати участі та переможця
- Збереження сертифікатів у PDF через браузерний print dialog
- Експорт leaderboard у Google Sheets через webhook

## Поточний статус щодо ТЗ

Реалізовано:

- ролі користувачів
- турніри
- реєстрацію команд
- раунди / завдання
- сабміти
- оцінювання
- leaderboard
- головну навігацію й робочі кабінети
- профіль користувача
- оголошення
- особисті діалоги
- внутрішні та email-сповіщення
- архів турнірів
- розклад турніру
- сертифікати
- CSV-експорт

Ще можна посилювати як optional / next step:

- інтеграцію з Google Sheets
- більш production-grade realtime через WebSocket або SSE

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

2. Скопіюйте env-шаблон:

```bash
cp infra/docker-compose/.env.example infra/docker-compose/.env
```

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
- `BASE_URL=http://localhost:4000 ADMIN_EMAIL=admin@falconarena.live ADMIN_PASSWORD=change_me npm run test:e2e:finish-evaluation -w @falconarena/backend`
- `BASE_URL=http://localhost:4000 ADMIN_EMAIL=admin@falconarena.live ADMIN_PASSWORD=change_me npm run test:e2e:profile-avatar -w @falconarena/backend`

Типовые проверки:

- `npm run lint -w @falconarena/frontend`
- `npm run lint -w @falconarena/backend`
- `npm test -w @falconarena/frontend`
- `npm test -w @falconarena/backend`

## CI / CD

- Pull Request у `main`: lint + test + build
- Merge у `main`: GitHub Actions запускає deploy
- Продакшн працює через Docker Compose і Caddy
- PostgreSQL і Redis доступні тільки у внутрішній Docker мережі

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
- `docs/mvp-smoke-api.uk.md` - API smoke
- `docs/ui-smoke-runbook.uk.md` - UI smoke
- `docs/project-decisions.uk.md` - архітектурні рішення
- `docs/acceptance-checklist.uk.md` - acceptance checklist

## Google Sheets export

Поточна реалізація зроблена у прагматичному форматі через webhook:

1. Створіть Google Apps Script або інший сумісний endpoint, який приймає `POST` JSON.
2. Додайте в env:
   - `GOOGLE_SHEETS_WEBHOOK_URL`
   - `GOOGLE_SHEETS_WEBHOOK_SECRET` (optional, але бажано)
   - `GOOGLE_SHEETS_DEFAULT_SHEET_NAME` (optional)
3. У `Лідерборді` або `Архіві` натисніть `Експортувати в Google Sheets`.

Backend надсилає:

- metadata турніру
- scoring model
- headers
- rows
- rowObjects
- generatedAt
- exportedBy

## Статус

Проєкт уже покриває основну частину конкурсного ТЗ і придатний для demo / захисту:

- є end-to-end user flow для `TEAM`, `JURY`, `ADMIN`, `ORGANIZER`
- є UI, backend, база даних, ролі, оцінювання, leaderboard, повідомлення, архів, сертифікати
- є CI/CD, smoke checks, документація й міграції

Це вже не просто scaffold або backend foundation, а повноцінний робочий MVP платформи.
