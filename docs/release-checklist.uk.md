# Release Checklist

Цей документ потрібен перед кожним `merge -> deploy`, щоб не пропустити базові перевірки.

Використовуйте його разом з:

- [ops-runbook.uk.md](/D:/MixProjects/FalconArena/docs/ops-runbook.uk.md)
- [smoke-checklist.uk.md](/D:/MixProjects/FalconArena/docs/smoke-checklist.uk.md)
- [ui-smoke-runbook.uk.md](/D:/MixProjects/FalconArena/docs/ui-smoke-runbook.uk.md)

## 1. Перед merge

1. Перевірити `git status` і переконатися, що в commit не потрапляють випадкові файли.
2. Запустити `lint` для змінених workspace.
3. Запустити ключові тести для зміненого блоку.
4. Якщо змінювався backend:
   - перевірити permission logic;
   - перевірити основні mutating сценарії;
   - перевірити, чи не зламались DTO / validation.
5. Якщо змінювався frontend:
   - пройти критичний UI flow локально;
   - перевірити mobile для зміненого екрана.
6. Якщо змінювались docs або workflow:
   - синхронізувати `README`;
   - синхронізувати acceptance / runbook docs, якщо це потрібно.

## 2. Перед deploy

1. Переконатися, чи є нові Prisma-міграції:
   - `apps/backend/prisma/migrations`
2. Якщо є міграції:
   - підготувати команду `prisma migrate deploy`;
   - зрозуміти, який ризик rollback у разі невдачі.
3. Переконатися, що потрібні env-змінні вже є на сервері.
4. Якщо зачіпали інтеграції:
   - перевірити `Google Sheets`;
   - перевірити `Email delivery`;
   - перевірити `System settings`.

## 3. Після merge / deploy

1. Перевірити, що GitHub Actions / deploy workflow завершився успішно.
2. Якщо були Prisma-міграції, виконати:

```bash
cd /opt/falconarena-deploy
docker compose -f infra/docker-compose/docker-compose.yml --env-file infra/docker-compose/.env exec backend npx prisma migrate deploy --schema apps/backend/prisma/schema.prisma
docker compose -f infra/docker-compose/docker-compose.yml --env-file infra/docker-compose/.env exec backend npx prisma migrate status --schema apps/backend/prisma/schema.prisma
```

3. Перебудувати сервіси, якщо це не зробив автодеплой:

```bash
cd /opt/falconarena-deploy
docker compose -f infra/docker-compose/docker-compose.yml --env-file infra/docker-compose/.env up -d --build backend frontend
```

4. Перевірити:
   - login `ADMIN`
   - `/app/admin`
   - `/app/integrations`
   - один критичний `TEAM` flow
   - один критичний `JURY` flow
   - `/app/leaderboard` або `/app/archive`

## 4. Post-deploy smoke

Мінімум:

1. сторінка відкривається без runtime error;
2. auth працює;
3. новий функціонал реально доступний;
4. backend logs не показують очевидний збій;
5. якщо міняли інтеграції:
   - `Send test email`
   - `Google Sheets export`

## 5. Якщо щось пішло не так

1. Зупинити нові ручні зміни в production.
2. Перевірити backend logs і `requestId`.
3. Перевірити, чи успішно застосувалась міграція.
4. Якщо проблема в останньому релізі:
   - перейти до [ops-runbook.uk.md](/D:/MixProjects/FalconArena/docs/ops-runbook.uk.md)
   - виконати rollback по зафіксованому стабільному commit.

## 6. Мінімальний checklist для галочки

- `lint` пройшов
- ключові тести пройшли
- docs синхронізовані
- міграції перевірені
- deploy успішний
- post-deploy smoke пройшов
- logs чисті
